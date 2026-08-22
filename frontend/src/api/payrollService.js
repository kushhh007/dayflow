import { mockResponse } from './mock.js'

// MOCK SERVICE. Contract areas follow the Dayflow v4.5 spec; endpoint paths
// will be defined in docs/api.md by the backend lead and must not be invented
// here. Replace bodies with apiRequest() calls when it lands.
//
// The frontend NEVER calculates payroll: every amount, day count, and status
// below is produced by this simulated backend store and rendered verbatim by
// the UI. The demo figures are internally consistent with §4 (Basic = 50% of
// wage, HRA = 50% of Basic, PF = 12% of prorated Basic, PT = ₹200 flat,
// Net = Gross − Employee PF − PT) purely so demo data looks plausible.

function isoDate(date) {
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60 * 1000).toISOString().slice(0, 10)
}

function monthLabel(date) {
  return date.toLocaleString('en-IN', { month: 'long', year: 'numeric' })
}

let sequence = 1
const nextRunId = () => `pr-${sequence++}`
const nextPayslipId = () => `ps-${sequence++}`

const store = {
  runs: [],
  payslips: [],
}

function computeProvisionalPayslip(run) {
  // Simulated backend calculation — real values arrive from the API contract.
  const start = new Date(`${run.periodStart}T00:00:00`)
  const periodLabel = monthLabel(start)
  return {
    id: nextPayslipId(),
    runId: run.id,
    employeeName: 'Demo Employee',
    periodStart: run.periodStart,
    periodEnd: run.periodEnd,
    periodLabel,
    status: 'CALCULATED',
    gross: 52000,
    basic: 26000,
    hra: 13000,
    standardAllowance: 4167,
    performanceBonus: 2166,
    lta: 2166,
    fixedAllowance: 4501,
    employeePF: 3120,
    employerPF: 3120,
    professionalTax: 200,
    payableDays: 21,
    workingDays: 21,
    net: 48680,
  }
}

// Seed one FINALIZED previous-month run so employee/admin payslip views have
// data immediately.
;(function seed() {
  const now = new Date()
  const firstOfPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastOfPrev = new Date(now.getFullYear(), now.getMonth(), 0)
  const run = {
    id: nextRunId(),
    periodStart: isoDate(firstOfPrev),
    periodEnd: isoDate(lastOfPrev),
    periodLabel: monthLabel(firstOfPrev),
    status: 'FINALIZED',
  }
  store.runs.push(run)
  store.payslips.push({
    ...computeProvisionalPayslip(run),
    id: nextPayslipId(),
    status: 'FINALIZED',
  })
})()

export async function listPayrollRuns() {
  // Contract area: PAYROLL — runs with status DRAFT/CALCULATED/FINALIZED
  // (Admin-only). Newest periods first.
  const runs = [...store.runs].sort((a, b) => b.periodStart.localeCompare(a.periodStart))
  return mockResponse(runs.map((run) => ({ ...run })))
}

export async function createPayrollRun({ periodStart, periodEnd }) {
  // Contract area: PAYROLL — create a DRAFT run for a period (Admin only).
  // Simulated backend validations mirror spec §4: explicit period validity,
  // and duplicate-period rejection (finalized-overlap is enforced at
  // finalize time, matching the spec's guarded transition).
  if (!periodStart || !periodEnd) {
    throw new Error('Period start and end dates are required.')
  }
  if (periodStart > periodEnd) {
    throw new Error('Period start must be on or before period end.')
  }
  if (store.runs.some((run) => run.periodStart === periodStart && run.periodEnd === periodEnd)) {
    throw new Error('A payroll run already exists for this period.')
  }

  const run = {
    id: nextRunId(),
    periodStart,
    periodEnd,
    periodLabel: monthLabel(new Date(`${periodStart}T00:00:00`)),
    status: 'DRAFT',
  }
  store.runs.push(run)
  return mockResponse({ ...run })
}

export async function calculatePayrollRun(runId) {
  // Contract area: PAYROLL — trigger backend calculation (DRAFT → CALCULATED,
  // or re-run on CALCULATED; FINALIZED is terminal, spec §4). Provisional
  // payslips are replaced wholesale in the same operation.
  const run = store.runs.find((entry) => entry.id === runId)
  if (!run) {
    throw new Error('Payroll run not found.')
  }
  if (run.status === 'FINALIZED') {
    throw new Error('Finalized runs cannot be recalculated.')
  }

  run.status = 'CALCULATED'
  store.payslips = [
    ...store.payslips.filter(
      (payslip) => !(payslip.runId === run.id && payslip.status !== 'FINALIZED'),
    ),
    computeProvisionalPayslip(run),
  ]
  return mockResponse({ ...run })
}

export async function finalizePayrollRun(runId) {
  // Contract area: PAYROLL — guarded terminal transition CALCULATED →
  // FINALIZED (spec §4): only calculated runs qualify, no finalized-period
  // overlap for the company, payslips become immutable.
  const run = store.runs.find((entry) => entry.id === runId)
  if (!run || run.status !== 'CALCULATED') {
    throw new Error('Only calculated runs can be finalized.')
  }
  const overlap = store.runs.some(
    (other) =>
      other.id !== run.id &&
      other.status === 'FINALIZED' &&
      other.periodStart <= run.periodEnd &&
      run.periodStart <= other.periodEnd,
  )
  if (overlap) {
    throw new Error('Period overlaps an already finalized payroll run.')
  }

  run.status = 'FINALIZED'
  store.payslips.forEach((payslip) => {
    if (payslip.runId === run.id) payslip.status = 'FINALIZED'
  })
  return mockResponse({ ...run })
}

export async function listPayslips() {
  // Contract area: PAYROLL — the signed-in employee's OWN payslips only
  // (spec §3): gross, itemized components/deductions, net. The SalaryStructure
  // configuration entity is never part of these payloads.
  const payslips = store.payslips
    .filter((payslip) => payslip.employeeName === 'Demo Employee')
    .sort((a, b) => b.periodStart.localeCompare(a.periodStart))
  return mockResponse(payslips.map((payslip) => ({ ...payslip })))
}

export async function listAllPayslips() {
  // Contract area: PAYROLL — Admin view across employees (spec §3/§4),
  // including the component snapshot stored at finalization.
  const payslips = [...store.payslips].sort((a, b) => b.periodStart.localeCompare(a.periodStart))
  return mockResponse(payslips.map((payslip) => ({ ...payslip })))
}
