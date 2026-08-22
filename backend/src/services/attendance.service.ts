import { Prisma } from '@prisma/client';
import { HttpError } from '../lib/http.js';
import { prisma } from '../lib/prisma.js';
import { writeAudit, type AuditEntry } from '../lib/audit.js';
import type { AuthedUser } from '../middleware/auth.js';
import {
  ATTENDANCE_WINDOW_END_MINUTES,
  ATTENDANCE_WINDOW_START_MINUTES,
  companyNowMinutes,
  companyToday,
  getCompanyTimezone,
  isWeekend,
  minutesOfDayZoned
} from '../lib/company-time.js';

async function requireEmployeeId(viewer: AuthedUser): Promise<string> {
  if (!viewer.employeeId) {
    throw new HttpError(403, 'No employee profile linked to this account');
  }
  return viewer.employeeId;
}

export const ALLOWED_CORRECTION_TRANSITIONS: Record<string, Set<string>> = {
  ABSENT: new Set(['PRESENT', 'HALF_DAY']),
  PRESENT: new Set(['PRESENT']),
  HALF_DAY: new Set(['PRESENT', 'HALF_DAY'])
};

export async function checkIn(viewer: AuthedUser) {
  const employeeId = await requireEmployeeId(viewer);
  const today = await companyToday();
  if (isWeekend(today)) {
    throw new HttpError(400, 'Check-in is only allowed Monday through Friday');
  }

  const minutes = await companyNowMinutes();
  if (minutes < ATTENDANCE_WINDOW_START_MINUTES || minutes >= ATTENDANCE_WINDOW_END_MINUTES) {
    throw new HttpError(400, 'Attendance window is 06:00-22:00 company time');
  }

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { status: true }
  });
  if (!employee || employee.status !== 'ACTIVE') {
    throw new HttpError(403, 'Inactive employees cannot check in');
  }

  try {
    return await prisma.attendance.create({
      data: { employeeId, workDate: today, status: 'PRESENT', checkIn: new Date() }
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new HttpError(409, 'Already checked in today');
    }
    throw err;
  }
}

export async function checkOut(viewer: AuthedUser) {
  const employeeId = await requireEmployeeId(viewer);
  const today = await companyToday();

  const record = await prisma.attendance.findUnique({
    where: { employeeId_workDate: { employeeId, workDate: today } }
  });
  if (!record || !record.checkIn) {
    throw new HttpError(400, 'No open check-in found for today');
  }
  if (record.checkOut) throw new HttpError(409, 'Already checked out today');

  const now = new Date();
  if (now <= record.checkIn) throw new HttpError(400, 'Check-out must be after check-in');

  return prisma.attendance.update({ where: { id: record.id }, data: { checkOut: now } });
}

export interface ListAttendanceInput {
  employeeId?: string;
  from?: string;
  to?: string;
  limit: number;
  offset: number;
}

export async function list(viewer: AuthedUser, query: ListAttendanceInput) {
  const where: Prisma.AttendanceWhereInput = {};
  if (viewer.role === 'EMPLOYEE') {
    where.employeeId = viewer.employeeId ?? 'no-profile';
  } else if (query.employeeId) {
    where.employeeId = query.employeeId;
  }
  if (query.from || query.to) {
    where.workDate = {};
    if (query.from) where.workDate.gte = new Date(`${query.from}T00:00:00.000Z`);
    if (query.to) where.workDate.lte = new Date(`${query.to}T00:00:00.000Z`);
  }

  const [total, rows] = await Promise.all([
    prisma.attendance.count({ where }),
    prisma.attendance.findMany({
      where,
      orderBy: { workDate: 'desc' },
      take: query.limit,
      skip: query.offset
    })
  ]);

  return { attendance: rows, meta: { total, limit: query.limit, offset: query.offset } };
}

export interface SubmitCorrectionInput {
  workDate: string;
  correctedStatus: 'PRESENT' | 'HALF_DAY';
  requestedCheckIn: string;
  requestedCheckOut: string;
  reason: string;
}

export async function submitCorrection(viewer: AuthedUser, input: SubmitCorrectionInput) {
  const employeeId = await requireEmployeeId(viewer);

  const workDate = new Date(`${input.workDate}T00:00:00.000Z`);
  if (Number.isNaN(workDate.getTime())) throw new HttpError(400, 'Invalid work date');
  if (isWeekend(workDate)) {
    throw new HttpError(400, 'Corrections apply to working days only');
  }

  const checkInAt = new Date(input.requestedCheckIn);
  const checkOutAt = new Date(input.requestedCheckOut);
  if (Number.isNaN(checkInAt.getTime()) || Number.isNaN(checkOutAt.getTime())) {
    throw new HttpError(400, 'Invalid timestamps');
  }
  if (checkOutAt <= checkInAt) {
    throw new HttpError(400, 'Check-out must be strictly after check-in');
  }

  const tz = await getCompanyTimezone();
  for (const ts of [checkInAt, checkOutAt]) {
    const m = minutesOfDayZoned(ts, tz);
    if (m < ATTENDANCE_WINDOW_START_MINUTES || m >= ATTENDANCE_WINDOW_END_MINUTES) {
      throw new HttpError(400, 'Times must fall within the 06:00-22:00 window');
    }
  }

  const pending = await prisma.attendanceCorrectionRequest.findFirst({
    where: { employeeId, workDate, status: 'PENDING' }
  });
  if (pending) {
    throw new HttpError(409, 'A pending correction already exists for this date');
  }

  const existing = await prisma.attendance.findUnique({
    where: { employeeId_workDate: { employeeId, workDate } }
  });

  return prisma.attendanceCorrectionRequest.create({
    data: {
      employeeId,
      attendanceId: existing?.id,
      workDate,
      correctedStatus: input.correctedStatus,
      requestedCheckIn: checkInAt,
      requestedCheckOut: checkOutAt,
      reason: input.reason
    }
  });
}

export interface ListCorrectionsInput {
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  limit?: number;
  offset?: number;
}

export async function listCorrections(viewer: AuthedUser, query: ListCorrectionsInput) {
  const where: Prisma.AttendanceCorrectionRequestWhereInput = {};
  if (viewer.role === 'EMPLOYEE') {
    where.employeeId = viewer.employeeId ?? 'no-profile';
  }
  if (query.status) where.status = query.status;

  const limit = query.limit ?? 20;
  const offset = query.offset ?? 0;

  const [total, rows] = await Promise.all([
    prisma.attendanceCorrectionRequest.count({ where }),
    prisma.attendanceCorrectionRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    })
  ]);

  return { corrections: rows, meta: { total, limit, offset } };
}

export async function decideCorrection(
  id: string,
  viewer: AuthedUser,
  decision: 'APPROVED' | 'REJECTED'
) {
  return prisma.$transaction(async (tx) => {
    const request = await tx.attendanceCorrectionRequest.findUnique({
      where: { id },
      include: { employee: { select: { id: true, userId: true } } }
    });
    if (!request) throw new HttpError(404, 'Correction request not found');
    if (request.status !== 'PENDING') {
      throw new HttpError(409, 'Correction has already been decided');
    }

    const flip = await tx.attendanceCorrectionRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: decision, reviewedById: viewer.id, reviewedAt: new Date() }
    });
    if (flip.count !== 1) throw new HttpError(409, 'Concurrent decision detected');

    let note: string | undefined;

    if (decision === 'APPROVED') {
      const existing = await tx.attendance.findUnique({
        where: {
          employeeId_workDate: { employeeId: request.employeeId, workDate: request.workDate }
        }
      });

      if (existing) {
        const allowed = ALLOWED_CORRECTION_TRANSITIONS[existing.status];
        if (!allowed || !allowed.has(request.correctedStatus)) {
          throw new HttpError(
            422,
            `Transition ${existing.status} -> ${request.correctedStatus} is prohibited`
          );
        }
        await tx.attendance.update({
          where: { id: existing.id },
          data: {
            status: request.correctedStatus,
            checkIn: request.requestedCheckIn,
            checkOut: request.requestedCheckOut
          }
        });
      } else {
        await tx.attendance.create({
          data: {
            employeeId: request.employeeId,
            workDate: request.workDate,
            status: request.correctedStatus,
            checkIn: request.requestedCheckIn,
            checkOut: request.requestedCheckOut
          }
        });
      }

      const auditEntries: AuditEntry[] = [
        {
          actorId: viewer.id,
          entityType: 'Attendance',
          entityId: existing?.id ?? request.id,
          field: 'status',
          oldValue: existing?.status ?? null,
          newValue: request.correctedStatus
        }
      ];

      const finalizedRun = await tx.payrollRun.findFirst({
        where: {
          companyId: viewer.companyId,
          status: 'FINALIZED',
          periodStart: { lte: request.workDate },
          periodEnd: { gte: request.workDate }
        }
      });
      if (finalizedRun) {
        note = 'Payroll finalized - this correction does not affect the existing payslip';
        auditEntries.push({
          actorId: viewer.id,
          entityType: 'PayrollRun',
          entityId: finalizedRun.id,
          field: 'postFinalizationCorrection',
          newValue: `attendance ${request.workDate.toISOString().slice(0, 10)} corrected`
        });
      }

      await writeAudit(tx, auditEntries);

      await tx.notification.create({
        data: {
          recipientId: request.employee.userId,
          type: 'ATTENDANCE_CORRECTION',
          message: `Your attendance correction for ${request.workDate
            .toISOString()
            .slice(0, 10)} was approved`
        }
      });
    }

    const updated = await tx.attendanceCorrectionRequest.findUniqueOrThrow({ where: { id } });
    return note ? { correction: updated, note } : { correction: updated };
  });
}
