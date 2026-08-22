const MOCK_LATENCY_MS = 200

/**
 * Simulates network latency and deep-clones the payload so mocked services
 * behave closer to a real API while the shell is developed.
 */
export function mockResponse(data, { latencyMs = MOCK_LATENCY_MS } = {}) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(structuredClone(data)), latencyMs)
  })
}

// ---------------------------------------------------------------------------
// Demo dataset — fictional people and numbers for UI development only.
// Shapes follow the Dayflow v4.5 spec contract areas; real data arrives via
// the API once docs/api.md lands.
// ---------------------------------------------------------------------------

export const DEMO_EMPLOYEE = {
  id: 'emp-1042',
  loginId: 'demo.employee',
  name: 'Aarav Menon',
  title: 'Frontend Engineer',
  department: 'Engineering',
  joinedOn: '2025-02-10',
  role: 'EMPLOYEE',
}

export const DEMO_ADMIN = {
  id: 'emp-1001',
  loginId: 'demo.admin',
  name: 'Priya Sharma',
  title: 'HR Manager',
  department: 'People Ops',
  joinedOn: '2024-06-03',
  role: 'ADMIN',
}

export const DEMO_TEAM = [
  DEMO_ADMIN,
  { id: 'emp-1017', loginId: 'r.kulkarni', name: 'Rohan Kulkarni', title: 'Backend Engineer', department: 'Engineering', joinedOn: '2024-08-19', role: 'EMPLOYEE' },
  { id: 'emp-1031', loginId: 's.iyer', name: 'Sneha Iyer', title: 'QA Analyst', department: 'Engineering', joinedOn: '2024-11-04', role: 'EMPLOYEE' },
  { id: 'emp-1042', ...DEMO_EMPLOYEE },
]

export const DEMO_ATTENDANCE_WEEK = [
  { id: 'att-1', date: 'Mon', dayLabel: 'Monday', checkIn: '09:02', checkOut: '18:05', hours: '8h 03m', status: 'PRESENT' },
  { id: 'att-2', date: 'Tue', dayLabel: 'Tuesday', checkIn: '08:55', checkOut: '17:58', hours: '8h 03m', status: 'PRESENT' },
  { id: 'att-3', date: 'Wed', dayLabel: 'Wednesday', checkIn: '—', checkOut: '—', hours: '0h 00m', status: 'LEAVE' },
  { id: 'att-4', date: 'Thu', dayLabel: 'Thursday', checkIn: '09:12', checkOut: null, hours: 'Running', status: 'PRESENT' },
  { id: 'att-5', date: 'Fri', dayLabel: 'Friday', checkIn: null, checkOut: null, hours: '—', status: 'WEEKEND' },
]

export const DEMO_LEAVE_REQUESTS = [
  { id: 'lv-301', type: 'ANNUAL', from: '2026-08-19', to: '2026-08-20', days: 2, status: 'APPROVED', appliedOn: '2026-08-05' },
  { id: 'lv-302', type: 'ANNUAL', from: '2026-09-14', to: '2026-09-16', days: 3, status: 'PENDING', appliedOn: '2026-08-14' },
  { id: 'lv-297', type: 'SICK', from: '2026-07-27', to: '2026-07-27', days: 1, status: 'APPROVED', appliedOn: '2026-07-27' },
  { id: 'lv-288', type: 'UNPAID', from: '2026-06-30', to: '2026-06-30', days: 1, status: 'REJECTED', appliedOn: '2026-06-24' },
]

export const DEMO_LEAVE_BALANCES = [
  { type: 'ANNUAL', allocated: 24, usedOrApproved: 3 },
  { type: 'SICK', allocated: 12, usedOrApproved: 1 },
  { type: 'UNPAID', allocated: 0, usedOrApproved: 0 },
]

export const DEMO_PAYSLIPS = [
  { id: 'ps-2026-07', period: 'July 2026', workingDays: 23, payableDays: 23, gross: '₹1,42,000', deductions: '₹21,300', net: '₹1,20,700', status: 'FINALIZED' },
  { id: 'ps-2026-06', period: 'June 2026', workingDays: 22, payableDays: 21, gross: '₹1,42,000', deductions: '₹21,300', net: '₹1,15,130', status: 'FINALIZED' },
  { id: 'ps-2026-05', period: 'May 2026', workingDays: 21, payableDays: 21, gross: '₹1,42,000', deductions: '₹21,300', net: '₹1,20,700', status: 'FINALIZED' },
]

export const DEMO_NOTIFICATIONS = [
  { id: 'nt-91', kind: 'PAYROLL_READY', message: 'Your July 2026 payslip is ready for review.', createdOn: '2026-08-01', isRead: false },
  { id: 'nt-88', kind: 'LEAVE_APPROVED', message: 'Annual leave 19–20 Aug was approved.', createdOn: '2026-08-07', isRead: true },
  { id: 'nt-84', kind: 'ATTENDANCE_ANOMALY', message: 'Missing check-out recorded on 28 Jul — file a correction.', createdOn: '2026-07-29', isRead: true },
]
