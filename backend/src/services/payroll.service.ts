import { Prisma } from '@prisma/client';
import { HttpError } from '../lib/http.js';
import { prisma } from '../lib/prisma.js';
import { writeAudit } from '../lib/audit.js';
import type { AuthedUser } from '../middleware/auth.js';
import {
  computePayableDays,
  computePayslip,
  employeeWorkDates,
  type LeaveTypeCode
} from '../lib/payroll.js';
import { workingDaysInclusive } from '../lib/company-time.js';

function toDate(dateString: string): Date {
  return new Date(`${dateString}T00:00:00.000Z`);
}

export interface CreateRunInput {
  periodStart: string;
  periodEnd: string;
}

export async function createRun(viewer: AuthedUser, input: CreateRunInput) {
  const start = toDate(input.periodStart);
  const end = toDate(input.periodEnd);
  if (end < start) throw new HttpError(400, 'periodStart must not exceed periodEnd');
  if (workingDaysInclusive(start, end) === 0) {
    throw new HttpError(400, 'Run period contains zero Mon-Fri working days');
  }

  const overlap = await prisma.payrollRun.findFirst({
    where: {
      companyId: viewer.companyId,
      status: 'FINALIZED',
      periodStart: { lte: end },
      periodEnd: { gte: start }
    }
  });
  if (overlap) throw new HttpError(409, 'Period overlaps an already finalized run');

  return prisma.payrollRun.create({
    data: {
      companyId: viewer.companyId,
      periodStart: start,
      periodEnd: end,
      status: 'DRAFT',
      createdById: viewer.id
    }
  });
}

export interface ListRunsInput {
  status?: 'DRAFT' | 'CALCULATED' | 'FINALIZED';
  limit: number;
  offset: number;
}

export async function listRuns(query: ListRunsInput) {
  const where: Prisma.PayrollRunWhereInput = {};
  if (query.status) where.status = query.status;

  const [total, runs] = await Promise.all([
    prisma.payrollRun.count({ where }),
    prisma.payrollRun.findMany({
      where,
      orderBy: [{ periodStart: 'desc' }],
      take: query.limit,
      skip: query.offset,
      include: { createdBy: { select: { loginId: true } }, _count: { select: { payslips: true } } }
    })
  ]);

  return { runs, meta: { total, limit: query.limit, offset: query.offset } };
}

export async function getRun(id: string) {
  const run = await prisma.payrollRun.findUnique({
    where: { id },
    include: {
      createdBy: { select: { loginId: true } },
      payslips: { orderBy: { employeeId: 'asc' } }
    }
  });
  if (!run) throw new HttpError(404, 'Payroll run not found');
  return run;
}

async function findFinalizedOverlap(
  tx: Prisma.TransactionClient,
  companyId: string,
  start: Date,
  end: Date,
  excludeRunId?: string
) {
  return tx.payrollRun.findFirst({
    where: {
      companyId,
      status: 'FINALIZED',
      id: excludeRunId ? { not: excludeRunId } : undefined,
      periodStart: { lte: end },
      periodEnd: { gte: start }
    }
  });
}

type EmployeeWithStructure = Prisma.EmployeeGetPayload<{
  select: {
    id: true;
    firstName: true;
    lastName: true;
    salaryStructure: { select: { wagePaise: true; standardAllowancePaise: true } };
    employmentPeriods: { select: { startDate: true; endDate: true } };
  };
}>;

function buildPayslipRows(
  tx: Prisma.TransactionClient,
  run: { id: string; companyId: string; periodStart: Date; periodEnd: Date },
  employees: EmployeeWithStructure[],
  attendanceByEmployee: Map<string, Map<number, { status: string }>>,
  leaveTypeByEmployeeDate: Map<string, Map<number, LeaveTypeCode>>
) {
  const missing: string[] = [];
  const rows: Prisma.PayslipCreateManyInput[] = [];

  for (const employee of employees) {
    const workDates = employeeWorkDates(
      employee.employmentPeriods,
      run.periodStart,
      run.periodEnd
    );
    if (workDates.length === 0) continue;

    if (!employee.salaryStructure) {
      missing.push(`${employee.firstName} ${employee.lastName}`.trim());
      continue;
    }

    const payableDays = computePayableDays(
      workDates,
      attendanceByEmployee.get(employee.id) ?? new Map(),
      leaveTypeByEmployeeDate.get(employee.id) ?? new Map()
    );

    const computation = computePayslip(
      employee.salaryStructure.wagePaise,
      employee.salaryStructure.standardAllowancePaise,
      workDates.length,
      payableDays
    );

    rows.push({
      payrollRunId: run.id,
      employeeId: employee.id,
      workingDays: computation.workingDays,
      payableDays: computation.payableDays,
      basicPaise: computation.basicPaise,
      hraPaise: computation.hraPaise,
      standardAllowancePaise: computation.standardAllowancePaise,
      performanceBonusPaise: computation.performanceBonusPaise,
      ltaPaise: computation.ltaPaise,
      fixedAllowancePaise: computation.fixedAllowancePaise,
      grossPaise: computation.grossPaise,
      employeePfPaise: computation.employeePfPaise,
      employerPfPaise: computation.employerPfPaise,
      professionalTaxPaise: computation.professionalTaxPaise,
      netPaise: computation.netPaise,
      finalized: false
    });
  }

  if (missing.length > 0) {
    throw new HttpError(422, 'Eligible employees are missing a salary structure', missing);
  }

  return rows;
}

export async function calculateRun(runId: string) {
  return prisma.$transaction(async (tx) => {
    const run = await tx.payrollRun.findUnique({ where: { id: runId } });
    if (!run) throw new HttpError(404, 'Payroll run not found');
    if (run.status === 'FINALIZED') {
      throw new HttpError(409, 'FINALIZED runs are immutable and cannot be recalculated');
    }

    const employees = await tx.employee.findMany({
      where: { companyId: run.companyId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        salaryStructure: { select: { wagePaise: true, standardAllowancePaise: true } },
        employmentPeriods: { select: { startDate: true, endDate: true } }
      }
    });

    const employeeIds = employees.map((e) => e.id);

    const attendanceRows = await tx.attendance.findMany({
      where: {
        employeeId: { in: employeeIds },
        workDate: { gte: run.periodStart, lte: run.periodEnd }
      }
    });
    const attendanceByEmployee = new Map<string, Map<number, { status: string }>>();
    for (const row of attendanceRows) {
      let map = attendanceByEmployee.get(row.employeeId);
      if (!map) {
        map = new Map();
        attendanceByEmployee.set(row.employeeId, map);
      }
      map.set(row.workDate.getTime(), { status: row.status });
    }

    const approvedLeaves = await tx.leaveRequest.findMany({
      where: {
        employeeId: { in: employeeIds },
        status: 'APPROVED',
        startDate: { lte: run.periodEnd },
        endDate: { gte: run.periodStart }
      },
      select: {
        employeeId: true,
        startDate: true,
        endDate: true,
        type: { select: { code: true } }
      }
    });
    const leaveTypeByEmployeeDate = new Map<string, Map<number, LeaveTypeCode>>();
    for (const leave of approvedLeaves) {
      let map = leaveTypeByEmployeeDate.get(leave.employeeId);
      if (!map) {
        map = new Map();
        leaveTypeByEmployeeDate.set(leave.employeeId, map);
      }
      for (let t = leave.startDate.getTime(); t <= leave.endDate.getTime(); t += 86400000) {
        map.set(t, leave.type.code as LeaveTypeCode);
      }
    }

    const rows = buildPayslipRows(
      tx,
      run,
      employees as EmployeeWithStructure[],
      attendanceByEmployee,
      leaveTypeByEmployeeDate
    );

    await tx.payslip.deleteMany({ where: { payrollRunId: runId, finalized: false } });
    await tx.payslip.createMany({ data: rows });

    return tx.payrollRun.update({ where: { id: runId }, data: { status: 'CALCULATED' } });
  });
}

export async function finalizeRun(runId: string, viewer: AuthedUser) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.payrollRun.findUnique({ where: { id: runId } });
    if (!existing) throw new HttpError(404, 'Payroll run not found');

    const overlap = await findFinalizedOverlap(
      tx,
      existing.companyId,
      existing.periodStart,
      existing.periodEnd,
      runId
    );
    if (overlap) {
      throw new HttpError(409, 'Period overlaps an already finalized run');
    }

    const flip = await tx.payrollRun.updateMany({
      where: { id: runId, status: 'CALCULATED' },
      data: { status: 'FINALIZED', finalizedAt: new Date() }
    });
    if (flip.count !== 1) {
      throw new HttpError(409, 'Only CALCULATED runs can be finalized (or concurrent modification)');
    }

    const payslips = await tx.payslip.updateMany({
      where: { payrollRunId: runId },
      data: { finalized: true }
    });

    const recipients = await tx.payslip.findMany({
      where: { payrollRunId: runId },
      include: { employee: { select: { userId: true } } }
    });
    const uniqueRecipients = [
      ...new Set(recipients.map((p) => p.employee.userId))
    ];
    if (uniqueRecipients.length > 0) {
      await tx.notification.createMany({
        data: uniqueRecipients.map((userId) => ({
          recipientId: userId,
          type: 'PAYROLL_READY' as const,
          message: `Payslip for ${existing.periodStart.toISOString().slice(0, 10)} - ${existing.periodEnd.toISOString().slice(0, 10)} is ready`
        }))
      });
    }

    await writeAudit(tx, [
      {
        actorId: viewer.id,
        entityType: 'PayrollRun',
        entityId: runId,
        field: 'status',
        oldValue: 'CALCULATED',
        newValue: 'FINALIZED'
      }
    ]);

    return {
      run: await tx.payrollRun.findUniqueOrThrow({ where: { id: runId } }),
      payslipCount: payslips.count
    };
  });
}

function projectPayslip(
  payslip: Prisma.PayslipGetPayload<{ include: { run: { select: { periodStart: true, periodEnd: true } } } }>,
  role: 'ADMIN' | 'EMPLOYEE'
) {
  const base = {
    id: payslip.id,
    payrollRunId: payslip.payrollRunId,
    employeeId: payslip.employeeId,
    periodStart: payslip.run.periodStart,
    periodEnd: payslip.run.periodEnd,
    workingDays: payslip.workingDays,
    payableDays: Number(payslip.payableDays),
    grossPaise: payslip.grossPaise,
    employeePfPaise: payslip.employeePfPaise,
    professionalTaxPaise: payslip.professionalTaxPaise,
    netPaise: payslip.netPaise,
    finalized: payslip.finalized,
    createdAt: payslip.createdAt
  };

  if (role !== 'ADMIN') return base;

  return {
    ...base,
    employerPfPaise: payslip.employerPfPaise,
    basicPaise: payslip.basicPaise,
    hraPaise: payslip.hraPaise,
    standardAllowancePaise: payslip.standardAllowancePaise,
    performanceBonusPaise: payslip.performanceBonusPaise,
    ltaPaise: payslip.ltaPaise,
    fixedAllowancePaise: payslip.fixedAllowancePaise
  };
}

export async function listPayslips(viewer: AuthedUser, query: {
  runId?: string;
  employeeId?: string;
  limit: number;
  offset: number;
}) {
  const where: Prisma.PayslipWhereInput = {};
  if (viewer.role === 'EMPLOYEE') {
    where.employeeId = viewer.employeeId ?? 'no-profile';
  } else {
    if (query.runId) where.payrollRunId = query.runId;
    if (query.employeeId) where.employeeId = query.employeeId;
  }

  const [total, rows] = await Promise.all([
    prisma.payslip.count({ where }),
    prisma.payslip.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: query.limit,
      skip: query.offset,
      include: { run: { select: { periodStart: true, periodEnd: true } } }
    })
  ]);

  return {
    payslips: rows.map((row) => projectPayslip(row, viewer.role)),
    meta: { total, limit: query.limit, offset: query.offset }
  };
}

export async function getPayslip(id: string, viewer: AuthedUser) {
  const payslip = await prisma.payslip.findUnique({
    where: { id },
    include: { run: { select: { periodStart: true, periodEnd: true } } }
  });
  if (!payslip) throw new HttpError(404, 'Payslip not found');

  if (viewer.role === 'EMPLOYEE') {
    if (!viewer.employeeId || payslip.employeeId !== viewer.employeeId) {
      throw new HttpError(403, 'Employees can only view their own payslips');
    }
  }

  return projectPayslip(payslip, viewer.role);
}
