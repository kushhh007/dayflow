import { mockResponse, DEMO_LEAVE_REQUESTS, DEMO_LEAVE_BALANCES } from './mock.js'

// MOCK SERVICE. Contract areas follow the Dayflow v4.5 spec; endpoint paths
// will be defined in docs/api.md by the backend lead and must not be invented
// here. Replace bodies with apiRequest() calls when it lands.

export async function listLeaveRequests() {
  // Contract area: LEAVE — requests visible to the caller (own vs Admin queue).
  return mockResponse(DEMO_LEAVE_REQUESTS)
}

export async function getLeaveBalances() {
  // Contract area: LEAVE — Available = Allocated − ApprovedOrUsed per type.
  return mockResponse(DEMO_LEAVE_BALANCES)
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
