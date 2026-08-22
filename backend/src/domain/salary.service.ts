import type { Knex } from 'knex';
import db from '../db/knex.js';

export interface SalaryStructure {
  id: number;
  employee_id: number;
  base_salary_paise: bigint | string;
  hra_percentage: number;
  da_percentage: number;
  effective_from: string;
  created_at: Date;
}

export interface SetSalaryStructureInput {
  employee_id: number;
  base_salary_paise: bigint | number;
  hra_percentage: number;
  da_percentage: number;
  effective_from: string;
}

export class SalaryService {
  constructor(private knex: Knex = db) {}

  /**
   * Defines or updates the salary structure for an employee starting from an effective date.
   */
  async setSalaryStructure(
    input: SetSalaryStructureInput,
    externalTrx?: Knex.Transaction
  ): Promise<SalaryStructure> {
    const runInTrx = async (trx: Knex.Transaction) => {
      // Validate employee exists
      const emp = await trx('employees').where({ id: input.employee_id }).first();
      if (!emp) {
        throw new Error(`Employee with ID ${input.employee_id} not found`);
      }

      if (BigInt(input.base_salary_paise) <= 0n) {
        throw new Error('Base salary in paise must be strictly positive');
      }
      if (input.hra_percentage < 0 || input.da_percentage < 0) {
        throw new Error('HRA and DA percentages must be non-negative');
      }

      const existing = await trx('salary_structures')
        .where({
          employee_id: input.employee_id,
          effective_from: input.effective_from
        })
        .first();

      if (existing) {
        const [updated] = await trx('salary_structures')
          .where({ id: existing.id })
          .update({
            base_salary_paise: BigInt(input.base_salary_paise).toString(),
            hra_percentage: input.hra_percentage,
            da_percentage: input.da_percentage
          })
          .returning('*');
        return updated;
      }

      const [inserted] = await trx('salary_structures')
        .insert({
          employee_id: input.employee_id,
          base_salary_paise: BigInt(input.base_salary_paise).toString(),
          hra_percentage: input.hra_percentage,
          da_percentage: input.da_percentage,
          effective_from: input.effective_from
        })
        .returning('*');

      return inserted;
    };

    if (externalTrx) {
      return runInTrx(externalTrx);
    }
    return this.knex.transaction(runInTrx);
  }

  /**
   * Retrieves the active salary structure for an employee applicable on a given date.
   */
  async getEffectiveSalaryStructure(
    employeeId: number,
    asOfDate: string,
    trx: Knex.Transaction | Knex = this.knex
  ): Promise<SalaryStructure | undefined> {
    return trx('salary_structures')
      .where({ employee_id: employeeId })
      .where('effective_from', '<=', asOfDate)
      .orderBy('effective_from', 'desc')
      .first();
  }

  /**
   * Retrieves all historical salary structures for an employee.
   */
  async getSalaryHistory(
    employeeId: number,
    trx: Knex.Transaction | Knex = this.knex
  ): Promise<SalaryStructure[]> {
    return trx('salary_structures')
      .where({ employee_id: employeeId })
      .orderBy('effective_from', 'desc');
  }
}
