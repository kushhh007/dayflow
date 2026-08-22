import { workingDaysInclusive, eachDayInclusive, isWeekend } from './company-time.js';
import { deriveSalaryComponents } from './salary.js';

export const PROFESSIONAL_TAX_PAISE = 20000;
export const PF_RATE = 0.12;

export const DAILY_CONTRIBUTION: Record<string, number> = {
  PRESENT: 1,
  HALF_DAY: 0.5,
  ABSENT: 0
};

export interface EmploymentPeriodLike {
  startDate: Date;
  endDate: Date | null;
}

export function employeeWorkDates(
  periods: EmploymentPeriodLike[],
  runStart: Date,
  runEnd: Date
): Date[] {
  const out: Date[] = [];
  for (const period of periods) {
    const start = period.startDate > runStart ? period.startDate : runStart;
    const endCandidate =
      period.endDate !== null && period.endDate < runEnd ? period.endDate : runEnd;
    if (start > endCandidate) continue;
    for (const d of eachDayInclusive(start, endCandidate)) {
      if (isWeekend(d)) continue;
      out.push(d);
    }
  }
  return out.sort((a, b) => a.getTime() - b.getTime());
}

export function employeeWorkingDays(
  periods: EmploymentPeriodLike[],
  runStart: Date,
  runEnd: Date
): number {
  return employeeWorkDates(periods, runStart, runEnd).length;
}

export type LeaveTypeCode = 'PAID' | 'SICK' | 'UNPAID';

export function computePayableDays(
  workDates: Date[],
  attendanceByDate: Map<number, { status: string }>,
  approvedLeaveByDate: Map<number, LeaveTypeCode>
): number {
  let total = 0;
  for (const d of workDates) {
    const key = d.getTime();
    const record = attendanceByDate.get(key);
    if (record && record.status !== 'LEAVE') {
      total += DAILY_CONTRIBUTION[record.status] ?? 0;
      continue;
    }

    const leaveType = approvedLeaveByDate.get(key);
    if (record?.status === 'LEAVE' && leaveType !== undefined) {
      if (leaveType === 'PAID' || leaveType === 'SICK') total += 1;
      continue;
    }
    if (!record && (leaveType === 'PAID' || leaveType === 'SICK')) {
      total += 1;
    }
  }
  return Number(total.toFixed(1));
}

export interface PayslipComputation {
  workingDays: number;
  payableDays: number;
  basicPaise: number;
  hraPaise: number;
  standardAllowancePaise: number;
  performanceBonusPaise: number;
  ltaPaise: number;
  fixedAllowancePaise: number;
  grossPaise: number;
  employeePfPaise: number;
  employerPfPaise: number;
  professionalTaxPaise: number;
  netPaise: number;
}

function zeroedPayslip(workingDays: number, payableDays: number): PayslipComputation {
  return {
    workingDays,
    payableDays,
    basicPaise: 0,
    hraPaise: 0,
    standardAllowancePaise: 0,
    performanceBonusPaise: 0,
    ltaPaise: 0,
    fixedAllowancePaise: 0,
    grossPaise: 0,
    employeePfPaise: 0,
    employerPfPaise: 0,
    professionalTaxPaise: 0,
    netPaise: 0
  };
}

export function computePayslip(
  wagePaise: number,
  standardAllowancePaise: number,
  workingDays: number,
  payableDays: number
): PayslipComputation {
  if (workingDays <= 0 || payableDays <= 0) {
    return zeroedPayslip(workingDays, payableDays);
  }

  const components = deriveSalaryComponents(wagePaise, standardAllowancePaise);

  const factor = payableDays / workingDays;
  const basicPaise = Math.round(components.basic * factor);
  const hraPaise = Math.round(components.hra * factor);
  const standardAllowance = Math.round(standardAllowancePaise * factor);
  const performanceBonusPaise = Math.round(components.performanceBonus * factor);
  const ltaPaise = Math.round(components.lta * factor);
  const fixedAllowancePaise = Math.round(components.fixedAllowance * factor);

  const grossPaise =
    basicPaise +
    hraPaise +
    standardAllowance +
    performanceBonusPaise +
    ltaPaise +
    fixedAllowancePaise;

  const employeePfPaise = Math.round(basicPaise * PF_RATE);
  const employerPfPaise = Math.round(basicPaise * PF_RATE);

  const netPaise = grossPaise - employeePfPaise - PROFESSIONAL_TAX_PAISE;

  return {
    workingDays,
    payableDays,
    basicPaise,
    hraPaise,
    standardAllowancePaise: standardAllowance,
    performanceBonusPaise,
    ltaPaise,
    fixedAllowancePaise,
    grossPaise,
    employeePfPaise,
    employerPfPaise,
    professionalTaxPaise: PROFESSIONAL_TAX_PAISE,
    netPaise
  };
}
