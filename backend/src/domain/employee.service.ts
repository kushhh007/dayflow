import type { Knex } from 'knex';
import db from '../db/knex.js';

export interface CreateEmployeeInput {
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  department?: string;
  designation?: string;
  role?: 'ADMIN' | 'EMPLOYEE';
  join_date: string; // YYYY-MM-DD
  password_hash: string;
  must_change_password?: boolean;
}

export interface EmploymentPeriod {
  id: number;
  employee_id: number;
  start_date: string;
  end_date: string | null;
  created_at: Date;
}

export interface Employee {
  id: number;
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  department: string | null;
  designation: string | null;
  role: 'ADMIN' | 'EMPLOYEE';
  status: 'ACTIVE' | 'INACTIVE';
  join_date: string;
  password_hash: string;
  must_change_password: boolean;
  created_at: Date;
  updated_at: Date;
}

export class EmployeeService {
  constructor(private knex: Knex = db) {}

  /**
   * Creates an employee and their initial open employment period in one atomic transaction.
   */
  async createEmployee(input: CreateEmployeeInput, externalTrx?: Knex.Transaction): Promise<Employee> {
    const runInTrx = async (trx: Knex.Transaction) => {
      const [employee] = await trx('employees')
        .insert({
          employee_id: input.employee_id,
          first_name: input.first_name,
          last_name: input.last_name,
          email: input.email,
          department: input.department ?? null,
          designation: input.designation ?? null,
          role: input.role ?? 'EMPLOYEE',
          status: 'ACTIVE',
          join_date: input.join_date,
          password_hash: input.password_hash,
          must_change_password: input.must_change_password ?? true
        })
        .returning('*');

      // Create authoritative initial open employment period
      await trx('employment_periods').insert({
        employee_id: employee.id,
        start_date: input.join_date,
        end_date: null
      });

      return employee;
    };

    if (externalTrx) {
      return runInTrx(externalTrx);
    }
    return this.knex.transaction(runInTrx);
  }

  /**
   * Deactivates an employee:
   * Sets status = INACTIVE and closes the open EmploymentPeriod (end_date = endDate).
   */
  async deactivateEmployee(
    employeeId: number,
    endDate: string,
    externalTrx?: Knex.Transaction
  ): Promise<void> {
    const runInTrx = async (trx: Knex.Transaction) => {
      const employee = await trx('employees').where({ id: employeeId }).first();
      if (!employee) {
        throw new Error(`Employee with ID ${employeeId} not found`);
      }
      if (employee.status === 'INACTIVE') {
        throw new Error(`Employee with ID ${employeeId} is already INACTIVE`);
      }

      // Find the open employment period
      const openPeriod = await trx('employment_periods')
        .where({ employee_id: employeeId })
        .whereNull('end_date')
        .first();

      if (!openPeriod) {
        throw new Error(`Active employee ${employeeId} has no open employment period`);
      }

      if (new Date(endDate) < new Date(openPeriod.start_date)) {
        throw new Error(`End date (${endDate}) cannot be before start date (${openPeriod.start_date})`);
      }

      // Close the period
      await trx('employment_periods')
        .where({ id: openPeriod.id })
        .update({ end_date: endDate });

      // Update employee status
      await trx('employees')
        .where({ id: employeeId })
        .update({ status: 'INACTIVE', updated_at: trx.fn.now() });
    };

    if (externalTrx) {
      return runInTrx(externalTrx);
    }
    return this.knex.transaction(runInTrx);
  }

  /**
   * Reactivates an employee:
   * Sets status = ACTIVE and creates a new open EmploymentPeriod starting on startDate.
   * Ensures historical periods are preserved and no overlap exists.
   */
  async reactivateEmployee(
    employeeId: number,
    startDate: string,
    externalTrx?: Knex.Transaction
  ): Promise<EmploymentPeriod> {
    const runInTrx = async (trx: Knex.Transaction) => {
      const employee = await trx('employees').where({ id: employeeId }).first();
      if (!employee) {
        throw new Error(`Employee with ID ${employeeId} not found`);
      }
      if (employee.status === 'ACTIVE') {
        throw new Error(`Employee with ID ${employeeId} is already ACTIVE`);
      }

      // Ensure no open period exists
      const existingOpen = await trx('employment_periods')
        .where({ employee_id: employeeId })
        .whereNull('end_date')
        .first();

      if (existingOpen) {
        throw new Error(`Inactive employee ${employeeId} has an existing open employment period`);
      }

      // Check overlap with all historical periods
      await this.validateNoOverlap(employeeId, startDate, null, undefined, trx);

      // Create new open period
      const [newPeriod] = await trx('employment_periods')
        .insert({
          employee_id: employeeId,
          start_date: startDate,
          end_date: null
        })
        .returning('*');

      // Update employee status
      await trx('employees')
        .where({ id: employeeId })
        .update({ status: 'ACTIVE', updated_at: trx.fn.now() });

      return newPeriod;
    };

    if (externalTrx) {
      return runInTrx(externalTrx);
    }
    return this.knex.transaction(runInTrx);
  }

  /**
   * Validates that a date range does not overlap with any existing employment periods for the employee.
   */
  async validateNoOverlap(
    employeeId: number,
    startDate: string,
    endDate: string | null,
    excludePeriodId?: number,
    trx: Knex.Transaction | Knex = this.knex
  ): Promise<void> {
    let query = trx('employment_periods').where({ employee_id: employeeId });
    if (excludePeriodId) {
      query = query.whereNot({ id: excludePeriodId });
    }
    const periods = await query;

    const reqStart = new Date(startDate).getTime();
    const reqEnd = endDate ? new Date(endDate).getTime() : Infinity;

    for (const p of periods) {
      const pStart = new Date(p.start_date).getTime();
      const pEnd = p.end_date ? new Date(p.end_date).getTime() : Infinity;

      // Two ranges [A, B] and [C, D] overlap if max(A, C) <= min(B, D)
      const maxStart = Math.max(reqStart, pStart);
      const minEnd = Math.min(reqEnd, pEnd);

      if (maxStart <= minEnd) {
        throw new Error(
          `Employment period (${startDate} to ${endDate ?? 'present'}) overlaps with existing period (${p.start_date} to ${p.end_date ?? 'present'})`
        );
      }
    }
  }

  /**
   * Retrieves all employment periods for an employee in chronological order.
   */
  async getEmploymentPeriods(
    employeeId: number,
    trx: Knex.Transaction | Knex = this.knex
  ): Promise<EmploymentPeriod[]> {
    return trx('employment_periods')
      .where({ employee_id: employeeId })
      .orderBy('start_date', 'asc');
  }

  /**
   * Retrieves an employee by ID.
   */
  async getEmployeeById(
    employeeId: number,
    trx: Knex.Transaction | Knex = this.knex
  ): Promise<Employee | undefined> {
    return trx('employees').where({ id: employeeId }).first();
  }
}
