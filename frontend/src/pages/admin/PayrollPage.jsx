import { useRef, useState } from 'react'
import { useAsyncData } from '../../hooks/useAsyncData.js'
import DashboardCard from '../../components/ui/DashboardCard.jsx'
import StatusBadge from '../../components/ui/StatusBadge.jsx'
import Loading from '../../components/states/Loading.jsx'
import EmptyState from '../../components/states/EmptyState.jsx'
import ErrorState from '../../components/states/ErrorState.jsx'
import * as payrollService from '../../api/payrollService.js'
import './payrollPage.css'

// Admin payroll (spec §4 scope): create DRAFT runs, calculate (re-runnable on
// CALCULATED), finalize. The UI performs no payroll math — all amounts and
// day counts come from the service — and offers no transitions outside the
// locked state machine: FINALIZED is terminal, with no reopen or edit.

const monthFormat = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
})

function formatDay(dateString) {
  return monthFormat.format(new Date(`${dateString}T00:00:00`))
}

function monthBounds(month) {
  const [year, monthIndex] = month.split('-').map(Number)
  const first = new Date(year, monthIndex - 1, 1)
  const last = new Date(year, monthIndex, 0)
  const offset = (date) => {
    const shifted = date.getTimezoneOffset()
    return new Date(date.getTime() - shifted * 60 * 1000).toISOString().slice(0, 10)
  }
  return { periodStart: offset(first), periodEnd: offset(last) }
}

export default function PayrollPage() {
  const { loading, data, errors, retry } = useAsyncData({
    runs: payrollService.listPayrollRuns,
    payslips: payrollService.listAllPayslips,
  })

  const [month, setMonth] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(null)
  const [createdRun, setCreatedRun] = useState(null)

  const [busyId, setBusyId] = useState(null)
  const [busyAction, setBusyAction] = useState(null)
  const [actionError, setActionError] = useState(null)
  const createLockRef = useRef(false)
  const actionLockRef = useRef(false)

  if (loading) {
    return (
      <section className="page">
        <h1>Payroll Runs</h1>
        <Loading label="Loading payroll…" />
      </section>
    )
  }

  const runs = Array.isArray(data.runs) ? data.runs : []
  const payslips = Array.isArray(data.payslips) ? data.payslips : []

  async function handleCreate(event) {
    event.preventDefault()
    if (createLockRef.current || creating || !month) {
      if (!month) setCreateError('Select a payroll period.')
      return
    }
    createLockRef.current = true
    setCreating(true)
    setCreateError(null)
    try {
      const run = await payrollService.createPayrollRun(monthBounds(month))
      setCreatedRun(run)
      setMonth('')
      retry()
    } catch (err) {
      setCreatedRun(null)
      setCreateError(err.message || 'Could not create the payroll run.')
    } finally {
      setCreating(false)
      createLockRef.current = false
    }
  }

  async function handleAction(runId, action) {
    if (actionLockRef.current || busyId) return
    actionLockRef.current = true
    setBusyId(runId)
    setBusyAction(action)
    setActionError(null)
    try {
      if (action === 'calculate') await payrollService.calculatePayrollRun(runId)
      else await payrollService.finalizePayrollRun(runId)
      retry()
    } catch (err) {
      setActionError(err.message || 'Action failed.')
    } finally {
      setBusyId(null)
      setBusyAction(null)
      actionLockRef.current = false
    }
  }

  return (
    <section className="page att">
      <header className="page__header">
        <h1>Payroll Runs</h1>
        <p className="page__description">
          Create a monthly period, calculate provisional payslips, review, then finalize.
          Finalized runs are permanent and cannot be reopened.
        </p>
      </header>

      <div className="att__grid att__grid--single">
        <DashboardCard title="Create a payroll run">
          <form className="att-form" onSubmit={handleCreate} noValidate>
            <label className="att-field">
              <span>Payroll period</span>
              <input
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                disabled={creating}
              />
            </label>

            {createError && (
              <p className="att-banner att-banner--error" role="alert">
                {createError}
              </p>
            )}
            {createdRun && (
              <p className="att-banner att-banner--success">
                Created {createdRun.periodLabel} as DRAFT. Calculate it when ready.
              </p>
            )}

            <div>
              <button type="submit" className="btn" disabled={creating}>
                {creating ? 'Creating…' : 'Create draft run'}
              </button>
            </div>
          </form>
        </DashboardCard>

        <DashboardCard title={`Runs (${runs.length})`}>
          {errors.runs ? (
            <ErrorState title="Could not load payroll runs" onRetry={retry} />
          ) : runs.length === 0 ? (
            <EmptyState title="No payroll runs yet" message="Create your first period above." />
          ) : (
            <>
              {actionError && (
                <p className="att-banner att-banner--error" role="alert">
                  {actionError}
                </p>
              )}
              <ul className="att-list">
                {runs.map((run) => {
                  const runPayslips = payslips.filter((payslip) => payslip.runId === run.id)
                  const busy = busyId === run.id
                  return (
                    <li key={run.id} className="att-row payroll-run">
                      <div>
                        <p className="att-row__title">
                          {run.periodLabel}
                          <span className="payroll-run__dates">
                            {formatDay(run.periodStart)} – {formatDay(run.periodEnd)}
                          </span>
                        </p>
                        <p className="att-row__meta">
                          {run.status === 'DRAFT' && 'Not calculated yet.'}
                          {run.status === 'CALCULATED' &&
                            `${runPayslips.length} provisional payslip${runPayslips.length === 1 ? '' : 's'} — replaced on recalculation.`}
                          {run.status === 'FINALIZED' &&
                            `${runPayslips.length} final payslip${runPayslips.length === 1 ? '' : 's'} · immutable.`}
                        </p>
                      </div>
                      <div className="payroll-run__actions">
                        <StatusBadge status={run.status} />
                        {(run.status === 'DRAFT' || run.status === 'CALCULATED') && (
                          <button
                            type="button"
                            className="leave-cancel"
                            disabled={Boolean(busyId)}
                            onClick={() => handleAction(run.id, 'calculate')}
                          >
                            {busy && busyAction === 'calculate'
                              ? 'Calculating…'
                              : run.status === 'DRAFT'
                                ? 'Calculate'
                                : 'Recalculate'}
                          </button>
                        )}
                        {(run.status === 'DRAFT' || run.status === 'CALCULATED') && (
                          <button
                            type="button"
                            className="btn"
                            disabled={Boolean(busyId) || run.status !== 'CALCULATED'}
                            title={
                              run.status === 'DRAFT'
                                ? 'Calculate the run before finalizing.'
                                : undefined
                            }
                            onClick={() => handleAction(run.id, 'finalize')}
                          >
                            {busy && busyAction === 'finalize' ? 'Finalizing…' : 'Finalize'}
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </DashboardCard>

        <DashboardCard title={`Payslips (${payslips.length})`} to="/admin/payslips" actionLabel="Open full view">
          {errors.payslips ? (
            <ErrorState title="Could not load payslips" onRetry={retry} />
          ) : payslips.length === 0 ? (
            <EmptyState title="No payslips yet" />
          ) : (
            <>
              <ul className="att-list">
                {payslips.slice(0, 3).map((payslip) => (
                  <li key={payslip.id} className="att-row">
                    <div>
                      <p className="att-row__title">
                        {payslip.employeeName} · {payslip.periodLabel}
                      </p>
                        <p className="att-row__meta">
                          Net ₹{payslip.net == null ? '—' : Number(payslip.net).toLocaleString('en-IN')}
                        </p>
                    </div>
                    <StatusBadge status={payslip.status} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </DashboardCard>
      </div>
    </section>
  )
}
