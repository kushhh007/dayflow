import { mockResponse } from './mock.js'

// MOCK SERVICE. Contract areas follow the Dayflow v4.5 spec; endpoint paths
// will be defined in docs/api.md by the backend lead and must not be invented
// here. Replace bodies with apiRequest() calls when it lands.
//
// The store below SIMULATES backend behavior (including rejections) so the
// leave UI can be developed and demoed. It implements no real domain logic:
// balance math, transactional approvals, attendance updates, and Ops scoring
// stay backend-owned per spec §6/§10.

function isoDate(date = new Date()) {
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60 * 1000).toISOString().slice(0, 10)
}

function shiftDate(days) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return isoDate(date)
}

// Inclusive calendar-day count (leave balances count calendar days, including
// weekends/holidays, per spec §6).
function calendarDays(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  return Math.round((end - start) / (24 * 60 * 60 * 1000)) + 1
}

function overlaps(startA, endA, startB, endB) {
  return startA <= endB && startB <= endA
}

let sequence = 1
const nextId = () => `lr-${sequence++}`

const store = {
  // `available` is a server-computed value; the frontend only renders it.
  // Unpaid has no allocation (spec §6), hence null allocated/available.
  balances: [
    { type: 'PAID', allocated: 18, approvedOrUsed: 6, available: 12 },
    { type: 'SICK', allocated: 12, approvedOrUsed: 2, available: 10 },
    { type: 'UNPAID', allocated: null, approvedOrUsed: 0, available: null },
  ],
  requests: [
    {
      id: nextId(),
      employeeName: 'Demo Employee',
      type: 'PAID',
      startDate: shiftDate(3),
      endDate: shiftDate(9),
      days: 7,
      reason: 'Family function out of town.',
      status: 'PENDING',
      submittedAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
      // Server-provided Ops context (spec §10): rendered verbatim by the UI.
      attentionScore: 65,
      breakdown: [
        { label: 'Department coverage HIGH', points: 40 },
        { label: 'Leave balance ≤10%', points: 25 },
      ],
    },
    {
      id: nextId(),
      employeeName: 'Demo Employee',
      type: 'SICK',
      startDate: shiftDate(-9),
      endDate: shiftDate(-9),
      days: 1,
      reason: 'Fever, doctor advised rest.',
      attachmentName: 'medical-note.pdf',
      status: 'APPROVED',
      submittedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: nextId(),
      employeeName: 'Demo Employee',
      type: 'UNPAID',
      startDate: shiftDate(-30),
      endDate: shiftDate(-29),
      days: 2,
      reason: 'Personal travel.',
      status: 'REJECTED',
      submittedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ],
}

export async function getLeaveBalances() {
  // Contract area: LEAVE — Available = Allocated − ApprovedOrUsed per type
  // (server-computed; frontend renders values verbatim).
  return mockResponse(store.balances.map((balance) => ({ ...balance })))
}

export async function listLeaveRequests() {
  // Contract area: LEAVE — requests visible to the caller (own history here;
  // Admin queue via listApprovalQueue). Newest first. Sample shape:
  // [{ id, type, startDate, endDate, days, reason, attachmentName?, status,
  // submittedAt }]. Final schema pending docs/api.md.
  const requests = [...store.requests].sort((a, b) => b.startDate.localeCompare(a.startDate))
  return mockResponse(requests)
}

export async function listApprovalQueue() {
  // Contract area: OPS/LEAVE — Attention-ranked pending queue for Admins
  // (spec §10). Scores and breakdowns are server-provided and arrive
  // pre-sorted; the frontend renders them verbatim and performs no scoring.
  // Shape pending docs/api.md.
  const pending = store.requests
    .filter((request) => request.status === 'PENDING')
    .map((request) => ({
      id: request.id,
      employeeName: request.employeeName,
      type: request.type,
      startDate: request.startDate,
      endDate: request.endDate,
      days: request.days,
      reason: request.reason,
      attachmentName: request.attachmentName ?? null,
      attentionScore: request.attentionScore ?? null,
      breakdown: request.breakdown ?? [],
    }))
    .sort((a, b) => (b.attentionScore ?? 0) - (a.attentionScore ?? 0))
  return mockResponse(pending)
}

export async function applyLeave(payload) {
  // Contract area: LEAVE — full-day requests only. Simulated backend
  // validations mirror spec §6: known type, date order, no cross-calendar-
  // year spans, Sick attachment required (frontend AND backend), non-empty
  // reason, and no overlap with an existing PENDING/APPROVED request.
  const { type, startDate, endDate, reason, attachmentName } = payload ?? {}

  if (!['PAID', 'SICK', 'UNPAID'].includes(type)) {
    throw new Error('Select a valid leave type.')
  }
  if (!startDate || !endDate) {
    throw new Error('Start and end dates are required.')
  }
  if (endDate < startDate) {
    throw new Error('End date must be on or after the start date.')
  }
  if (startDate.slice(0, 4) !== endDate.slice(0, 4)) {
    throw new Error('Leave requests cannot span two calendar years.')
  }
  if (type === 'SICK' && !attachmentName) {
    throw new Error('Sick leave requires an attachment.')
  }
  if (!reason || !reason.trim()) {
    throw new Error('A reason is required.')
  }
  const conflict = store.requests.find(
    (request) =>
      ['PENDING', 'APPROVED'].includes(request.status) &&
      overlaps(startDate, endDate, request.startDate, request.endDate),
  )
  if (conflict) {
    throw new Error('These dates overlap an existing pending or approved request.')
  }

  const request = {
    id: nextId(),
    employeeName: 'Demo Employee',
    type,
    startDate,
    endDate,
    days: calendarDays(startDate, endDate),
    reason: reason.trim(),
    ...(type === 'SICK' ? { attachmentName } : {}),
    status: 'PENDING',
    submittedAt: new Date().toISOString(),
  }
  store.requests.push(request)
  return mockResponse({ ...request })
}

export async function cancelLeaveRequest(requestId) {
  // Contract area: LEAVE — employees cancel their own PENDING requests only;
  // PENDING has zero side effects. APPROVED is terminal for everyone (§6).
  const request = store.requests.find((entry) => entry.id === requestId)
  if (!request) {
    throw new Error('Leave request not found.')
  }
  if (request.status !== 'PENDING') {
    throw new Error('Only pending leave requests can be cancelled.')
  }
  request.status = 'CANCELLED'
  return mockResponse({ ...request })
}

export async function approveLeaveRequest(requestId) {
  // Contract area: LEAVE — Admin-only guarded approval (never one's own).
  // Real approval atomically updates Attendance to LEAVE on Mon–Fri dates,
  // increments ApprovedOrUsed, and writes notification + audit entries
  // (spec §6). This mock changes only the request status.
  const request = store.requests.find((entry) => entry.id === requestId)
  if (!request || request.status !== 'PENDING') {
    throw new Error('Only pending requests can be approved.')
  }
  request.status = 'APPROVED'
  return mockResponse({ ...request })
}

export async function rejectLeaveRequest(requestId) {
  // Contract area: LEAVE — Admin-only guarded rejection of PENDING requests;
  // rejection has no balance effect (pending never consumed allocation).
  const request = store.requests.find((entry) => entry.id === requestId)
  if (!request || request.status !== 'PENDING') {
    throw new Error('Only pending requests can be rejected.')
  }
  request.status = 'REJECTED'
  return mockResponse({ ...request })
}
