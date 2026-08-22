import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Knex } from 'knex';
import { createTestDb, runMigrations } from '../setup.js';
import { EmployeeService } from '../../src/domain/employee.service.js';

function toDateStr(d: string | Date | null): string | null {
  if (!d) return null;
  if (typeof d === 'string') return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

describe('Phase 2 - Employee & EmploymentPeriod Domain Logic', () => {
  let db: Knex;
  let employeeService: EmployeeService;

  beforeEach(async () => {
    db = createTestDb();
    await runMigrations(db);
    employeeService = new EmployeeService(db);
  });

  afterEach(async () => {
    await db.destroy();
  });

  it('creates an active employee with exactly one open employment period', async () => {
    const employee = await employeeService.createEmployee({
      employee_id: 'EMP-101',
      first_name: 'John',
      last_name: 'Doe',
      email: 'john.doe@example.com',
      department: 'Engineering',
      designation: 'Software Engineer',
      role: 'EMPLOYEE',
      join_date: '2026-01-01',
      password_hash: 'secret_hash'
    });

    expect(employee.id).toBeDefined();
    expect(employee.status).toBe('ACTIVE');
    expect(toDateStr(employee.join_date)).toBe('2026-01-01');

    const periods = await employeeService.getEmploymentPeriods(employee.id);
    expect(periods).toHaveLength(1);
    expect(toDateStr(periods[0].start_date)).toBe('2026-01-01');
    expect(periods[0].end_date).toBeNull();
  });

  it('deactivates an active employee and closes the open employment period', async () => {
    const employee = await employeeService.createEmployee({
      employee_id: 'EMP-102',
      first_name: 'Jane',
      last_name: 'Smith',
      email: 'jane.smith@example.com',
      join_date: '2026-01-01',
      password_hash: 'secret_hash'
    });

    await employeeService.deactivateEmployee(employee.id, '2026-08-10');

    const updatedEmployee = await employeeService.getEmployeeById(employee.id);
    expect(updatedEmployee?.status).toBe('INACTIVE');

    const periods = await employeeService.getEmploymentPeriods(employee.id);
    expect(periods).toHaveLength(1);
    expect(toDateStr(periods[0].start_date)).toBe('2026-01-01');
    expect(toDateStr(periods[0].end_date)).toBe('2026-08-10');
  });

  it('reactivates an inactive employee and creates a new open period while preserving historical periods', async () => {
    const employee = await employeeService.createEmployee({
      employee_id: 'EMP-103',
      first_name: 'Alice',
      last_name: 'Wonder',
      email: 'alice@example.com',
      join_date: '2026-01-01',
      password_hash: 'secret_hash'
    });

    // Step 1: Deactivate on 2026-08-10
    await employeeService.deactivateEmployee(employee.id, '2026-08-10');

    // Step 2: Reactivate on 2026-08-20
    const newPeriod = await employeeService.reactivateEmployee(employee.id, '2026-08-20');

    expect(toDateStr(newPeriod.start_date)).toBe('2026-08-20');
    expect(newPeriod.end_date).toBeNull();

    const updatedEmployee = await employeeService.getEmployeeById(employee.id);
    expect(updatedEmployee?.status).toBe('ACTIVE');

    // Verify all periods: Period 1 must remain stored and unchanged
    const periods = await employeeService.getEmploymentPeriods(employee.id);
    expect(periods).toHaveLength(2);
    expect(toDateStr(periods[0].start_date)).toBe('2026-01-01');
    expect(toDateStr(periods[0].end_date)).toBe('2026-08-10');
    expect(toDateStr(periods[1].start_date)).toBe('2026-08-20');
    expect(periods[1].end_date).toBeNull();
  });

  it('rejects reactivation if reactivated start_date overlaps with historical period', async () => {
    const employee = await employeeService.createEmployee({
      employee_id: 'EMP-104',
      first_name: 'Bob',
      last_name: 'Builder',
      email: 'bob@example.com',
      join_date: '2026-01-01',
      password_hash: 'secret_hash'
    });

    await employeeService.deactivateEmployee(employee.id, '2026-08-10');

    // Attempt to reactivate inside the previous period (e.g. 2026-05-01)
    await expect(
      employeeService.reactivateEmployee(employee.id, '2026-05-01')
    ).rejects.toThrow(/overlaps with existing period/);
  });

  it('rejects deactivation if end_date is before period start_date', async () => {
    const employee = await employeeService.createEmployee({
      employee_id: 'EMP-105',
      first_name: 'Charlie',
      last_name: 'Chaplin',
      email: 'charlie@example.com',
      join_date: '2026-05-01',
      password_hash: 'secret_hash'
    });

    await expect(
      employeeService.deactivateEmployee(employee.id, '2026-04-01')
    ).rejects.toThrow(/End date .* cannot be before start date/);
  });

  it('rejects deactivating an already INACTIVE employee', async () => {
    const employee = await employeeService.createEmployee({
      employee_id: 'EMP-106',
      first_name: 'Dave',
      last_name: 'Miller',
      email: 'dave@example.com',
      join_date: '2026-01-01',
      password_hash: 'secret_hash'
    });

    await employeeService.deactivateEmployee(employee.id, '2026-06-01');

    await expect(
      employeeService.deactivateEmployee(employee.id, '2026-07-01')
    ).rejects.toThrow(/is already INACTIVE/);
  });

  it('rejects reactivating an already ACTIVE employee', async () => {
    const employee = await employeeService.createEmployee({
      employee_id: 'EMP-107',
      first_name: 'Eve',
      last_name: 'Adams',
      email: 'eve@example.com',
      join_date: '2026-01-01',
      password_hash: 'secret_hash'
    });

    await expect(
      employeeService.reactivateEmployee(employee.id, '2026-06-01')
    ).rejects.toThrow(/is already ACTIVE/);
  });
});
