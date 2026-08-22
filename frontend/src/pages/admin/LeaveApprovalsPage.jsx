import { useRef, useState } from 'react'
import { useAsyncData } from '../../hooks/useAsyncData.js'
import DashboardCard from '../../components/ui/DashboardCard.jsx'
import StatusBadge from '../../components/ui/StatusBadge.jsx'
import Loading from '../../components/states/Loading.jsx'
import EmptyState from '../../components/states/EmptyState.jsx'
import ErrorState from '../../components/states/ErrorState.jsx'
import * as leaveService from '../../api/leaveService.js'
import './leaveApprovals.css'

// Admin leave approvals (spec §6/§10): Attention-ranked queue of PENDING
// requests. Ranking, scores, and breakdowns arrive pre-computed and
// pre-sorted from the service — the frontend renders them verbatim and
// performs no scoring. Approval/rejection are guarded transitions; APPROVED
// is terminal (spec §6), so no undo/cancel controls exist anywhere here.

const dayFormat = new Intl.DateTimeFormat('en-IN', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})

const LEAVE_TYPE_LABELS = {
  PAID: 'Paid Time Off',
  SICK: 'Sick Leave',
  UNPAID: 'Unpaid Leave',
}

function formatRange(start, end) {
  const startLabel = dayFormat.format(new Date(`${start}T00:00:00`))
  if (start === end) return startLabel
  return `${startLabel} – ${dayFormat.format(new Date(`${end}T00:00:00`))}`
}

export default function LeaveApprovalsPage() {
  const { loading, data, errors, retry } = useAsyncData({
    queue: leaveService.listApprovalQueue,
    requests: leaveService.listAllLeaveRequests,
  })

  const [busyId, setBusyId] = useState(null)
  const [actionError, setActionError] = useState(null)
  const actionLockRef = useRef(false)

  if (loading) {
    return (
      <section className="page">
        <h1>Leave Approvals</h1>
        <Loading label="Loading approval queue…" />
      </section>
    )
  }

  async function handleDecision(requestId, decision) {
    if (actionLockRef.current || busyId) return
    actionLockRef.current = true
    setBusyId(requestId)
    setActionError(null)
    try {
      if (decision === 'approve') await leaveService.approveLeaveRequest(requestId)
      else await leaveService.rejectLeaveRequest(requestId)
      retry()
    } catch (err) {
      setActionError(err.message || 'Could not record the decision.')
    } finally {
      setBusyId(null)
      actionLockRef.current = false
    }
  }

  const queue = Array.isArray(data.queue) ? data.queue : []
  const requests = Array.isArray(data.requests) ? data.requests : []

  return (
    <section className="page att">
      <header className="page__header">
        <h1>Leave Approvals</h1>
        <p className="page__description">
          Pending requests ranked by attention score — highest risk first.
        </p>
      </header>

      <div className="att__grid att__grid--single">
        <DashboardCard title={`Pending requests (${queue.length})`}>
          {errors.queue ? (
            <ErrorState title="Could not load the approval queue" onRetry={retry} />
          ) : queue.length === 0 ? (
            <EmptyState
              title="No pending leave requests"
              message="All leave requests have been processed."
            />
          ) : (
            <>
              {actionError && (
                <p className="att-banner att-banner--error" role="alert">
                  {actionError}
                </p>
              )}
              <ul className="att-list">
                {queue.map((item) => (
                  <li key={item.id} className="approval-row">
                    <div className="approval-row__main">
                      <div className="approval-row__head">
                        <p className="att-row__title">
                          {item.employeeName} · {LEAVE_TYPE_LABELS[item.type] ?? item.type}
                        </p>
                        {item.attentionScore != null && (
                          <span className="approval-score">
                            Attention {item.attentionScore}
                          </span>
                        )}
                      </div>
                      <p className="att-row__meta">
                        {formatRange(item.startDate, item.endDate)} · {item.days}{' '}
                        {item.days === 1 ? 'day' : 'days'}
                      </p>
                      {item.reason && <p className="att-row__meta">“{item.reason}”</p>}
                      {item.attachmentName && (
                        <p className="att-row__meta">📎 {item.attachmentName}</p>
                      )}
                      {Array.isArray(item.breakdown) && item.breakdown.length > 0 && (
                        <p className="approval-breakdown">
                          {item.breakdown
                            .map((entry) => `+${entry.points} ${entry.label}`)
                            .join(' · ')}
                        </p>
                      )}
                    </div>
                    <div className="approval-row__actions">
                      <button
                        type="button"
                        className="btn"
                        disabled={Boolean(busyId)}
                        onClick={() => handleDecision(item.id, 'approve')}
                      >
                        {busyId === item.id ? 'Working…' : 'Approve'}
                      </button>
                      <button
                        type="button"
                        className="leave-cancel"
                        disabled={Boolean(busyId)}
                        onClick={() => handleDecision(item.id, 'reject')}
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

        <DashboardCard title="Employee leave records">
          {errors.requests ? (
            <ErrorState title="Could not load employee leave records" onRetry={retry} />
          ) : requests.length === 0 ? (
            <EmptyState title="No employee leave records" message="No leave records were returned." />
          ) : (
            <ul className="att-list">
              {requests.map((request) => (
                <li key={request.id} className="att-row">
                  <div>
                    <p className="att-row__title">
                      {request.employeeName || 'Employee'} · {LEAVE_TYPE_LABELS[request.type] ?? request.type}
                    </p>
                    <p className="att-row__meta">
                      {formatRange(request.startDate, request.endDate)} · {request.days}{' '}
                      {request.days === 1 ? 'day' : 'days'}
                      {request.attachmentName ? ` · Attachment: ${request.attachmentName}` : ''}
                    </p>
                  </div>
                  <StatusBadge status={request.status} />
                </li>
              ))}
            </ul>
          )}
        </DashboardCard>

        <DashboardCard title="How ranking works">
          <p className="att-row__meta">
            Each pending request carries a server-computed attention score with its per-rule
            breakdown (coverage risk +40 · low balance +25 · unexplained absence +20 · anomaly +15).
            Approved and rejected requests leave this queue permanently — approved leave is final.
          </p>
        </DashboardCard>
      </div>
    </section>
  )
}
