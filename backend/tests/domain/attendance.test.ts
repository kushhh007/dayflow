import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Knex } from 'knex';
import { createTestDb, runMigrations } from '../setup.js';
import { AttendanceService } from '../../src/domain/attendance.service.js';
import { EmployeeService } from '../../src/domain/employee.service.js';

function toDateStr(d: string | Date | null): string | null {
  if (!d) return null;
  if (typeof d === 'string') return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

describe('Phase 3 & 4 - Attendance & AttendanceCorrection Domain Logic', () => {
  let db: Knex;
  let attendanceService: AttendanceService;
  let employeeService: EmployeeService;
  let employeeId: number;
  let adminId: number;

  beforeEach(async () => {
    db = createTestDb();
    await runMigrations(db);
    attendanceService = new AttendanceService(db);
    employeeService = new EmployeeService(db);

    const emp = await employeeService.createEmployee({
      employee_id: 'EMP-ATT-01',
      first_name: 'Alice',
      last_name: 'Smith',
      email: 'alice.smith@example.com',
      join_date: '2026-01-01',
      password_hash: 'hash'
    });
    employeeId = emp.id;

    const admin = await employeeService.createEmployee({
      employee_id: 'ADMIN-01',
      first_name: 'Admin',
      last_name: 'User',
      email: 'admin@example.com',
      role: 'ADMIN',
      join_date: '2026-01-01',
      password_hash: 'hash'
    });
    adminId = admin.id;
  });

  afterEach(async () => {
    await db.destroy();
  });

  it('records check-in and check-out for an employee', async () => {
    const checkInTime = new Date('2026-03-10T09:00:00Z');
    const att = await attendanceService.recordCheckIn(employeeId, '2026-03-10', checkInTime);

    expect(att.employee_id).toBe(employeeId);
    expect(toDateStr(att.date)).toBe('2026-03-10');
    expect(att.status).toBe('PRESENT');
    expect(att.check_in).toBeDefined();

    const checkOutTime = new Date('2026-03-10T18:00:00Z');
    const updated = await attendanceService.recordCheckOut(employeeId, '2026-03-10', checkOutTime);
    expect(updated.check_out).toBeDefined();
  });

  it('marks various valid attendance statuses', async () => {
    const halfDay = await attendanceService.markAttendance(employeeId, '2026-03-11', 'HALF_DAY');
    expect(halfDay.status).toBe('HALF_DAY');

    const absent = await attendanceService.markAttendance(employeeId, '2026-03-12', 'ABSENT');
    expect(absent.status).toBe('ABSENT');

    const leave = await attendanceService.markAttendance(employeeId, '2026-03-13', 'LEAVE');
    expect(leave.status).toBe('LEAVE');
  });

  it('creates an attendance correction request and atomically approves it', async () => {
    // 1. Mark initial attendance as ABSENT
    const initial = await attendanceService.markAttendance(employeeId, '2026-03-14', 'ABSENT');

    // 2. Employee submits correction request to PRESENT
    const req = await attendanceService.createCorrectionRequest(
      initial.id,
      employeeId,
      'PRESENT',
      'Forgot to check in, was working in office'
    );

    expect(req.status).toBe('PENDING');
    expect(req.requested_status).toBe('PRESENT');

    // 3. Admin approves request atomically
    const { request: approvedReq, attendance: updatedAtt } =
      await attendanceService.approveCorrectionRequest(req.id, adminId);

    expect(approvedReq.status).toBe('APPROVED');
    expect(approvedReq.reviewed_by).toBe(adminId);
    expect(updatedAtt.status).toBe('PRESENT');

    // 4. Verify in database
    const dbAtt = await db('attendance').where({ id: initial.id }).first();
    expect(dbAtt.status).toBe('PRESENT');
  });

  it('rejects an attendance correction request atomically without modifying attendance', async () => {
    const initial = await attendanceService.markAttendance(employeeId, '2026-03-15', 'ABSENT');
    const req = await attendanceService.createCorrectionRequest(
      initial.id,
      employeeId,
      'PRESENT',
      'No proof provided'
    );

    const rejected = await attendanceService.rejectCorrectionRequest(req.id, adminId);
    expect(rejected.status).toBe('REJECTED');
    expect(rejected.reviewed_by).toBe(adminId);

    // Attendance must remain ABSENT
    const dbAtt = await db('attendance').where({ id: initial.id }).first();
    expect(dbAtt.status).toBe('ABSENT');
  });

  it('prohibits LEAVE -> PRESENT correction request and approval per v4.5 spec', async () => {
    // Attendance created as LEAVE (e.g. from approved leave)
    const leaveAtt = await attendanceService.markAttendance(employeeId, '2026-03-16', 'LEAVE');

    // Attempting to create or approve LEAVE -> PRESENT must be prohibited
    await expect(
      attendanceService.createCorrectionRequest(
        leaveAtt.id,
        employeeId,
        'PRESENT',
        'Want to cancel leave'
      )
    ).rejects.toThrow(/Correction from LEAVE to PRESENT is strictly prohibited/);
  });

  it('rejects approving an already processed correction request', async () => {
    const att = await attendanceService.markAttendance(employeeId, '2026-03-17', 'HALF_DAY');
    const req = await attendanceService.createCorrectionRequest(
      att.id,
      employeeId,
      'PRESENT',
      'Completed full day'
    );

    await attendanceService.approveCorrectionRequest(req.id, adminId);

    // Attempting to approve again
    await expect(
      attendanceService.approveCorrectionRequest(req.id, adminId)
    ).rejects.toThrow(/status is APPROVED/);
  });

  it('retrieves attendance records within a date range', async () => {
    await attendanceService.markAttendance(employeeId, '2026-03-01', 'PRESENT');
    await attendanceService.markAttendance(employeeId, '2026-03-02', 'PRESENT');
    await attendanceService.markAttendance(employeeId, '2026-03-03', 'ABSENT');

    const records = await attendanceService.getAttendanceByDateRange(
      employeeId,
      '2026-03-01',
      '2026-03-02'
    );

    expect(records).toHaveLength(2);
    expect(toDateStr(records[0].date)).toBe('2026-03-01');
    expect(toDateStr(records[1].date)).toBe('2026-03-02');
  });
});
