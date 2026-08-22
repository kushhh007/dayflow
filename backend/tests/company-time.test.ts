import { describe, expect, it } from 'vitest';
import {
  calendarDaysInclusive,
  eachDayInclusive,
  isWeekend,
  utcDate,
  workingDaysInclusive
} from '../src/lib/company-time.js';

describe('company-time', () => {
  it('utcDate builds UTC-midnight dates', () => {
    const d = utcDate('2026-01-05');
    expect(d.toISOString()).toBe('2026-01-05T00:00:00.000Z');
    expect(d.getUTCDay()).toBe(1);
  });

  it('detects weekends', () => {
    expect(isWeekend(utcDate('2026-01-03'))).toBe(true);
    expect(isWeekend(utcDate('2026-01-04'))).toBe(true);
    expect(isWeekend(utcDate('2026-01-05'))).toBe(false);
  });

  it('counts calendar days inclusively across a weekend span', () => {
    const start = utcDate('2026-01-09');
    const end = utcDate('2026-01-12');
    expect(calendarDaysInclusive(start, end)).toBe(4);
  });

  it('counts Mon-Fri working days only (spec payroll rule)', () => {
    const start = utcDate('2026-01-01');
    const end = utcDate('2026-01-31');
    expect(workingDaysInclusive(start, end)).toBe(22);
  });

  it('eachDayInclusive enumerates every date in range', () => {
    const days = eachDayInclusive(utcDate('2026-02-27'), utcDate('2026-03-02'));
    expect(days.map((d) => d.toISOString().slice(0, 10))).toEqual([
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
      '2026-03-02'
    ]);
  });
});
