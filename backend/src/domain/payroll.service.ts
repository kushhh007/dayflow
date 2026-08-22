import type { Knex } from 'knex';
import db from '../db/knex.js';
import { calculatePercentagePaise, proratePaise } from '../utils/money.js';

export type PayrollRunStatus = 'DRAFT' | 'CALCULATED' | 'FINALIZED';

export interface PayrollRun {
  id: number;
  period_start: string;
  period_end: string;
  status: PayrollRunStatus;
  created_by: number | null;
  calculated_at: Date | null;
  finalized_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Payslip {
  id: number;
  payroll_run_id: number;
  employee_id: number;
  base_salary_paise: bigint | string;
  hra_paise: bigint | string;
  da_paise: bigint | string;
  gross_salary_paise: bigint | string;
  working_days: number;
  payable_days: number | string;
  net_salary_paise: bigint | string;
  is_finalized: boolean;
  created_at: Date;
}

export class PayrollService {
  constructor(private knex: Knex = db) {}

  /**
   * Creates a new payroll run in DRAFT status.
   */
  async createPayrollRun(
    periodStart: string,
    periodEnd: string,
    createdBy?: number,
    externalTrx?: Knex.Transaction
  ): Promise<PayrollRun> {
    const runInTrx = async (trx: Knex.Transaction) => {
      const [run] = await trx('payroll_runs')
        .insert({
          period_start: periodStart,
          period_end: periodEnd,
          status: 'DRAFT',
          created_by: createdBy ?? null
        })
        .returning('*');
      return run;
    };

    if (externalTrx) {
      return runInTrx(externalTrx);
    }
    return this.knex.transaction(runInTrx);
  }

  /**
   * Calculates employee-specific working dates based on the intersection between
   * the employee's EmploymentPeriods and the payroll period [periodStart, periodEnd].
   */
  private getIntersectingWorkingDates(
    periodStart: string,
    periodEnd: string,
    periods: Array<{ start_date: string | Date; end_date: string | Date | null }>
  ): string[] {
    const pStart = new Date(periodStart);
    const pEnd = new Date(periodEnd);
    const intersectingDates: string[] = [];

    for (let d = new Date(pStart); d <= pEnd; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);
      const curTime = d.getTime();

      // Check if this date falls into any of the employee's employment periods
      const isActiveOnDate = periods.some((period) => {
        const start = new Date(period.start_date).getTime();
        const end = period.end_date ? new Date(period.end_date).getTime() : Infinity;
        return curTime >= start && curTime <= end;
      });

      if (isActiveOnDate) {
        intersectingDates.push(dateStr);
      }
    }

    return intersectingDates;
  }

  /**
   * Calculates attendance contribution for payable days.
   */
  private getAttendanceContribution(status?: string): number {
    switch (status) {
      case 'PRESENT':
      case 'PAID':
      case 'SICK':
      case 'LEAVE':
        return 1.0;
      case 'HALF_DAY':
        return 0.5;
      case 'ABSENT':
      case 'UNPAID':
      default:
        return 0.0;
    }
  }

  /**
   * Calculates or recalculates payroll for a PayrollRun:
   * 1. Validates that payroll run is not FINALIZED (immutability).
   * 2. Deletes existing draft payslips for this run.
   * 3. Calculates intersecting working days for each employee.
   *    - If working_days === 0, EXCLUDES employee and generates NO payslip.
   * 4. Calculates payable_days and prorated integer paise salary.
   * 5. Saves payslips and transitions run to CALCULATED.
   */
  async calculatePayrollRun(
    payrollRunId: number,
    externalTrx?: Knex.Transaction
  ): Promise<{ run: PayrollRun; payslips: Payslip[] }> {
    const runInTrx = async (trx: Knex.Transaction) => {
      const run = await trx('payroll_runs').where({ id: payrollRunId }).first();
      if (!run) {
        throw new Error(`Payroll run with ID ${payrollRunId} not found`);
      }
      if (run.status === 'FINALIZED') {
        throw new Error(`Cannot calculate a FINALIZED payroll run (immutable)`);
      }

      // Clear existing payslips for this run if recalculating
      await trx('payslips').where({ payroll_run_id: payrollRunId }).delete();

      // Fetch all employees
      const employees = await trx('employees');
      const payslipsToInsert: any[] = [];

      for (const emp of employees) {
        // Fetch employment periods
        const periods = await trx('employment_periods')
          .where({ employee_id: emp.id })
          .orderBy('start_date', 'asc');

        const workingDates = this.getIntersectingWorkingDates(
          run.period_start,
          run.period_end,
          periods
        );

        const workingDays = workingDates.length;

        // SPEC RULE 19: If employee-specific Working Days = 0, EXCLUDE employee & generate NO payslip
        if (workingDays === 0) {
          continue;
        }

        // Fetch effective salary structure as of period_end
        const salary = await trx('salary_structures')
          .where({ employee_id: emp.id })
          .where('effective_from', '<=', run.period_end)
          .orderBy('effective_from', 'desc')
          .first();

        if (!salary) {
          // Employee has no salary structure configured
          continue;
        }

        // Fetch attendance records for this employee within the period
        const attendanceRecords = await trx('attendance')
          .where({ employee_id: emp.id })
          .whereIn('date', workingDates);

        const attendanceMap = new Map<string, string>();
        for (const att of attendanceRecords) {
          const dateStr = typeof att.date === 'string' ? att.date.slice(0, 10) : new Date(att.date).toISOString().slice(0, 10);
          attendanceMap.set(dateStr, att.status);
        }

        // Calculate payable days
        let payableDays = 0;
        for (const dateStr of workingDates) {
          const status = attendanceMap.get(dateStr);
          payableDays += this.getAttendanceContribution(status);
        }

        // Exact Integer Paise Calculation
        const basePaise = BigInt(salary.base_salary_paise);
        const hraPaise = calculatePercentagePaise(basePaise, salary.hra_percentage);
        const daPaise = calculatePercentagePaise(basePaise, salary.da_percentage);

        const proratedBasePaise = proratePaise(basePaise, payableDays, workingDays);
        const proratedHraPaise = proratePaise(hraPaise, payableDays, workingDays);
        const proratedDaPaise = proratePaise(daPaise, payableDays, workingDays);

        const grossPaise = proratedBasePaise + proratedHraPaise + proratedDaPaise;
        const netPaise = grossPaise;

        payslipsToInsert.push({
          payroll_run_id: payrollRunId,
          employee_id: emp.id,
          base_salary_paise: proratedBasePaise.toString(),
          hra_paise: proratedHraPaise.toString(),
          da_paise: proratedDaPaise.toString(),
          gross_salary_paise: grossPaise.toString(),
          working_days: workingDays,
          payable_days: payableDays,
          net_salary_paise: netPaise.toString(),
          is_finalized: false
        });
      }

      let insertedPayslips: Payslip[] = [];
      if (payslipsToInsert.length > 0) {
        insertedPayslips = await trx('payslips')
          .insert(payslipsToInsert)
          .returning('*');
      }

      const [updatedRun] = await trx('payroll_runs')
        .where({ id: payrollRunId })
        .update({
          status: 'CALCULATED',
          calculated_at: trx.fn.now(),
          updated_at: trx.fn.now()
        })
        .returning('*');

      return { run: updatedRun, payslips: insertedPayslips };
    };

    if (externalTrx) {
      return runInTrx(externalTrx);
    }
    return this.knex.transaction(runInTrx);
  }

  /**
   * Finalizes a CALCULATED payroll run:
   * Sets status = FINALIZED and marks all payslips as is_finalized = true.
   * Enforces immutability on finalized payroll.
   */
  async finalizePayrollRun(
    payrollRunId: number,
    externalTrx?: Knex.Transaction
  ): Promise<{ run: PayrollRun; payslips: Payslip[] }> {
    const runInTrx = async (trx: Knex.Transaction) => {
      const run = await trx('payroll_runs').where({ id: payrollRunId }).first();
      if (!run) {
        throw new Error(`Payroll run with ID ${payrollRunId} not found`);
      }
      if (run.status === 'FINALIZED') {
        throw new Error(`Payroll run ${payrollRunId} is already FINALIZED`);
      }
      if (run.status !== 'CALCULATED') {
        throw new Error(`Cannot finalize payroll run in ${run.status} status. It must be CALCULATED first.`);
      }

      // Mark all payslips as finalized (immutable)
      const updatedPayslips = await trx('payslips')
        .where({ payroll_run_id: payrollRunId })
        .update({ is_finalized: true })
        .returning('*');

      // Mark payroll run as finalized
      const [updatedRun] = await trx('payroll_runs')
        .where({ id: payrollRunId })
        .update({
          status: 'FINALIZED',
          finalized_at: trx.fn.now(),
          updated_at: trx.fn.now()
        })
        .returning('*');

      return { run: updatedRun, payslips: updatedPayslips };
    };

    if (externalTrx) {
      return runInTrx(externalTrx);
    }
    return this.knex.transaction(runInTrx);
  }

  /**
   * Retrieves payslips for a payroll run.
   */
  async getPayslipsForRun(
    payrollRunId: number,
    trx: Knex.Transaction | Knex = this.knex
  ): Promise<Payslip[]> {
    return trx('payslips')
      .where({ payroll_run_id: payrollRunId })
      .orderBy('employee_id', 'asc');
  }

  /**
   * Retrieves a payslip by employee and payroll run ID.
   */
  async getPayslip(
    payrollRunId: number,
    employeeId: number,
    trx: Knex.Transaction | Knex = this.knex
  ): Promise<Payslip | undefined> {
    return trx('payslips')
      .where({ payroll_run_id: payrollRunId, employee_id: employeeId })
      .first();
  }
}
