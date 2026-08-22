import { Prisma } from '@prisma/client';
import { HttpError } from '../lib/http.js';
import { prisma } from '../lib/prisma.js';
import { writeAudit, type AuditEntry } from '../lib/audit.js';
import type { AuthedUser } from '../middleware/auth.js';
import {
  calendarDaysInclusive,
  companyToday,
  eachDayInclusive,
  isWeekend
} from '../lib/company-time.js';

async function requireEmployeeId(viewer: AuthedUser): Promise<string> {
  if (!viewer.employeeId) {
    throw new HttpError(403, 'No employee profile linked to this account');
  }
  return viewer.employeeId;
}

function toDate(dateString: string): Date {
  return new Date(`${dateString}T00:00:00.000Z`);
}

function dayString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function getTypes() {
  return prisma.leaveType.findMany({ orderBy: { code: 'asc' } });
}

export async function balances(viewer: AuthedUser, employeeIdParam?: string, year?: number) {
  let employeeId: string;
  if (viewer.role === 'ADMIN' && employeeIdParam) {
    employeeId = employeeIdParam;
  } else {
    employeeId = await requireEmployeeId(viewer);
  }

  const targetYear = year ?? new Date().getUTCFullYear();
  const [types, allocations] = await Promise.all([
    prisma.leaveType.findMany({ orderBy: { code: 'asc' } }),
    prisma.leaveAllocation.findMany({
      where: { employeeId, year: targetYear },
      include: { type: { select: { code: true } } }
    })
  ]);

  const allocationByCode = new Map(allocations.map((a) => [a.type.code, a]));

  return {
    year: targetYear,
    balances: types.map((t) => {
      const allocation = allocationByCode.get(t.code);
      return {
        type: t.code,
        requiresAllocation: t.requiresAllocation,
        allocatedDays: allocation ? Number(allocation.allocatedDays) : null,
        approvedOrUsedDays: allocation ? Number(allocation.approvedOrUsedDays) : 0,
        availableDays: allocation
          ? Number(allocation.allocatedDays) - Number(allocation.approvedOrUsedDays)
          : null
      };
    })
  };
}

export interface CreateLeaveInput {
  typeCode: 'PAID' | 'SICK' | 'UNPAID';
  startDate: string;
  endDate: string;
  reason: string;
  attachmentUrl?: string;
}

export async function createRequest(viewer: AuthedUser, input: CreateLeaveInput) {
  const employeeId = await requireEmployeeId(viewer);

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { status: true, joinDate: true }
  });
  if (!employee || employee.status !== 'ACTIVE') {
    throw new HttpError(403, 'Inactive employees cannot submit leave requests');
  }

  const type = await prisma.leaveType.findUnique({ where: { code: input.typeCode } });
  if (!type) throw new HttpError(404, 'Leave type not found');
  if (type.requiresAttachment && !input.attachmentUrl) {
    throw new HttpError(400, `${input.typeCode} leave requires an attachment`);
  }

  const start = toDate(input.startDate);
  const end = toDate(input.endDate);
  if (end < start) throw new HttpError(400, 'End date cannot precede start date');

  if (start.getUTCFullYear() !== end.getUTCFullYear()) {
    throw new HttpError(400, 'Cross-calendar-year leave requests are not allowed');
  }

  if (start < employee.joinDate) {
    throw new HttpError(400, 'Leave cannot start before the join date');
  }

  const totalDays = calendarDaysInclusive(start, end);
  const year = start.getUTCFullYear();

  return prisma.$transaction(async (tx) => {
    const overlap = await tx.leaveRequest.findFirst({
      where: {
        employeeId,
        status: { in: ['PENDING', 'APPROVED'] },
        startDate: { lte: end },
        endDate: { gte: start }
      }
    });
    if (overlap) {
      throw new HttpError(409, 'Overlaps an existing pending or approved request');
    }

    return tx.leaveRequest.create({
      data: {
        employeeId,
        leaveTypeId: type.id,
        year,
        startDate: start,
        endDate: end,
        totalDays,
        reason: input.reason,
        attachmentUrl: input.attachmentUrl
      }
    });
  });
}

export interface ListRequestsInput {
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  employeeId?: string;
  limit: number;
  offset: number;
}

export async function listRequests(viewer: AuthedUser, query: ListRequestsInput) {
  const where: Prisma.LeaveRequestWhereInput = {};
  if (viewer.role === 'EMPLOYEE') {
    where.employeeId = viewer.employeeId ?? 'no-profile';
  } else if (query.employeeId) {
    where.employeeId = query.employeeId;
  }
  if (query.status) where.status = query.status;

  const [total, rows] = await Promise.all([
    prisma.leaveRequest.count({ where }),
    prisma.leaveRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: query.limit,
      skip: query.offset,
      include: {
        employee: { select: { firstName: true, lastName: true } },
        type: { select: { code: true } }
      }
    })
  ]);

  return { requests: rows, meta: { total, limit: query.limit, offset: query.offset } };
}

export async function cancelRequest(viewer: AuthedUser, requestId: string) {
  const request = await prisma.leaveRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new HttpError(404, 'Leave request not found');

  if (viewer.role === 'EMPLOYEE' && request.employeeId !== viewer.employeeId) {
    throw new HttpError(403, 'Employees can only cancel their own requests');
  }

  if (request.status === 'APPROVED') {
    throw new HttpError(403, 'Approved leave is terminal and cannot be cancelled');
  }
  if (request.status !== 'PENDING') {
    throw new HttpError(409, 'Only pending requests can be cancelled');
  }

  return prisma.leaveRequest.update({
    where: { id: requestId },
    data: { status: 'CANCELLED' }
  });
}

async function loadDecidableRequest(
  tx: Prisma.TransactionClient,
  requestId: string
) {
  const request = await tx.leaveRequest.findUnique({
    where: { id: requestId },
    include: {
      type: true,
      employee: { select: { id: true, userId: true } }
    }
  });
  if (!request) throw new HttpError(404, 'Leave request not found');
  return request;
}

export async function approveRequest(viewer: AuthedUser, requestId: string) {
  return prisma.$transaction(async (tx) => {
    const request = await loadDecidableRequest(tx, requestId);

    if (request.employee.userId === viewer.id) {
      throw new HttpError(403, 'You cannot decide your own leave request');
    }
    if (request.status !== 'PENDING') {
      throw new HttpError(409, `Request is already ${request.status.toLowerCase()}`);
    }

    const flip = await tx.leaveRequest.updateMany({
      where: { id: requestId, status: 'PENDING' },
      data: { status: 'APPROVED', decidedById: viewer.id, decidedAt: new Date() }
    });
    if (flip.count !== 1) throw new HttpError(409, 'Concurrent decision detected');

    const openPeriod = await tx.employmentPeriod.findFirst({
      where: { employeeId: request.employeeId, endDate: null }
    });
    if (!openPeriod) {
      const lastClosed = await tx.employmentPeriod.findFirst({
        where: { employeeId: request.employeeId, endDate: { not: null } },
        orderBy: { endDate: 'desc' }
      });
      const boundary = lastClosed?.endDate;
      if (boundary && request.endDate > boundary) {
        throw new HttpError(
          422,
          'Leave cannot be approved for dates after the employment end date'
        );
      }
    }

    if (request.type.requiresAllocation) {
      const allocation = await tx.leaveAllocation.findUnique({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId: request.employeeId,
            leaveTypeId: request.leaveTypeId,
            year: request.year
          }
        }
      });
      if (!allocation) {
        throw new HttpError(409, 'No leave allocation configured for this type and year');
      }

      const days = Number(request.totalDays);
      const updatedRows = await tx.$executeRaw`
        UPDATE leave_allocations
        SET approved_or_used_days = approved_or_used_days + ${days}
        WHERE id = ${allocation.id}
          AND allocated_days - approved_or_used_days >= ${days}
      `;
      if (updatedRows !== 1) {
        throw new HttpError(409, 'Insufficient leave balance');
      }
    }

    const workDates = eachDayInclusive(request.startDate, request.endDate).filter(
      (d) => !isWeekend(d)
    );

    const existingRecords = await tx.attendance.findMany({
      where: { employeeId: request.employeeId, workDate: { in: workDates } }
    });
    const byDate = new Map(existingRecords.map((r) => [r.workDate.getTime(), r]));

    for (const d of workDates) {
      const rec = byDate.get(d.getTime());
      if (rec && (rec.status === 'PRESENT' || rec.status === 'HALF_DAY')) {
        throw new HttpError(
          409,
          `Attendance conflict on ${dayString(d)} - resolve via correction first`
        );
      }
    }

    for (const d of workDates) {
      const rec = byDate.get(d.getTime());
      if (!rec) {
        await tx.attendance.create({
          data: { employeeId: request.employeeId, workDate: d, status: 'LEAVE' }
        });
      } else if (rec.status === 'ABSENT') {
        await tx.attendance.update({
          where: { id: rec.id },
          data: { status: 'LEAVE' }
        });
      }
    }

    const auditEntries: AuditEntry[] = [
      {
        actorId: viewer.id,
        entityType: 'LeaveRequest',
        entityId: request.id,
        field: 'status',
        oldValue: 'PENDING',
        newValue: 'APPROVED'
      }
    ];
    await writeAudit(tx, auditEntries);

    await tx.notification.create({
      data: {
        recipientId: request.employee.userId,
        type: 'LEAVE_APPROVED',
        message: `Your ${request.type.code} leave (${dayString(request.startDate)} to ${dayString(request.endDate)}) was approved`
      }
    });

    return tx.leaveRequest.findUniqueOrThrow({ where: { id: requestId } });
  });
}

export async function rejectRequest(viewer: AuthedUser, requestId: string) {
  return prisma.$transaction(async (tx) => {
    const request = await loadDecidableRequest(tx, requestId);

    if (request.employee.userId === viewer.id) {
      throw new HttpError(403, 'You cannot decide your own leave request');
    }
    if (request.status !== 'PENDING') {
      throw new HttpError(409, `Request is already ${request.status.toLowerCase()}`);
    }

    const flip = await tx.leaveRequest.updateMany({
      where: { id: requestId, status: 'PENDING' },
      data: { status: 'REJECTED', decidedById: viewer.id, decidedAt: new Date() }
    });
    if (flip.count !== 1) throw new HttpError(409, 'Concurrent decision detected');

    const today = await companyToday();
    for (const d of eachDayInclusive(request.startDate, request.endDate)) {
      if (isWeekend(d) || d > today) continue;

      const record = await tx.attendance.findUnique({
        where: {
          employeeId_workDate: { employeeId: request.employeeId, workDate: d }
        }
      });
      if (record) continue;

      const otherLeave = await tx.leaveRequest.findFirst({
        where: {
          id: { not: request.id },
          employeeId: request.employeeId,
          status: { in: ['PENDING', 'APPROVED'] },
          startDate: { lte: d },
          endDate: { gte: d }
        }
      });
      if (otherLeave) continue;

      await tx.attendance.create({
        data: { employeeId: request.employeeId, workDate: d, status: 'ABSENT' }
      });
    }

    await writeAudit(tx, [
      {
        actorId: viewer.id,
        entityType: 'LeaveRequest',
        entityId: request.id,
        field: 'status',
        oldValue: 'PENDING',
        newValue: 'REJECTED'
      }
    ]);

    await tx.notification.create({
      data: {
        recipientId: request.employee.userId,
        type: 'LEAVE_REJECTED',
        message: `Your ${request.type.code} leave (${dayString(request.startDate)} to ${dayString(request.endDate)}) was rejected`
      }
    });

    return tx.leaveRequest.findUniqueOrThrow({ where: { id: requestId } });
  });
}
