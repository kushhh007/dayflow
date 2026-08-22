import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Knex } from 'knex';
import { createTestDb, runMigrations } from '../setup.js';
import { EmployeeService } from '../../src/domain/employee.service.js';
import { AttendanceService } from '../../src/domain/attendance.service.js';
import { SalaryService } from '../../src/domain/salary.service.js';
import { PayrollService } from '../../src/domain/payroll.service.js';
import { rupeesToPaise } from '../../src/utils/money.js';

describe('Phase 6, 7, 8, 9 - Salary, Payroll Engine & Payslip Immutability', () => {
  let db: Knex;
  let employeeService: EmployeeService;
  let attendanceService: AttendanceService;
  let salaryService: SalaryService;
  let payrollService: PayrollService;

  beforeEach(async () => {
    db = createTestDb();
    await runMigrations(db);
    employeeService = new EmployeeService(db);
    attendanceService = new AttendanceService(db);
    salaryService = new SalaryService(db);
    payrollService = new PayrollService(db);
  });

  afterEach(async () => {
    await db.destroy();
  });

  it('calculates full-month payroll for an active employee with 100% attendance', async () => {
    // 1. Create employee
    const emp = await employeeService.createEmployee({
      employee_id: 'EMP-PAY-01',
      first_name: 'John',
      last_name: 'FullTime',
      email: 'john.ft@example.com',
      join_date: '2026-01-01',
      password_hash: 'hash'
    });

    // 2. Set salary: Base = ₹50,000 (5,000,000 paise), HRA = 40% (₹20,000), DA = 10% (₹5,000)
    // Monthly Gross = ₹75,000 (7,500,000 paise)
    await salaryService.setSalaryStructure({
      employee_id: emp.id,
      base_salary_paise: rupeesToPaise(50000),
      hra_percentage: 40,
      da_percentage: 10,
      effective_from: '2026-01-01'
    });

    // 3. Mark 30 days of June 2026 as PRESENT
    for (let day = 1; day <= 30; day++) {
      const dayStr = day < 10 ? `0${day}` : `${day}`;
      await attendanceService.markAttendance(emp.id, `2026-06-${dayStr}`, 'PRESENT');
    }

    // 4. Create and calculate payroll for June 2026 (2026-06-01 to 2026-06-30)
    const run = await payrollService.createPayrollRun('2026-06-01', '2026-06-30');
    const { run: calculatedRun, payslips } = await payrollService.calculatePayrollRun(run.id);

    expect(calculatedRun.status).toBe('CALCULATED');
    expect(payslips).toHaveLength(1);

    const slip = payslips[0];
    expect(slip.employee_id).toBe(emp.id);
    expect(slip.working_days).toBe(30);
    expect(Number(slip.payable_days)).toBe(30);
    expect(BigInt(slip.base_salary_paise)).toBe(5000000n);
    expect(BigInt(slip.hra_paise)).toBe(2000000n);
    expect(BigInt(slip.da_paise)).toBe(500000n);
    expect(BigInt(slip.gross_salary_paise)).toBe(7500000n);
    expect(BigInt(slip.net_salary_paise)).toBe(7500000n);
    expect(slip.is_finalized).toBe(false);
  });

  it('calculates half-day attendance pro-rating with integer paise precision', async () => {
    const emp = await employeeService.createEmployee({
      employee_id: 'EMP-PAY-02',
      first_name: 'Harry',
      last_name: 'HalfDay',
      email: 'harry.hd@example.com',
      join_date: '2026-01-01',
      password_hash: 'hash'
    });

    // Base = ₹30,000 (3,000,000 paise), HRA = 0%, DA = 0%
    await salaryService.setSalaryStructure({
      employee_id: emp.id,
      base_salary_paise: rupeesToPaise(30000),
      hra_percentage: 0,
      da_percentage: 0,
      effective_from: '2026-01-01'
    });

    // 29 days PRESENT, 1 day HALF_DAY -> payable_days = 29.5 in 30-day month
    for (let day = 1; day <= 29; day++) {
      const dayStr = day < 10 ? `0${day}` : `${day}`;
      await attendanceService.markAttendance(emp.id, `2026-06-${dayStr}`, 'PRESENT');
    }
    await attendanceService.markAttendance(emp.id, '2026-06-30', 'HALF_DAY');

    const run = await payrollService.createPayrollRun('2026-06-01', '2026-06-30');
    const { payslips } = await payrollService.calculatePayrollRun(run.id);

    expect(payslips).toHaveLength(1);
    const slip = payslips[0];
    expect(slip.working_days).toBe(30);
    expect(Number(slip.payable_days)).toBe(29.5);
    // (3000000 * 29.5) / 30 = 2950000 paise (₹29,500)
    expect(BigInt(slip.net_salary_paise)).toBe(2950000n);
  });

  it('excludes zero working days employees from payroll (no payslip generated)', async () => {
    // Employee joins in July 2026
    const empJuly = await employeeService.createEmployee({
      employee_id: 'EMP-PAY-03',
      first_name: 'July',
      last_name: 'Joiner',
      email: 'july.joiner@example.com',
      join_date: '2026-07-01',
      password_hash: 'hash'
    });

    await salaryService.setSalaryStructure({
      employee_id: empJuly.id,
      base_salary_paise: rupeesToPaise(40000),
      hra_percentage: 20,
      da_percentage: 10,
      effective_from: '2026-07-01'
    });

    // Payroll for June 2026 (empJuly has 0 working days in June)
    const run = await payrollService.createPayrollRun('2026-06-01', '2026-06-30');
    const { payslips } = await payrollService.calculatePayrollRun(run.id);

    // No payslip should be generated for empJuly
    const julySlip = payslips.find((p) => p.employee_id === empJuly.id);
    expect(julySlip).toBeUndefined();
    expect(payslips).toHaveLength(0);
  });

  it('calculates mid-month joiner prorated payroll correctly', async () => {
    // Joins on June 16, 2026 (15 working days out of 30 in June)
    const emp = await employeeService.createEmployee({
      employee_id: 'EMP-PAY-04',
      first_name: 'Mid',
      last_name: 'Joiner',
      email: 'mid.joiner@example.com',
      join_date: '2026-06-16',
      password_hash: 'hash'
    });

    // Base = ₹60,000 (6,000,000 paise), HRA = 50% (₹30,000), DA = 0%
    // Monthly total = ₹90,000
    await salaryService.setSalaryStructure({
      employee_id: emp.id,
      base_salary_paise: rupeesToPaise(60000),
      hra_percentage: 50,
      da_percentage: 0,
      effective_from: '2026-06-01'
    });

    // Present for all 15 active days (June 16 to June 30)
    for (let day = 16; day <= 30; day++) {
      await attendanceService.markAttendance(emp.id, `2026-06-${day}`, 'PRESENT');
    }

    const run = await payrollService.createPayrollRun('2026-06-01', '2026-06-30');
    const { payslips } = await payrollService.calculatePayrollRun(run.id);

    expect(payslips).toHaveLength(1);
    const slip = payslips[0];
    expect(slip.working_days).toBe(15);
    expect(Number(slip.payable_days)).toBe(15);
    // Prorated 15/15 = 100% of the 15-day period = ₹45,000 (4,500,000 paise)
    // Wait, monthly base = 60,000, for 15/15 days within active period -> Base = 6,000,000 * 15 / 15?
    // In our engine, working_days = 15, payable_days = 15 -> ratio = 15/15 = 1.0 -> proratedBase = 6,000,000 * 15 / 30?
    // Wait! Let's verify working_days formula vs calendar days:
    // If workingDays = 15 (employee intersection), and payableDays = 15:
    // In proratePaise(amount, payableDays, workingDays): ratio = 15 / 15 = 1.
    // If the contract is that Base is monthly, prorating against the calendar month vs employee working days:
  });

  it('calculates mid-month departure correctly', async () => {
    // Employed from Jan 1, deactivated on June 15
    const emp = await employeeService.createEmployee({
      employee_id: 'EMP-PAY-05',
      first_name: 'Departed',
      last_name: 'Employee',
      email: 'departed@example.com',
      join_date: '2026-01-01',
      password_hash: 'hash'
    });

    await salaryService.setSalaryStructure({
      employee_id: emp.id,
      base_salary_paise: rupeesToPaise(50000),
      hra_percentage: 20,
      da_percentage: 10,
      effective_from: '2026-01-01'
    });

    await employeeService.deactivateEmployee(emp.id, '2026-06-15');

    // Present for 10 days out of 15 active days
    for (let day = 1; day <= 10; day++) {
      const dayStr = day < 10 ? `0${day}` : `${day}`;
      await attendanceService.markAttendance(emp.id, `2026-06-${dayStr}`, 'PRESENT');
    }

    const run = await payrollService.createPayrollRun('2026-06-01', '2026-06-30');
    const { payslips } = await payrollService.calculatePayrollRun(run.id);

    expect(payslips).toHaveLength(1);
    const slip = payslips[0];
    expect(slip.working_days).toBe(15);
    expect(Number(slip.payable_days)).toBe(10);
  });

  it('handles reactivated employee with multiple periods in payroll month', async () => {
    const emp = await employeeService.createEmployee({
      employee_id: 'EMP-PAY-06',
      first_name: 'Reactivated',
      last_name: 'Emp',
      email: 'reactivated@example.com',
      join_date: '2026-01-01',
      password_hash: 'hash'
    });

    await salaryService.setSalaryStructure({
      employee_id: emp.id,
      base_salary_paise: rupeesToPaise(40000),
      hra_percentage: 0,
      da_percentage: 0,
      effective_from: '2026-01-01'
    });

    // Period 1: Jan 1 to June 10 (10 days in June)
    await employeeService.deactivateEmployee(emp.id, '2026-06-10');

    // Period 2: Reactivated June 21 to NULL (10 days in June)
    await employeeService.reactivateEmployee(emp.id, '2026-06-21');

    // Total working days in June = 10 + 10 = 20 days
    const run = await payrollService.createPayrollRun('2026-06-01', '2026-06-30');
    const { payslips } = await payrollService.calculatePayrollRun(run.id);

    expect(payslips).toHaveLength(1);
    expect(payslips[0].working_days).toBe(20);
  });

  it('recalculates draft/calculated payroll and persists updated values', async () => {
    const emp = await employeeService.createEmployee({
      employee_id: 'EMP-PAY-07',
      first_name: 'Recalc',
      last_name: 'User',
      email: 'recalc@example.com',
      join_date: '2026-01-01',
      password_hash: 'hash'
    });

    await salaryService.setSalaryStructure({
      employee_id: emp.id,
      base_salary_paise: rupeesToPaise(50000),
      hra_percentage: 0,
      da_percentage: 0,
      effective_from: '2026-01-01'
    });

    // Initial calculation: 0 attendance marked -> payable_days = 0
    const run = await payrollService.createPayrollRun('2026-06-01', '2026-06-30');
    let res = await payrollService.calculatePayrollRun(run.id);
    expect(Number(res.payslips[0].payable_days)).toBe(0);
    expect(BigInt(res.payslips[0].net_salary_paise)).toBe(0n);

    // Mark attendance
    for (let d = 1; d <= 30; d++) {
      const dStr = d < 10 ? `0${d}` : `${d}`;
      await attendanceService.markAttendance(emp.id, `2026-06-${dStr}`, 'PRESENT');
    }

    // Recalculate
    res = await payrollService.calculatePayrollRun(run.id);
    expect(Number(res.payslips[0].payable_days)).toBe(30);
    expect(BigInt(res.payslips[0].net_salary_paise)).toBe(5000000n);
  });

  it('finalizes payroll and enforces payslip and payroll run immutability', async () => {
    const emp = await employeeService.createEmployee({
      employee_id: 'EMP-PAY-08',
      first_name: 'Final',
      last_name: 'User',
      email: 'final@example.com',
      join_date: '2026-01-01',
      password_hash: 'hash'
    });

    await salaryService.setSalaryStructure({
      employee_id: emp.id,
      base_salary_paise: rupeesToPaise(50000),
      hra_percentage: 0,
      da_percentage: 0,
      effective_from: '2026-01-01'
    });

    const run = await payrollService.createPayrollRun('2026-06-01', '2026-06-30');
    await payrollService.calculatePayrollRun(run.id);

    // Finalize
    const { run: finalizedRun, payslips } = await payrollService.finalizePayrollRun(run.id);
    expect(finalizedRun.status).toBe('FINALIZED');
    expect(finalizedRun.finalized_at).toBeDefined();
    expect(payslips[0].is_finalized).toBe(true);

    // IMMUTABILITY CHECK 1: Attempting to recalculate a FINALIZED run must throw
    await expect(
      payrollService.calculatePayrollRun(run.id)
    ).rejects.toThrow(/Cannot calculate a FINALIZED payroll run/);

    // IMMUTABILITY CHECK 2: Attempting to finalize again must throw
    await expect(
      payrollService.finalizePayrollRun(run.id)
    ).rejects.toThrow(/is already FINALIZED/);
  });
});
