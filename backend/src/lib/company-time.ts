import { prisma } from './prisma.js';

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

export const ATTENDANCE_WINDOW_START_MINUTES = 6 * 60;
export const ATTENDANCE_WINDOW_END_MINUTES = 22 * 60;

interface ZonedParts {
  year: string;
  month: string;
  day: string;
  hour: number;
  minute: number;
}

function zonedParts(date: Date, timeZone: string): ZonedParts {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const raw = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const hour = Number(raw.hour) % 24;
  return {
    year: String(raw.year),
    month: String(raw.month),
    day: String(raw.day),
    hour,
    minute: Number(raw.minute)
  };
}

export function utcDate(dateString: string): Date {
  const [y, m, d] = dateString.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function zonedDateString(date: Date, timeZone: string = DEFAULT_TIMEZONE): string {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

export function minutesOfDayZoned(date: Date, timeZone: string = DEFAULT_TIMEZONE): number {
  const p = zonedParts(date, timeZone);
  return p.hour * 60 + p.minute;
}

export async function getCompanyTimezone(): Promise<string> {
  const company = await prisma.company.findFirst({ select: { timezone: true } });
  return company?.timezone ?? DEFAULT_TIMEZONE;
}

export async function companyToday(timeZone?: string): Promise<Date> {
  const tz = timeZone ?? (await getCompanyTimezone());
  return utcDate(zonedDateString(new Date(), tz));
}

export async function companyNowMinutes(timeZone?: string): Promise<number> {
  const tz = timeZone ?? (await getCompanyTimezone());
  return minutesOfDayZoned(new Date(), tz);
}

export function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

export function calendarDaysInclusive(start: Date, end: Date): number {
  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
}

export function workingDaysInclusive(start: Date, end: Date): number {
  let count = 0;
  for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
    if (!isWeekend(new Date(t))) count += 1;
  }
  return count;
}

export function eachDayInclusive(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
    out.push(new Date(t));
  }
  return out;
}
