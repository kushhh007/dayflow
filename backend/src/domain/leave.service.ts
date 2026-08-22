import type { Knex } from 'knex';
import db from '../db/knex.js';
import type { AttendanceStatus } from './attendance.service.js';

export interface LeaveType {
  id: number;
  name: string;
  is_paid: boolean;
  created_at: Date;
}

export interface LeaveAllocation {
  id: number;
  employee_id: number;
  leave_type_id: number;
  year: number;
  total_days: number;
  used_days: number;
  created_at: Date;
  updated_at: Date;
}

export type LeaveRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface LeaveRequest {
  id: number;
  employee_id: number;
  leave_type_id: number;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: LeaveRequestStatus;
  reviewed_by: number | null;
  reviewed_at: Date | null;
  created_at: Date;
}

export class LeaveService {
  constructor(private knex: Knex = db) {}

  /**
   * Creates or ensures a leave type exists.
   */
  async createLeaveType(
    name: string,
    isPaid: boolean = true,
    trx: Knex.Transaction | Knex = this.knex
  ): Promise<LeaveType> {
    const [leaveType] = await trx('leave_types')
      .insert({ name, is_paid: isPaid })
      .returning('*');
    return leaveType;
  }

  /**
   * Sets or creates leave allocation for an employee.
   */
  async allocateLeave(
    employeeId: number,
    leaveTypeId: number,
    year: number,
    totalDays: number,
    trx: Knex.Transaction | Knex = this.knex
  ): Promise<LeaveAllocation> {
    const existing = await trx('leave_allocations')
      .where({ employee_id: employeeId, leave_type_id: leaveTypeId, year })
      .first();

    if (existing) {
      const [updated] = await trx('leave_allocations')
        .where({ id: existing.id })
        .update({ total_days: totalDays, updated_at: trx.fn.now() })
        .returning('*');
      return updated;
    }

    const [allocated] = await trx('leave_allocations')
      .insert({
        employee_id: employeeId,
        leave_type_id: leaveTypeId,
        year,
        total_days: totalDays,
        used_days: 0
      })
      .returning('*');
    return allocated;
  }

  /**
   * Calculates the number of calendar days between two dates inclusive.
   */
  private calculateDays(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = end.getTime() - start.getTime();
    if (diffTime < 0) {
      throw new Error(`End date (${endDate}) cannot be before start date (${startDate})`);
    }
    return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }

  /**
   * Submits a leave request in PENDING state after validating no overlap with existing approved leaves.
   */
  async submitLeaveRequest(
    employeeId: number,
    leaveTypeId: number,
    startDate: string,
    endDate: string,
    reason?: string,
    externalTrx?: Knex.Transaction
  ): Promise<LeaveRequest> {
    const runInTrx = async (trx: Knex.Transaction) => {
      // Validate employee exists
      const employee = await trx('employees').where({ id: employeeId }).first();
      if (!employee) {
        throw new Error(`Employee with ID ${employeeId} not found`);
      }

      // Validate leave type exists
      const leaveType = await trx('leave_types').where({ id: leaveTypeId }).first();
      if (!leaveType) {
        throw new Error(`Leave type with ID ${leaveTypeId} not found`);
      }

      // Check dates
      this.calculateDays(startDate, endDate);

      // Validate no overlap with already APPROVED leave requests
      await this.validateNoLeaveOverlap(employeeId, startDate, endDate, undefined, trx);

      const [request] = await trx('leave_requests')
        .insert({
          employee_id: employeeId,
          leave_type_id: leaveTypeId,
          start_date: startDate,
          end_date: endDate,
          reason: reason ?? null,
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
   * Checks whether the date range overlaps with any APPROVED leave for this employee.
   */
  async validateNoLeaveOverlap(
    employeeId: number,
    startDate: string,
    endDate: string,
    excludeRequestId?: number,
    trx: Knex.Transaction | Knex = this.knex
  ): Promise<void> {
    let query = trx('leave_requests')
      .where({ employee_id: employeeId, status: 'APPROVED' });

    if (excludeRequestId) {
      query = query.whereNot({ id: excludeRequestId });
    }

    const approvedLeaves = await query;
    const reqStart = new Date(startDate).getTime();
    const reqEnd = new Date(endDate).getTime();

    for (const leave of approvedLeaves) {
      const lStart = new Date(leave.start_date).getTime();
      const lEnd = new Date(leave.end_date).getTime();

      if (Math.max(reqStart, lStart) <= Math.min(reqEnd, lEnd)) {
        throw new Error(
          `Leave request (${startDate} to ${endDate}) overlaps with existing approved leave (${leave.start_date} to ${leave.end_date})`
        );
      }
    }
  }

  /**
   * Atomically approves a leave request:
   * 1. Validates pending status
   * 2. Atomically validates no leave overlap
   * 3. Atomically validates allocation balance (used_days + days <= total_days)
   * 4. Updates allocation balance (used_days = used_days + days)
   * 5. Updates request status to APPROVED with reviewer info
   * 6. Updates daily attendance to LEAVE for all days in the range
   * All wrapped in a single atomic transaction.
   */
  async approveLeaveRequest(
    requestId: number,
    reviewerId: number,
    externalTrx?: Knex.Transaction
  ): Promise<{ request: LeaveRequest; allocation: LeaveAllocation }> {
    const runInTrx = async (trx: Knex.Transaction) => {
      // 1. Fetch request (with row lock if supported)
      const request = await trx('leave_requests')
        .where({ id: requestId })
        .forUpdate()
        .first();

      if (!request) {
        throw new Error(`Leave request with ID ${requestId} not found`);
      }
      if (request.status !== 'PENDING') {
        throw new Error(`Cannot approve leave request ${requestId}: status is ${request.status}`);
      }

      // 2. Validate leave overlap
      await this.validateNoLeaveOverlap(
        request.employee_id,
        request.start_date,
        request.end_date,
        requestId,
        trx
      );

      // 3. Calculate days and fetch allocation
      const daysCount = this.calculateDays(request.start_date, request.end_date);
      const leaveYear = new Date(request.start_date).getFullYear();

      const allocation = await trx('leave_allocations')
        .where({
          employee_id: request.employee_id,
          leave_type_id: request.leave_type_id,
          year: leaveYear
        })
        .forUpdate()
        .first();

      if (!allocation) {
        throw new Error(
          `No leave allocation found for employee ${request.employee_id}, leave type ${request.leave_type_id}, year ${leaveYear}`
        );
      }

      const availableDays = allocation.total_days - allocation.used_days;
      if (availableDays < daysCount) {
        throw new Error(
          `Insufficient leave balance: requested ${daysCount} days, but only ${availableDays} days available`
        );
      }

      // 4. Update allocation balance
      const [updatedAllocation] = await trx('leave_allocations')
        .where({ id: allocation.id })
        .update({
          used_days: allocation.used_days + daysCount,
          updated_at: trx.fn.now()
        })
        .returning('*');

      // 5. Update request status to APPROVED
      const [updatedRequest] = await trx('leave_requests')
        .where({ id: requestId })
        .update({
          status: 'APPROVED',
          reviewed_by: reviewerId,
          reviewed_at: trx.fn.now()
        })
        .returning('*');

      // 6. Create/update attendance records to LEAVE for each day in date range
      const start = new Date(request.start_date);
      const end = new Date(request.end_date);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().slice(0, 10);
        const existingAtt = await trx('attendance')
          .where({ employee_id: request.employee_id, date: dateStr })
          .first();

        if (existingAtt) {
          await trx('attendance')
            .where({ id: existingAtt.id })
            .update({
              status: 'LEAVE',
              updated_at: trx.fn.now()
            });
        } else {
          await trx('attendance').insert({
            employee_id: request.employee_id,
            date: dateStr,
            status: 'LEAVE'
          });
        }
      }

      return { request: updatedRequest, allocation: updatedAllocation };
    };

    if (externalTrx) {
      return runInTrx(externalTrx);
    }
    return this.knex.transaction(runInTrx);
  }

  /**
   * Rejects a leave request atomically.
   */
  async rejectLeaveRequest(
    requestId: number,
    reviewerId: number,
    externalTrx?: Knex.Transaction
  ): Promise<LeaveRequest> {
    const runInTrx = async (trx: Knex.Transaction) => {
      const request = await trx('leave_requests')
        .where({ id: requestId })
        .forUpdate()
        .first();

      if (!request) {
        throw new Error(`Leave request with ID ${requestId} not found`);
      }
      if (request.status !== 'PENDING') {
        throw new Error(`Cannot reject leave request ${requestId}: status is ${request.status}`);
      }

      const [updatedRequest] = await trx('leave_requests')
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
   * Gets leave allocation for an employee for a given year.
   */
  async getAllocations(
    employeeId: number,
    year: number,
    trx: Knex.Transaction | Knex = this.knex
  ): Promise<LeaveAllocation[]> {
    return trx('leave_allocations')
      .where({ employee_id: employeeId, year });
  }

  /**
   * Gets leave requests for an employee.
   */
  async getLeaveRequests(
    employeeId: number,
    trx: Knex.Transaction | Knex = this.knex
  ): Promise<LeaveRequest[]> {
    return trx('leave_requests')
      .where({ employee_id: employeeId })
      .orderBy('start_date', 'desc');
  }
}
