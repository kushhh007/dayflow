import { mockResponse } from './mock.js'

// MOCK SERVICE. Contract areas follow the Dayflow v4.5 spec; endpoint paths
// will be defined in docs/api.md by the backend lead and must not be invented
// here. Replace bodies with apiRequest() calls when it lands.
//
// The store below SIMULATES backend behavior (including rejections) so the
// attendance UI can be developed and demoed. It implements no real domain
// rules: auto-ABSENT generation, reconciliation jobs, and payroll logic stay
// backend-owned per spec §4–§6.

function isoDate(date = new Date()) {
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60 * 1000).toISOString().slice(0, 10)
}

function nowHHMM() {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

// Recent Monday–Friday dates strictly before today (attendance is a
// working-days-only concept; today starts with no record until check-in).
function previousWorkingDates(count) {
  const dates = []
  const cursor = new Date()
  while (dates.length < count) {
    cursor.setDate(cursor.getDate() - 1)
    const weekday = cursor.getDay()
    if (weekday !== 0 && weekday !== 6) {
      dates.unshift(isoDate(cursor))
    }
  }
  return dates
}

const HISTORY_TEMPLATE = [
  { status: 'PRESENT', checkIn: '09:05', checkOut: '18:10' },
  { status: 'PRESENT', checkIn: '09:12', checkOut: '17:58' },
  { status: 'ABSENT', checkIn: null, checkOut: null },
  { status: 'HALF_DAY', checkIn: '09:30', checkOut: '13:15' },
]

let sequence = 1
const nextId = (prefix) => `${prefix}-${sequence++}`

// `payrollFinalized` models a backend-provided flag marking dates already
// inside a FINALIZED PayrollRun (spec §4/§5): corrections remain allowed but
// the UI must surface that they do not affect the existing payslip.
const store = {
  records: previousWorkingDates(4).map((date, index) => ({
    id: nextId('att'),
    date,
    status: HISTORY_TEMPLATE[index].status,
    checkIn: HISTORY_TEMPLATE[index].checkIn,
    checkOut: HISTORY_TEMPLATE[index].checkOut,
    payrollFinalized: true,
  })),
  corrections: [],
}

export async function getMyAttendance() {
  // Contract area: ATTENDANCE — the signed-in employee's records (Mon–Fri
  // only), newest first. Sample shape: [{ id, date: 'YYYY-MM-DD', status,
  // checkIn: 'HH:mm'|null, checkOut: 'HH:mm'|null, payrollFinalized?: boolean }].
  // Final schema pending docs/api.md.
  const records = [...store.records].sort((a, b) => b.date.localeCompare(a.date))
  return mockResponse(records)
}

export async function checkIn() {
  // Contract area: ATTENDANCE — one check-in per working day within the
  // 06:00–22:00 company-local window (spec §5). Backend validates window,
  // working day, and duplicate prevention; these mocks reproduce those
  // rejections so the UI error paths stay testable.
  const now = new Date()
  const weekday = now.getDay()
  if (weekday === 0 || weekday === 6) {
    throw new Error('Attendance is recorded on working days (Mon–Fri) only.')
  }

  const today = isoDate(now)
  let record = store.records.find((entry) => entry.date === today)

  if (record && record.checkIn) {
    throw new Error('You have already checked in today.')
  }

  if (!record) {
    record = {
      id: nextId('att'),
      date: today,
      status: 'PRESENT',
      checkIn: null,
      checkOut: null,
      payrollFinalized: false,
    }
    store.records.push(record)
  }

  record.status = 'PRESENT'
  record.checkIn = nowHHMM()
  return mockResponse({ ...record })
}

export async function checkOut() {
  // Contract area: ATTENDANCE — matching check-out for today's open record;
  // must be after check-in and within the attendance window (backend).
  const today = isoDate()
  const record = store.records.find((entry) => entry.date === today)

  if (!record || !record.checkIn) {
    throw new Error('No check-in recorded for today yet.')
  }
  if (record.checkOut) {
    throw new Error('You have already checked out today.')
  }

  record.checkOut = nowHHMM()
  return mockResponse({ ...record })
}

export async function listCorrectionRequests() {
  // Contract area: ATTENDANCE — correction requests visible to the caller
  // (own history here; Admin queue elsewhere). Newest first.
  const requests = [...store.corrections].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
  return mockResponse(requests)
}

export async function submitCorrection(payload) {
  // Contract area: ATTENDANCE — employee submits date + corrected times +
  // reason; Admin approves/rejects later. Backend enforces: at most one
  // PENDING request per employee+date, allowed transitions only (never
  // LEAVE → PRESENT, spec §5), and the finalized-payroll audit note.
  const { date, correctedCheckIn, correctedCheckOut, reason } = payload ?? {}
  const record = store.records.find((entry) => entry.date === date)

  if (!date || !record) {
    throw new Error('No attendance record exists for that date.')
  }
  if (store.corrections.some((entry) => entry.date === date && entry.status === 'PENDING')) {
    throw new Error('A correction request is already pending for this date.')
  }

  const request = {
    id: nextId('cr'),
    date,
    correctedCheckIn,
    correctedCheckOut,
    reason,
    status: 'PENDING',
    submittedAt: new Date().toISOString(),
    // Backend-provided context echoed to the UI for the warning note.
    payrollFinalized: Boolean(record.payrollFinalized),
  }
  store.corrections.push(request)
  return mockResponse(request)
}
