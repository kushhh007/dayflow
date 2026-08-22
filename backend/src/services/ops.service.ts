import { prisma } from '../lib/prisma.js';
import {
  EMPTY_BRIEF_MESSAGE,
  buildAttentionQueue,
  groupBriefFlags,
  type AttentionQueueEntry,
  type FlagItem,
  type RuleName
} from '../lib/ops.js';
import { companyToday, isWeekend } from '../lib/company-time.js';
import type { AuthedUser } from '../middleware/auth.js';

async function collectFlags(date: Date): Promise<FlagItem[]> {
  const month = date.getUTCMonth() + 1;
  const flags: FlagItem[] = [];

  const attendanceRows = await prisma.attendance.findMany({
    where: { workDate: date },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, status: true } }
    }
  });

  const leavesCovering = await prisma.leaveRequest.findMany({
    where: {
      status: { in: ['PENDING', 'APPROVED'] },
      startDate: { lte: date },
      endDate: { gte: date }
    },
    select: { employeeId: true, status: true }
  });
  const leaveByEmployee = new Map<string, number>();
  for (const leave of leavesCovering) {
    leaveByEmployee.set(leave.employeeId, (leaveByEmployee.get(leave.employeeId) ?? 0) + 1);
  }

  for (const row of attendanceRows) {
    if (row.employee.status !== 'ACTIVE') continue;

    if (row.status === 'ABSENT' && !leaveByEmployee.has(row.employeeId)) {
      flags.push({
        rule: 'UNEXPLAINED_ABSENCE',
        type: 'EMPLOYEE',
        refId: row.employeeId,
        employeeId: row.employeeId,
        label: `${row.employee.firstName} ${row.employee.lastName} marked ABSENT with no leave`
      });
    }

    if (row.status === 'PRESENT' && row.checkIn === null) {
      flags.push({
        rule: 'ATTENDANCE_ANOMALY',
        type: 'EMPLOYEE',
        refId: row.employeeId,
        employeeId: row.employeeId,
        label: `${row.employee.firstName} ${row.employee.lastName} PRESENT without check-in`
      });
    }
  }

  if (!isWeekend(date)) {
    const activeEmployees = await prisma.employee.findMany({
      where: { status: 'ACTIVE', departmentId: { not: null } },
      select: {
        id: true,
        department: { select: { id: true, name: true } }
      }
    });

    const headcountByDept = new Map<string, number>();
    for (const employee of activeEmployees) {
      const deptId = employee.department!.id;
      headcountByDept.set(deptId, (headcountByDept.get(deptId) ?? 0) + 1);
    }

    const approvedLeaveEmployees = await prisma.leaveRequest.findMany({
      where: {
        status: 'APPROVED',
        startDate: { lte: date },
        endDate: { gte: date }
      },
      select: { employeeId: true }
    });
    const onLeaveIds = [...new Set(approvedLeaveEmployees.map((l) => l.employeeId))];

    const deptOfEmployee = new Map<string, string>();
    for (const employee of activeEmployees) {
      deptOfEmployee.set(employee.id, employee.department!.id);
    }

    const onLeaveByDept = new Map<string, number>();
    for (const id of onLeaveIds) {
      const deptId = deptOfEmployee.get(id);
      if (!deptId) continue;
      onLeaveByDept.set(deptId, (onLeaveByDept.get(deptId) ?? 0) + 1);
    }

    const departments = await prisma.department.findMany({ select: { id: true, name: true } });
    for (const dept of departments) {
      const headcount = headcountByDept.get(dept.id) ?? 0;
      const onLeave = onLeaveByDept.get(dept.id) ?? 0;
      const ratio = headcount > 0 ? onLeave / headcount : 0;
      if (headcount > 0 && ratio >= 0.3) {
        flags.push({
          rule: 'COVERAGE_RISK',
          type: 'DEPARTMENT',
          refId: dept.id,
          employeeId: null,
          label: `${dept.name}: coverage risk HIGH (${onLeave}/${headcount} on leave)`
        });
      }
    }
  }

  if (month <= 11) {
    const year = date.getUTCFullYear();
    const allocations = await prisma.leaveAllocation.findMany({
      where: {
        year,
        allocatedDays: { gt: 0 },
        type: { code: { in: ['PAID', 'SICK'] } }
      },
      include: {
        employee: { select: { firstName: true, lastName: true } },
        type: { select: { code: true } }
      }
    });

    for (const allocation of allocations) {
      const ratio =
        Number(allocation.approvedOrUsedDays) / Number(allocation.allocatedDays);
      if (ratio >= 0.9) {
        flags.push({
          rule: 'LOW_BALANCE_WARNING',
          type: 'EMPLOYEE',
          refId: allocation.employeeId,
          employeeId: allocation.employeeId,
          label: `${allocation.employee.firstName} ${allocation.employee.lastName}: ${allocation.type.code} balance at ${Math.round(ratio * 100)}%`
        });
      }
    }
  }

  return flags;
}

export async function dailyBrief(viewer: AuthedUser) {
  void viewer;
  const date = await companyToday();
  const flags = await collectFlags(date);

  return {
    brief: {
      date,
      flags: groupBriefFlags(flags),
      attentionTotal: buildAttentionQueue(flags).reduce((sum, entry) => sum + entry.score, 0)
    },
    ...(flags.length === 0 ? { message: EMPTY_BRIEF_MESSAGE } : {})
  };
}

export async function attentionQueue(viewer: AuthedUser): Promise<{
  items: AttentionQueueEntry[];
}> {
  void viewer;
  const date = await companyToday();
  const flags = await collectFlags(date);
  return { items: buildAttentionQueue(flags) };
}
