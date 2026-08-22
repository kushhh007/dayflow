import { mockResponse, DEMO_PAYSLIPS } from './mock.js'

// MOCK SERVICE. Contract areas follow the Dayflow v4.5 spec; endpoint paths
// will be defined in docs/api.md by the backend lead and must not be invented
// here. Replace bodies with apiRequest() calls when it lands.
//
// The frontend NEVER calculates payroll. All amounts, payable/working days,
// and payslip snapshots are computed by the backend (spec §4) and only
// displayed here.

export async function listPayrollRuns() {
  // Contract area: PAYROLL — runs with status DRAFT/CALCULATED/FINALIZED.
  // Admin-only.
  return mockResponse([])
}

export async function createPayrollRun(period) {
  // Contract area: PAYROLL — create run in DRAFT for a period (Admin only).
  return mockResponse({ id: null, status: 'DRAFT', ...period })
}

export async function calculatePayrollRun(runId) {
  // Contract area: PAYROLL — trigger backend calculation; provisional payslips
  // are generated/replaced wholesale server-side.
  return mockResponse({ id: runId, status: 'CALCULATED' })
}

export async function finalizePayrollRun(runId) {
  // Contract area: PAYROLL — terminal transition; payslips become immutable.
  return mockResponse({ id: runId, status: 'FINALIZED' })
}

export async function listPayslips() {
  // Contract area: PAYROLL — own payslips (employee) or all (Admin). Employees
  // never see the underlying SalaryStructure (spec §3).
  return mockResponse(DEMO_PAYSLIPS)
}
