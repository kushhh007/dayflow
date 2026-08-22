import { mockResponse } from './mock.js'

// MOCK SERVICE. Contract areas follow the Dayflow v4.5 spec; endpoint paths
// will be defined in docs/api.md by the backend lead and must not be invented
// here. Replace bodies with apiRequest() calls when it lands.

export async function listLeaveRequests() {
  // Contract area: LEAVE — requests visible to the caller (own vs Admin queue).
  // Sample shape: [{ id, type: 'PAID'|'SICK'|'UNPAID', startDate, endDate,
  // days, status }]. Final schema pending docs/api.md.
  const today = new Date()
  const shift = (days) => {
    const date = new Date(today)
    date.setDate(date.getDate() + days)
    return date.toISOString().slice(0, 10)
  }
  const requests = [
    { id: 'lr-sample-1', type: 'PAID', startDate: shift(4), endDate: shift(5), days: 2, status: 'PENDING' },
    { id: 'lr-sample-2', type: 'SICK', startDate: shift(-9), endDate: shift(-9), days: 1, status: 'APPROVED' },
    { id: 'lr-sample-3', type: 'UNPAID', startDate: shift(-30), endDate: shift(-29), days: 2, status: 'REJECTED' },
  ]
  return mockResponse(requests)
}

export async function getLeaveBalances() {
  // Contract area: LEAVE — Available = Allocated − ApprovedOrUsed per type.
  // `available` is a server-computed value; the frontend only renders it.
  // Unpaid has no allocation (spec §6), hence null allocated/available.
  const balances = [
    { type: 'PAID', allocated: 18, approvedOrUsed: 6, available: 12 },
    { type: 'SICK', allocated: 12, approvedOrUsed: 2, available: 10 },
    { type: 'UNPAID', allocated: null, approvedOrUsed: 0, available: null },
  ]
  return mockResponse(balances)
}

export async function applyLeave(payload) {
  // Contract area: LEAVE — full-day requests only; Sick requires an attachment
  // (frontend-enforced here, backend-enforced too); no cross-year spans.
  return mockResponse({ id: null, status: 'PENDING', ...payload })
}

export async function cancelLeaveRequest(requestId) {
  // Contract area: LEAVE — employee cancels own PENDING request only;
  // APPROVED leave is terminal for everyone (spec §6).
  return mockResponse({ id: requestId, status: 'CANCELLED' })
}

export async function approveLeaveRequest(requestId) {
  // Contract area: LEAVE — Admin-only guarded approval; never one's own request.
  return mockResponse({ id: requestId, status: 'APPROVED' })
}

export async function rejectLeaveRequest(requestId) {
  // Contract area: LEAVE — Admin-only guarded rejection of PENDING requests.
  return mockResponse({ id: requestId, status: 'REJECTED' })
}
