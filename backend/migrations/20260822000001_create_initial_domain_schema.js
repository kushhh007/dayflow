/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  // 1. Employees
  await knex.schema.createTable('employees', (table) => {
    table.increments('id').primary();
    table.string('employee_id', 50).notNullable().unique();
    table.string('first_name', 100).notNullable();
    table.string('last_name', 100).notNullable();
    table.string('email', 255).notNullable().unique();
    table.string('department', 100).nullable();
    table.string('designation', 100).nullable();
    table.string('role', 20).notNullable().defaultTo('EMPLOYEE');
    table.string('status', 20).notNullable().defaultTo('ACTIVE');
    table.date('join_date').notNullable();
    table.string('password_hash', 255).notNullable();
    table.boolean('must_change_password').notNullable().defaultTo(true);
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.check(`"role" IN ('ADMIN', 'EMPLOYEE')`, [], 'chk_employees_role');
    table.check(`"status" IN ('ACTIVE', 'INACTIVE')`, [], 'chk_employees_status');
  });

  // 2. Employment Periods (Authoritative history)
  await knex.schema.createTable('employment_periods', (table) => {
    table.increments('id').primary();
    table.integer('employee_id').unsigned().notNullable()
      .references('id').inTable('employees').onDelete('CASCADE');
    table.date('start_date').notNullable();
    table.date('end_date').nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.index(['employee_id', 'start_date'], 'idx_employment_periods_emp_start');
    table.check(`"end_date" IS NULL OR "end_date" >= "start_date"`, [], 'chk_employment_periods_dates');
  });

  // 3. Attendance
  await knex.schema.createTable('attendance', (table) => {
    table.increments('id').primary();
    table.integer('employee_id').unsigned().notNullable()
      .references('id').inTable('employees').onDelete('CASCADE');
    table.date('date').notNullable();
    table.string('status', 20).notNullable();
    table.timestamp('check_in', { useTz: true }).nullable();
    table.timestamp('check_out', { useTz: true }).nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.unique(['employee_id', 'date'], 'uq_attendance_emp_date');
    table.check(`"status" IN ('PRESENT', 'HALF_DAY', 'ABSENT', 'LEAVE', 'PAID', 'SICK', 'UNPAID')`, [], 'chk_attendance_status');
  });

  // 4. Attendance Correction Requests
  await knex.schema.createTable('attendance_correction_requests', (table) => {
    table.increments('id').primary();
    table.integer('attendance_id').unsigned().notNullable()
      .references('id').inTable('attendance').onDelete('CASCADE');
    table.integer('employee_id').unsigned().notNullable()
      .references('id').inTable('employees').onDelete('CASCADE');
    table.string('requested_status', 20).notNullable();
    table.text('reason').notNullable();
    table.string('status', 20).notNullable().defaultTo('PENDING');
    table.integer('reviewed_by').unsigned().nullable()
      .references('id').inTable('employees').onDelete('SET NULL');
    table.timestamp('reviewed_at', { useTz: true }).nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.check(`"status" IN ('PENDING', 'APPROVED', 'REJECTED')`, [], 'chk_attendance_corr_status');
    table.check(`"requested_status" IN ('PRESENT', 'HALF_DAY', 'ABSENT', 'LEAVE', 'PAID', 'SICK', 'UNPAID')`, [], 'chk_attendance_corr_req_status');
  });

  // 5. Leave Types
  await knex.schema.createTable('leave_types', (table) => {
    table.increments('id').primary();
    table.string('name', 50).notNullable().unique();
    table.boolean('is_paid').notNullable().defaultTo(true);
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  // 6. Leave Allocations
  await knex.schema.createTable('leave_allocations', (table) => {
    table.increments('id').primary();
    table.integer('employee_id').unsigned().notNullable()
      .references('id').inTable('employees').onDelete('CASCADE');
    table.integer('leave_type_id').unsigned().notNullable()
      .references('id').inTable('leave_types').onDelete('CASCADE');
    table.integer('year').notNullable();
    table.integer('total_days').notNullable();
    table.integer('used_days').notNullable().defaultTo(0);
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.unique(['employee_id', 'leave_type_id', 'year'], 'uq_leave_allocations_emp_type_year');
    table.check(`"total_days" >= 0`, [], 'chk_leave_alloc_total_positive');
    table.check(`"used_days" >= 0`, [], 'chk_leave_alloc_used_positive');
    table.check(`"used_days" <= "total_days"`, [], 'chk_leave_alloc_used_lte_total');
  });

  // 7. Leave Requests
  await knex.schema.createTable('leave_requests', (table) => {
    table.increments('id').primary();
    table.integer('employee_id').unsigned().notNullable()
      .references('id').inTable('employees').onDelete('CASCADE');
    table.integer('leave_type_id').unsigned().notNullable()
      .references('id').inTable('leave_types').onDelete('CASCADE');
    table.date('start_date').notNullable();
    table.date('end_date').notNullable();
    table.text('reason').nullable();
    table.string('status', 20).notNullable().defaultTo('PENDING');
    table.integer('reviewed_by').unsigned().nullable()
      .references('id').inTable('employees').onDelete('SET NULL');
    table.timestamp('reviewed_at', { useTz: true }).nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.check(`"end_date" >= "start_date"`, [], 'chk_leave_requests_dates');
    table.check(`"status" IN ('PENDING', 'APPROVED', 'REJECTED')`, [], 'chk_leave_requests_status');
  });

  // 8. Salary Structures
  await knex.schema.createTable('salary_structures', (table) => {
    table.increments('id').primary();
    table.integer('employee_id').unsigned().notNullable()
      .references('id').inTable('employees').onDelete('CASCADE');
    table.bigInteger('base_salary_paise').notNullable();
    table.integer('hra_percentage').notNullable();
    table.integer('da_percentage').notNullable();
    table.date('effective_from').notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.unique(['employee_id', 'effective_from'], 'uq_salary_structures_emp_eff');
    table.check(`"base_salary_paise" > 0`, [], 'chk_salary_base_positive');
    table.check(`"hra_percentage" >= 0`, [], 'chk_salary_hra_nonneg');
    table.check(`"da_percentage" >= 0`, [], 'chk_salary_da_nonneg');
  });

  // 9. Payroll Runs
  await knex.schema.createTable('payroll_runs', (table) => {
    table.increments('id').primary();
    table.date('period_start').notNullable();
    table.date('period_end').notNullable();
    table.string('status', 20).notNullable().defaultTo('DRAFT');
    table.integer('created_by').unsigned().nullable()
      .references('id').inTable('employees').onDelete('SET NULL');
    table.timestamp('calculated_at', { useTz: true }).nullable();
    table.timestamp('finalized_at', { useTz: true }).nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.unique(['period_start', 'period_end'], 'uq_payroll_runs_period');
    table.check(`"period_end" >= "period_start"`, [], 'chk_payroll_runs_period');
    table.check(`"status" IN ('DRAFT', 'CALCULATED', 'FINALIZED')`, [], 'chk_payroll_runs_status');
  });

  // 10. Payslips
  await knex.schema.createTable('payslips', (table) => {
    table.increments('id').primary();
    table.integer('payroll_run_id').unsigned().notNullable()
      .references('id').inTable('payroll_runs').onDelete('CASCADE');
    table.integer('employee_id').unsigned().notNullable()
      .references('id').inTable('employees').onDelete('CASCADE');
    table.bigInteger('base_salary_paise').notNullable();
    table.bigInteger('hra_paise').notNullable();
    table.bigInteger('da_paise').notNullable();
    table.bigInteger('gross_salary_paise').notNullable();
    table.integer('working_days').notNullable();
    table.specificType('payable_days', 'numeric').notNullable();
    table.bigInteger('net_salary_paise').notNullable();
    table.boolean('is_finalized').notNullable().defaultTo(false);
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.unique(['payroll_run_id', 'employee_id'], 'uq_payslips_run_emp');
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('payslips');
  await knex.schema.dropTableIfExists('payroll_runs');
  await knex.schema.dropTableIfExists('salary_structures');
  await knex.schema.dropTableIfExists('leave_requests');
  await knex.schema.dropTableIfExists('leave_allocations');
  await knex.schema.dropTableIfExists('leave_types');
  await knex.schema.dropTableIfExists('attendance_correction_requests');
  await knex.schema.dropTableIfExists('attendance');
  await knex.schema.dropTableIfExists('employment_periods');
  await knex.schema.dropTableIfExists('employees');
}
