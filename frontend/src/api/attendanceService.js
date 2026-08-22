import { mockResponse, DEMO_ATTENDANCE_WEEK } from './mock.js'

// MOCK SERVICE. Contract areas follow the Dayflow v4.5 spec; endpoint paths
// will be defined in docs/api.md by the backend lead and must not be invented
// here. Replace bodies with apiRequest() calls when it lands.

export async function getMyAttendance() {
  // Contract area: ATTENDANCE — the signed-in employee's records (Mon–Fri only).
  return mockResponse(DEMO_ATTENDANCE_WEEK)
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
