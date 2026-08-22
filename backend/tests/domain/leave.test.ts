import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Knex } from 'knex';
import { createTestDb, runMigrations } from '../setup.js';
import { LeaveService } from '../../src/domain/leave.service.js';
import { EmployeeService } from '../../src/domain/employee.service.js';

function toDateStr(d: string | Date | null): string | null {
  if (!d) return null;
  if (typeof d === 'string') return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

describe('Phase 5 - Leave Domain Logic & Atomic Transactions', () => {
  let db: Knex;
  let leaveService: LeaveService;
  let employeeService: EmployeeService;
  let employeeId: number;
  let adminId: number;
  let paidLeaveTypeId: number;

  beforeEach(async () => {
    db = createTestDb();
    await runMigrations(db);
    leaveService = new LeaveService(db);
    employeeService = new EmployeeService(db);

    const emp = await employeeService.createEmployee({
      employee_id: 'EMP-LV-01',
      first_name: 'Bob',
      last_name: 'Leave',
      email: 'bob.leave@example.com',
      join_date: '2026-01-01',
      password_hash: 'hash'
    });
    employeeId = emp.id;

    const admin = await employeeService.createEmployee({
      employee_id: 'ADMIN-LV-01',
      first_name: 'Admin',
      last_name: 'User',
      email: 'admin.lv@example.com',
      role: 'ADMIN',
      join_date: '2026-01-01',
      password_hash: 'hash'
    });
    adminId = admin.id;

    const lt = await leaveService.createLeaveType('Paid Leave', true);
    paidLeaveTypeId = lt.id;
  });

  afterEach(async () => {
    await db.destroy();
  });

  it('allocates leave and submits a leave request', async () => {
    await leaveService.allocateLeave(employeeId, paidLeaveTypeId, 2026, 12);

    const req = await leaveService.submitLeaveRequest(
      employeeId,
      paidLeaveTypeId,
      '2026-04-10',
      '2026-04-12',
      'Family event'
    );

    expect(req.id).toBeDefined();
    expect(req.status).toBe('PENDING');
    expect(toDateStr(req.start_date)).toBe('2026-04-10');
    expect(toDateStr(req.end_date)).toBe('2026-04-12');
  });

  it('atomically approves leave: increments used balance and marks attendance as LEAVE', async () => {
    // 1. Allocate 10 days
    await leaveService.allocateLeave(employeeId, paidLeaveTypeId, 2026, 10);

    // 2. Request 3 days (Apr 10 to Apr 12)
    const req = await leaveService.submitLeaveRequest(
      employeeId,
      paidLeaveTypeId,
      '2026-04-10',
      '2026-04-12',
      'Vacation'
    );

    // 3. Approve atomically
    const { request: approved, allocation } = await leaveService.approveLeaveRequest(req.id, adminId);

    expect(approved.status).toBe('APPROVED');
    expect(approved.reviewed_by).toBe(adminId);
    expect(allocation.used_days).toBe(3);

    // 4. Verify attendance created as LEAVE for all 3 days
    const attendanceRecords = await db('attendance')
      .where({ employee_id: employeeId })
      .orderBy('date', 'asc');

    expect(attendanceRecords).toHaveLength(3);
    for (const att of attendanceRecords) {
      expect(att.status).toBe('LEAVE');
    }
  });

  it('rejects approval when leave balance is insufficient and leaves state unchanged', async () => {
    // Allocate only 2 days
    await leaveService.allocateLeave(employeeId, paidLeaveTypeId, 2026, 2);

    // Request 4 days (Apr 10 to Apr 13)
    const req = await leaveService.submitLeaveRequest(
      employeeId,
      paidLeaveTypeId,
      '2026-04-10',
      '2026-04-13',
      'Extended trip'
    );

    // Attempt to approve
    await expect(
      leaveService.approveLeaveRequest(req.id, adminId)
    ).rejects.toThrow(/Insufficient leave balance: requested 4 days, but only 2 days available/);

    // Verify allocation remains 0 used
    const [alloc] = await leaveService.getAllocations(employeeId, 2026);
    expect(alloc.used_days).toBe(0);

    // Verify request remains PENDING
    const [savedReq] = await leaveService.getLeaveRequests(employeeId);
    expect(savedReq.status).toBe('PENDING');

    // Verify no attendance records were created
    const attCount = await db('attendance').where({ employee_id: employeeId });
    expect(attCount).toHaveLength(0);
  });

  it('rejects overlapping leave requests against already approved leaves', async () => {
    await leaveService.allocateLeave(employeeId, paidLeaveTypeId, 2026, 15);

    // First leave: Apr 10 to Apr 15 (approved)
    const req1 = await leaveService.submitLeaveRequest(
      employeeId,
      paidLeaveTypeId,
      '2026-04-10',
      '2026-04-15'
    );
    await leaveService.approveLeaveRequest(req1.id, adminId);

    // Second leave: Apr 12 to Apr 18 (overlaps!)
    await expect(
      leaveService.submitLeaveRequest(
        employeeId,
        paidLeaveTypeId,
        '2026-04-12',
        '2026-04-18'
      )
    ).rejects.toThrow(/overlaps with existing approved leave/);
  });

  it('atomically rejects a leave request without modifying allocation or attendance', async () => {
    await leaveService.allocateLeave(employeeId, paidLeaveTypeId, 2026, 10);

    const req = await leaveService.submitLeaveRequest(
      employeeId,
      paidLeaveTypeId,
      '2026-05-01',
      '2026-05-03',
      'Personal'
    );

    const rejected = await leaveService.rejectLeaveRequest(req.id, adminId);
    expect(rejected.status).toBe('REJECTED');
    expect(rejected.reviewed_by).toBe(adminId);

    // Allocation should remain 0 used
    const [alloc] = await leaveService.getAllocations(employeeId, 2026);
    expect(alloc.used_days).toBe(0);

    // No attendance created
    const att = await db('attendance').where({ employee_id: employeeId });
    expect(att).toHaveLength(0);
  });
});
