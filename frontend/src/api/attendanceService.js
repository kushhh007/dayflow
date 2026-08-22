import { mockResponse } from './mock.js'

// MOCK SERVICE. Contract areas follow the Dayflow v4.5 spec; endpoint paths
// will be defined in docs/api.md by the backend lead and must not be invented
// here. Replace bodies with apiRequest() calls when it lands.

function isoDate(date) {
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60 * 1000).toISOString().slice(0, 10)
}

// Recent Monday–Friday dates ending today (today only included on weekdays,
// matching the spec's working-days-only attendance model).
function recentWorkingDates(count) {
  const dates = []
  const cursor = new Date()
  while (dates.length < count) {
    const weekday = cursor.getDay()
    if (weekday !== 0 && weekday !== 6) {
      dates.unshift(isoDate(cursor))
    }
    cursor.setDate(cursor.getDate() - 1)
  }
  return dates
}

export async function getMyAttendance() {
  // Contract area: ATTENDANCE — the signed-in employee's records (Mon–Fri only).
  // Sample shape: [{ id, date: 'YYYY-MM-DD', status, checkIn: 'HH:mm'|null,
  // checkOut: 'HH:mm'|null }]. Final schema pending docs/api.md.
  const records = [
    {
      id: 'att-sample-1',
      date: recentWorkingDates(1)[0],
      status: 'PRESENT',
      checkIn: '09:02',
      checkOut: null,
    },
  ]
  return mockResponse(records)
}

export async function checkIn() {
  // Contract area: ATTENDANCE — one check-in per working day within the
  // 06:00–22:00 company-local window (spec §5). Backend validates.
  return mockResponse({ success: true })
}

export async function checkOut() {
  // Contract area: ATTENDANCE — matching check-out for today's record.
  return mockResponse({ success: true })
}

export async function listCorrectionRequests() {
  // Contract area: ATTENDANCE — correction requests; Admin queue or own history.
  return mockResponse([])
}

export async function submitCorrection(payload) {
  // Contract area: ATTENDANCE — one PENDING correction per employee+date;
  // allowed transitions restricted to spec §5 (never LEAVE → PRESENT).
  return mockResponse({ id: null, status: 'PENDING', ...payload })
}
