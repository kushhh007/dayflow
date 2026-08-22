import { describe, expect, it } from 'vitest';
import {
  computePayslip,
  computePayableDays,
  employeeWorkingDays,
  type EmploymentPeriodLike
} from '../src/lib/payroll.js';
import { utcDate } from '../src/lib/company-time.js';

describe('computePayslip', () => {
  it('computes a full month with perfect attendance (no proration)', () => {
    const r = computePayslip(3_000_000, 0, 22, 22);
    expect(r.basicPaise).toBe(1_500_000);
    expect(r.hraPaise).toBe(750_000);
    expect(r.performanceBonusPaise).toBe(Math.round(1_500_000 * 0.0833));
    expect(r.ltaPaise).toBe(r.performanceBonusPaise);
    expect(r.fixedAllowancePaise).toBe(
      3_000_000 - (1_500_000 + 750_000 + 0 + r.performanceBonusPaise * 2)
    );
    expect(r.grossPaise).toBe(3_000_000);
    expect(r.employeePfPaise).toBe(180_000);
    expect(r.employerPfPaise).toBe(180_000);
    expect(r.professionalTaxPaise).toBe(20_000);
    expect(r.netPaise).toBe(2_800_000);
  });

  it('prorates per component with half-day contributions', () => {
    const full = computePayslip(3_000_000, 0, 20, 20);
    const halfDay = computePayslip(3_000_000, 0, 20, 19.5);
    const factor = 19.5 / 20;
    expect(halfDay.payableDays).toBe(19.5);
    expect(halfDay.basicPaise).toBe(Math.round(1_500_000 * factor));
    expect(halfDay.employeePfPaise).toBe(Math.round(halfDay.basicPaise * 0.12));
    expect(full.employeePfPaise).not.toBe(halfDay.employeePfPaise);
  });

  it('zero payable days produces all-zero values including professional tax', () => {
    const r = computePayslip(3_000_000, 100_000, 22, 0);
    expect(r.grossPaise).toBe(0);
    expect(r.employeePfPaise).toBe(0);
    expect(r.employerPfPaise).toBe(0);
    expect(r.professionalTaxPaise).toBe(0);
    expect(r.netPaise).toBe(0);
  });
});

describe('employeeWorkingDays (EmploymentPeriod intersections)', () => {
  it('counts Mon-Fri days inside period-run intersections only', () => {
    const runStart = utcDate('2026-01-01');
    const runEnd = utcDate('2026-01-31');
    const periods: EmploymentPeriodLike[] = [
      { startDate: utcDate('2026-01-01'), endDate: utcDate('2026-01-10') },
      { startDate: utcDate('2026-01-20'), endDate: null }
    ];
    const days = employeeWorkingDays(periods, runStart, runEnd);
    expect(days).toBe(16);
  });

  it('excludes employees whose periods never overlap the run', () => {
    const runStart = utcDate('2026-01-01');
    const runEnd = utcDate('2026-01-31');
    const periods: EmploymentPeriodLike[] = [
      { startDate: utcDate('2026-02-10'), endDate: null }
    ];
    expect(employeeWorkingDays(periods, runStart, runEnd)).toBe(0);
  });

  it('clamps mid-month departure to the employment end date', () => {
    const runStart = utcDate('2026-03-01');
    const runEnd = utcDate('2026-03-31');
    const periods: EmploymentPeriodLike[] = [
      { startDate: utcDate('2025-06-01'), endDate: utcDate('2026-03-13') }
    ];
    expect(employeeWorkingDays(periods, runStart, runEnd)).toBe(10);
  });
});

describe('computePayableDays (daily contribution model)', () => {
  const d = (s: string) => utcDate(s);

  it('maps PRESENT/HALF_DAY/ABSENT/leave correctly and never goes negative', () => {
    const workDates = [d('2026-01-05'), d('2026-01-06'), d('2026-01-07'), d('2026-01-08')];
    const attendance = new Map<number, { status: string }>([
      [d('2026-01-05').getTime(), { status: 'PRESENT' }],
      [d('2026-01-06').getTime(), { status: 'HALF_DAY' }],
      [d('2026-01-07').getTime(), { status: 'ABSENT' }]
    ]);
    const leaves = new Map<number, 'PAID' | 'SICK' | 'UNPAID'>([
      [d('2026-01-08').getTime(), 'SICK']
    ]);

    expect(computePayableDays(workDates, attendance, leaves)).toBe(2.5);
  });

  it('unpaid leave contributes zero even with a LEAVE attendance record', () => {
    const workDates = [d('2026-01-05')];
    const attendance = new Map<number, { status: string }>([
      [d('2026-01-05').getTime(), { status: 'LEAVE' }]
    ]);
    const leaves = new Map<number, 'PAID' | 'SICK' | 'UNPAID'>([
      [d('2026-01-05').getTime(), 'UNPAID']
    ]);
    expect(computePayableDays(workDates, attendance, leaves)).toBe(0);
  });

  it('paid leave counts even when no attendance record exists', () => {
    const workDates = [d('2026-01-05')];
    const leaves = new Map<number, 'PAID' | 'SICK' | 'UNPAID'>([
      [d('2026-01-05').getTime(), 'PAID']
    ]);
    expect(computePayableDays(workDates, attendance_empty(), leaves)).toBe(1);
  });

  function attendance_empty(): Map<number, { status: string }> {
    return new Map();
  }
});
