import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, runMigrations, rollbackMigrations } from './setup.js';
import type { Knex } from 'knex';

describe('Phase 1 - Database Schema & Migrations', () => {
  let db: Knex;

  beforeEach(async () => {
    db = createTestDb();
    await runMigrations(db);
  });

  afterEach(async () => {
    await db.destroy();
  });

  it('creates all 10 domain tables', async () => {
    const tables = [
      'employees',
      'employment_periods',
      'attendance',
      'attendance_correction_requests',
      'leave_types',
      'leave_allocations',
      'leave_requests',
      'salary_structures',
      'payroll_runs',
      'payslips'
    ];

    for (const table of tables) {
      const exists = await db.schema.hasTable(table);
      expect(exists, `Table ${table} should exist`).toBe(true);
    }
  });

  it('verifies employees table columns and constraints', async () => {
    const hasId = await db.schema.hasColumn('employees', 'id');
    const hasEmpId = await db.schema.hasColumn('employees', 'employee_id');
    const hasFirstName = await db.schema.hasColumn('employees', 'first_name');
    const hasLastName = await db.schema.hasColumn('employees', 'last_name');
    const hasEmail = await db.schema.hasColumn('employees', 'email');
    const hasRole = await db.schema.hasColumn('employees', 'role');
    const hasStatus = await db.schema.hasColumn('employees', 'status');
    const hasJoinDate = await db.schema.hasColumn('employees', 'join_date');
    const hasPasswordHash = await db.schema.hasColumn('employees', 'password_hash');
    const hasMustChangePassword = await db.schema.hasColumn('employees', 'must_change_password');

    expect(hasId).toBe(true);
    expect(hasEmpId).toBe(true);
    expect(hasFirstName).toBe(true);
    expect(hasLastName).toBe(true);
    expect(hasEmail).toBe(true);
    expect(hasRole).toBe(true);
    expect(hasStatus).toBe(true);
    expect(hasJoinDate).toBe(true);
    expect(hasPasswordHash).toBe(true);
    expect(hasMustChangePassword).toBe(true);
  });

  it('verifies employment_periods table columns', async () => {
    const hasId = await db.schema.hasColumn('employment_periods', 'id');
    const hasEmpId = await db.schema.hasColumn('employment_periods', 'employee_id');
    const hasStart = await db.schema.hasColumn('employment_periods', 'start_date');
    const hasEnd = await db.schema.hasColumn('employment_periods', 'end_date');

    expect(hasId).toBe(true);
    expect(hasEmpId).toBe(true);
    expect(hasStart).toBe(true);
    expect(hasEnd).toBe(true);
  });

  it('verifies attendance and correction tables', async () => {
    expect(await db.schema.hasColumn('attendance', 'status')).toBe(true);
    expect(await db.schema.hasColumn('attendance', 'date')).toBe(true);
    expect(await db.schema.hasColumn('attendance_correction_requests', 'requested_status')).toBe(true);
    expect(await db.schema.hasColumn('attendance_correction_requests', 'reason')).toBe(true);
  });

  it('verifies leave tables', async () => {
    expect(await db.schema.hasColumn('leave_types', 'name')).toBe(true);
    expect(await db.schema.hasColumn('leave_types', 'is_paid')).toBe(true);
    expect(await db.schema.hasColumn('leave_allocations', 'total_days')).toBe(true);
    expect(await db.schema.hasColumn('leave_allocations', 'used_days')).toBe(true);
    expect(await db.schema.hasColumn('leave_requests', 'status')).toBe(true);
  });

  it('verifies salary, payroll_runs, and payslips tables', async () => {
    expect(await db.schema.hasColumn('salary_structures', 'base_salary_paise')).toBe(true);
    expect(await db.schema.hasColumn('salary_structures', 'hra_percentage')).toBe(true);
    expect(await db.schema.hasColumn('salary_structures', 'da_percentage')).toBe(true);
    expect(await db.schema.hasColumn('payroll_runs', 'status')).toBe(true);
    expect(await db.schema.hasColumn('payslips', 'base_salary_paise')).toBe(true);
    expect(await db.schema.hasColumn('payslips', 'net_salary_paise')).toBe(true);
    expect(await db.schema.hasColumn('payslips', 'is_finalized')).toBe(true);
  });

  it('enforces employee status and role check constraints', async () => {
    await db('employees').insert({
      employee_id: 'EMP001',
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@example.com',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      join_date: '2026-01-01',
      password_hash: 'hash123',
      must_change_password: true
    });

    // Invalid status should fail
    await expect(
      db('employees').insert({
        employee_id: 'EMP002',
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane@example.com',
        role: 'EMPLOYEE',
        status: 'UNKNOWN_STATUS',
        join_date: '2026-01-01',
        password_hash: 'hash123'
      })
    ).rejects.toThrow();

    // Invalid role should fail
    await expect(
      db('employees').insert({
        employee_id: 'EMP003',
        first_name: 'Bob',
        last_name: 'Smith',
        email: 'bob@example.com',
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        join_date: '2026-01-01',
        password_hash: 'hash123'
      })
    ).rejects.toThrow();
  });

  it('enforces employment_periods date check constraint', async () => {
    const [emp] = await db('employees').insert({
      employee_id: 'EMP004',
      first_name: 'Alice',
      last_name: 'Wonder',
      email: 'alice@example.com',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      join_date: '2026-01-01',
      password_hash: 'hash123'
    }).returning('*');

    // end_date < start_date should fail
    await expect(
      db('employment_periods').insert({
        employee_id: emp.id,
        start_date: '2026-06-01',
        end_date: '2026-05-01'
      })
    ).rejects.toThrow();
  });

  it('enforces leave_allocations used_days <= total_days check constraint', async () => {
    const [emp] = await db('employees').insert({
      employee_id: 'EMP005',
      first_name: 'Charlie',
      last_name: 'Brown',
      email: 'charlie@example.com',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      join_date: '2026-01-01',
      password_hash: 'hash123'
    }).returning('*');

    const [leaveType] = await db('leave_types').insert({
      name: 'Paid Leave',
      is_paid: true
    }).returning('*');

    // used_days > total_days should fail
    await expect(
      db('leave_allocations').insert({
        employee_id: emp.id,
        leave_type_id: leaveType.id,
        year: 2026,
        total_days: 10,
        used_days: 15
      })
    ).rejects.toThrow();
  });

  it('enforces salary_structures positive base salary constraint', async () => {
    const [emp] = await db('employees').insert({
      employee_id: 'EMP006',
      first_name: 'David',
      last_name: 'Miller',
      email: 'david@example.com',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      join_date: '2026-01-01',
      password_hash: 'hash123'
    }).returning('*');

    // base_salary_paise <= 0 should fail
    await expect(
      db('salary_structures').insert({
        employee_id: emp.id,
        base_salary_paise: -50000,
        hra_percentage: 40,
        da_percentage: 10,
        effective_from: '2026-01-01'
      })
    ).rejects.toThrow();
  });

  it('successfully rolls back migrations', async () => {
    await rollbackMigrations(db);
    const exists = await db.schema.hasTable('employees');
    expect(exists).toBe(false);
  });
});
