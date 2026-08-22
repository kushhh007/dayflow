import type { Knex } from 'knex';
import db from '../db/knex.js';

export type AttendanceStatus =
  | 'PRESENT'
  | 'HALF_DAY'
  | 'ABSENT'
  | 'LEAVE'
  | 'PAID'
  | 'SICK'
  | 'UNPAID';

export type CorrectionRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface AttendanceRecord {
  id: number;
  employee_id: number;
  date: string;
  status: AttendanceStatus;
  check_in: Date | null;
  check_out: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface AttendanceCorrectionRequest {
  id: number;
  attendance_id: number;
  employee_id: number;
  requested_status: AttendanceStatus;
  reason: string;
  status: CorrectionRequestStatus;
  reviewed_by: number | null;
  reviewed_at: Date | null;
  created_at: Date;
}

export class AttendanceService {
  constructor(private knex: Knex = db) {}

  /**
   * Records or updates daily attendance for an employee on a given date.
   */
  async markAttendance(
    employeeId: number,
    date: string,
    status: AttendanceStatus,
    checkIn?: Date | string | null,
    checkOut?: Date | string | null,
    externalTrx?: Knex.Transaction
  ): Promise<AttendanceRecord> {
    const runInTrx = async (trx: Knex.Transaction) => {
      // Check if employee exists and is active on that date
      const employee = await trx('employees').where({ id: employeeId }).first();
      if (!employee) {
        throw new Error(`Employee with ID ${employeeId} not found`);
      }

      // Check if record exists
      const existing = await trx('attendance')
        .where({ employee_id: employeeId, date })
        .first();

      if (existing) {
        const [updated] = await trx('attendance')
          .where({ id: existing.id })
          .update({
            status,
            check_in: checkIn !== undefined ? checkIn : existing.check_in,
            check_out: checkOut !== undefined ? checkOut : existing.check_out,
            updated_at: trx.fn.now()
          })
          .returning('*');
        return updated;
      } else {
        const [inserted] = await trx('attendance')
          .insert({
            employee_id: employeeId,
            date,
            status,
            check_in: checkIn ?? null,
            check_out: checkOut ?? null
          })
          .returning('*');
        return inserted;
      }
    };

    if (externalTrx) {
      return runInTrx(externalTrx);
    }
    return this.knex.transaction(runInTrx);
  }

  /**
   * Records check-in for an employee on a given date.
   */
  async recordCheckIn(
    employeeId: number,
    date: string,
    checkInTime: Date | string = new Date(),
    externalTrx?: Knex.Transaction
  ): Promise<AttendanceRecord> {
    return this.markAttendance(employeeId, date, 'PRESENT', checkInTime, null, externalTrx);
  }

  /**
   * Records check-out for an employee on a given date.
   */
  async recordCheckOut(
    employeeId: number,
    date: string,
    checkOutTime: Date | string = new Date(),
    externalTrx?: Knex.Transaction
  ): Promise<AttendanceRecord> {
    const runInTrx = async (trx: Knex.Transaction) => {
      const existing = await trx('attendance')
        .where({ employee_id: employeeId, date })
        .first();

      if (!existing) {
        throw new Error(`Cannot check out: no attendance record found for employee ${employeeId} on ${date}`);
      }

      const [updated] = await trx('attendance')
        .where({ id: existing.id })
        .update({
          check_out: checkOutTime,
          updated_at: trx.fn.now()
        })
        .returning('*');
      return updated;
    };

    if (externalTrx) {
      return runInTrx(externalTrx);
    }
    return this.knex.transaction(runInTrx);
  }

  /**
   * Creates an attendance correction request.
   */
  async createCorrectionRequest(
    attendanceId: number,
    employeeId: number,
    requestedStatus: AttendanceStatus,
    reason: string,
    externalTrx?: Knex.Transaction
  ): Promise<AttendanceCorrectionRequest> {
    const runInTrx = async (trx: Knex.Transaction) => {
      const attendance = await trx('attendance').where({ id: attendanceId }).first();
      if (!attendance) {
        throw new Error(`Attendance record ${attendanceId} not found`);
      }
      if (attendance.employee_id !== employeeId) {
        throw new Error(`Attendance record ${attendanceId} does not belong to employee ${employeeId}`);
      }

      // Pre-validation rule: LEAVE -> PRESENT correction is prohibited by spec
      if (attendance.status === 'LEAVE' && requestedStatus === 'PRESENT') {
        throw new Error('Correction from LEAVE to PRESENT is strictly prohibited');
      }

      const [request] = await trx('attendance_correction_requests')
        .insert({
          attendance_id: attendanceId,
          employee_id: employeeId,
          requested_status: requestedStatus,
          reason,
          status: 'PENDING'
        })
        .returning('*');

      return request;
    };

    if (externalTrx) {
      return runInTrx(externalTrx);
    }
    return this.knex.transaction(runInTrx);
  }

  /**
   * Atomically approves an attendance correction request:
   * 1. Validates request status is PENDING
   * 2. Enforces LEAVE -> PRESENT prohibition
   * 3. Updates attendance_correction_requests (status = APPROVED, reviewed_by, reviewed_at)
   * 4. Updates attendance (status = requested_status)
   */
  async approveCorrectionRequest(
    requestId: number,
    reviewerId: number,
    externalTrx?: Knex.Transaction
  ): Promise<{ request: AttendanceCorrectionRequest; attendance: AttendanceRecord }> {
    const runInTrx = async (trx: Knex.Transaction) => {
      const request = await trx('attendance_correction_requests')
        .where({ id: requestId })
        .first();

      if (!request) {
        throw new Error(`Correction request with ID ${requestId} not found`);
      }
      if (request.status !== 'PENDING') {
        throw new Error(`Cannot approve correction request ${requestId}: status is ${request.status}`);
      }

      const attendance = await trx('attendance')
        .where({ id: request.attendance_id })
        .first();

      if (!attendance) {
        throw new Error(`Target attendance record ${request.attendance_id} not found`);
      }

      // Enforce v4.5 locked rule: LEAVE -> PRESENT correction is prohibited
      if (attendance.status === 'LEAVE' && request.requested_status === 'PRESENT') {
        throw new Error('Correction from LEAVE to PRESENT is strictly prohibited');
      }

      // Update correction request record
      const [updatedRequest] = await trx('attendance_correction_requests')
        .where({ id: requestId })
        .update({
          status: 'APPROVED',
          reviewed_by: reviewerId,
          reviewed_at: trx.fn.now()
        })
        .returning('*');

      // Atomically update target attendance record
      const [updatedAttendance] = await trx('attendance')
        .where({ id: request.attendance_id })
        .update({
          status: request.requested_status,
          updated_at: trx.fn.now()
        })
        .returning('*');

      return { request: updatedRequest, attendance: updatedAttendance };
    };

    if (externalTrx) {
      return runInTrx(externalTrx);
    }
    return this.knex.transaction(runInTrx);
  }

  /**
   * Rejects an attendance correction request atomically.
   */
  async rejectCorrectionRequest(
    requestId: number,
    reviewerId: number,
    externalTrx?: Knex.Transaction
  ): Promise<AttendanceCorrectionRequest> {
    const runInTrx = async (trx: Knex.Transaction) => {
      const request = await trx('attendance_correction_requests')
        .where({ id: requestId })
        .first();

      if (!request) {
        throw new Error(`Correction request with ID ${requestId} not found`);
      }
      if (request.status !== 'PENDING') {
        throw new Error(`Cannot reject correction request ${requestId}: status is ${request.status}`);
      }

      const [updatedRequest] = await trx('attendance_correction_requests')
        .where({ id: requestId })
        .update({
          status: 'REJECTED',
          reviewed_by: reviewerId,
          reviewed_at: trx.fn.now()
        })
        .returning('*');

      return updatedRequest;
    };

    if (externalTrx) {
      return runInTrx(externalTrx);
    }
    return this.knex.transaction(runInTrx);
  }

  /**
   * Retrieves attendance records for an employee within a date range.
   */
  async getAttendanceByDateRange(
    employeeId: number,
    startDate: string,
    endDate: string,
    trx: Knex.Transaction | Knex = this.knex
  ): Promise<AttendanceRecord[]> {
    return trx('attendance')
      .where({ employee_id: employeeId })
      .whereBetween('date', [startDate, endDate])
      .orderBy('date', 'asc');
  }
}
