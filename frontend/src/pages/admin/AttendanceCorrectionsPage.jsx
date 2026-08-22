import { useRef, useState } from 'react'
import { useAsyncData } from '../../hooks/useAsyncData.js'
import DashboardCard from '../../components/ui/DashboardCard.jsx'
import AttentionScore from '../../components/ui/AttentionScore.jsx'
import Loading from '../../components/states/Loading.jsx'
import EmptyState from '../../components/states/EmptyState.jsx'
import ErrorState from '../../components/states/ErrorState.jsx'
import * as attendanceService from '../../api/attendanceService.js'
import './attendanceCorrections.css'

const dayFormat = new Intl.DateTimeFormat('en-IN', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})

function formatDay(value) {
  return dayFormat.format(new Date(`${value}T00:00:00`))
}

// Admin correction queue. The backend owns the guarded transaction that
// applies Attendance, AuditLog, and notifications; this mock UI only calls
// the service transition and renders its result.
export default function AttendanceCorrectionsPage() {
  const { loading, data, errors, retry } = useAsyncData({
    queue: attendanceService.listCorrectionQueue,
  })
  const [busyId, setBusyId] = useState(null)
  const [actionError, setActionError] = useState(null)
  const actionLockRef = useRef(false)

  if (loading) {
    return (
      <section className="page">
        <h1>Attendance Corrections</h1>
        <Loading label="Loading correction queue…" />
      </section>
    )
  }

  const queue = Array.isArray(data.queue) ? data.queue : []

  async function handleDecision(requestId, decision) {
    if (actionLockRef.current || busyId) return
    actionLockRef.current = true
    setBusyId(requestId)
    setActionError(null)
    try {
      if (decision === 'approve') await attendanceService.approveCorrectionRequest(requestId)
      else await attendanceService.rejectCorrectionRequest(requestId)
      retry()
    } catch (error) {
      setActionError(error.message || 'Could not record the decision.')
    } finally {
      setBusyId(null)
      actionLockRef.current = false
    }
  }

  return (
    <section className="page">
      <header className="page__header">
        <h1>Attendance Corrections</h1>
        <p className="page__description">
          Review pending employee correction requests ranked by supplied attention data.
        </p>
      </header>

      <DashboardCard title={`Pending corrections (${queue.length})`}>
        {errors.queue ? (
          <ErrorState title="Could not load correction queue" onRetry={retry} />
        ) : queue.length === 0 ? (
          <EmptyState title="No pending corrections" message="The correction queue is clear." />
        ) : (
          <>
            {actionError && (
              <p className="att-banner att-banner--error" role="alert">
                {actionError}
              </p>
            )}
            <ul className="att-list">
              {queue.map((request) => (
                <li className="correction-row" key={request.id}>
                  <div>
                    <p className="att-row__title">
                      {request.employeeName} · {formatDay(request.date)}
                    </p>
                    <p className="att-row__meta">
                      {request.correctedCheckIn} – {request.correctedCheckOut} · {request.reason}
                    </p>
                    {request.payrollFinalized && (
                      <p className="att-row__flag">
                        Payroll finalized — this correction does not affect the existing payslip.
                      </p>
                    )}
                    <AttentionScore score={request.attentionScore} breakdown={request.breakdown} />
                  </div>
                  <div className="correction-row__actions">
                    <button
                      type="button"
                      className="btn"
                      disabled={Boolean(busyId)}
                      onClick={() => handleDecision(request.id, 'approve')}
                    >
                      {busyId === request.id ? 'Working…' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      className="leave-cancel"
                      disabled={Boolean(busyId)}
                      onClick={() => handleDecision(request.id, 'reject')}
                    >
                      Reject
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </DashboardCard>
    </section>
  )
}
