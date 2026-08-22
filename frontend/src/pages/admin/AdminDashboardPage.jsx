import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import { useAsyncData } from '../../hooks/useAsyncData.js'
import DashboardCard from '../../components/ui/DashboardCard.jsx'
import AttentionScore from '../../components/ui/AttentionScore.jsx'
import StatusBadge from '../../components/ui/StatusBadge.jsx'
import Loading from '../../components/states/Loading.jsx'
import EmptyState from '../../components/states/EmptyState.jsx'
import ErrorState from '../../components/states/ErrorState.jsx'
import * as attendanceService from '../../api/attendanceService.js'
import * as leaveService from '../../api/leaveService.js'
import * as notificationService from '../../api/notificationService.js'
import * as opsService from '../../api/opsService.js'
import * as payrollService from '../../api/payrollService.js'
import './adminDashboard.css'

const NO_ISSUES_MESSAGE =
  'No issues detected today. All attendance, leave, and payroll signals are within expected parameters.'

// Smart Daily Brief is Admin's operational home. Flags, Attention Scores,
// breakdowns, rankings, and payroll statuses are service-provided values.
export default function AdminDashboardPage() {
  const { role } = useAuth()
  const { loading, data, errors, retry } = useAsyncData({
    dailyBrief: opsService.getDailyBrief,
    queue: opsService.getAttentionQueue,
    payrollRuns: payrollService.listPayrollRuns,
    notifications: () => notificationService.listNotifications({ role }),
  })
  const [busyId, setBusyId] = useState(null)
  const [actionError, setActionError] = useState(null)
  const actionLockRef = useRef(false)

  if (loading) {
    return (
      <section className="page">
        <h1>Smart Daily Brief</h1>
        <Loading label="Loading operational brief…" />
      </section>
    )
  }

  const brief = data.dailyBrief ?? {}
  const flags = Array.isArray(brief.flags) ? brief.flags : []
  const queue = Array.isArray(data.queue) ? data.queue : []
  const runs = Array.isArray(data.payrollRuns) ? data.payrollRuns : []
  const notifications = Array.isArray(data.notifications) ? data.notifications : []
  const latestRun = runs[0] ?? null
  const unreadCount = notifications.filter((notification) => !notification.isRead).length

  async function handleQueueAction(item, decision) {
    if (actionLockRef.current || busyId) return
    actionLockRef.current = true
    setBusyId(item.id)
    setActionError(null)
    try {
      if (item.source === 'LEAVE') {
        if (decision === 'approve') await leaveService.approveLeaveRequest(item.requestId)
        else await leaveService.rejectLeaveRequest(item.requestId)
      } else if (decision === 'approve') {
        await attendanceService.approveCorrectionRequest(item.requestId)
      } else {
        await attendanceService.rejectCorrectionRequest(item.requestId)
      }
      retry()
    } catch (error) {
      setActionError(error.message || 'Could not record the decision.')
    } finally {
      setBusyId(null)
      actionLockRef.current = false
    }
  }

  return (
    <section className="page admin-dash">
      <header className="page__header">
        <h1>Smart Daily Brief</h1>
        <p className="page__description">
          Today&apos;s attendance, leave, payroll, and approval signals in one operational view.
        </p>
      </header>

      <div className="admin-dash__grid">
        <DashboardCard title="Daily signals" className="admin-dash__wide">
          {errors.dailyBrief ? (
            <ErrorState title="Could not load the daily brief" onRetry={retry} />
          ) : flags.length === 0 ? (
            <EmptyState title={brief.emptyMessage ?? NO_ISSUES_MESSAGE} />
          ) : (
            <div>
              {brief.summary && <p className="admin-dash__meta">{brief.summary}</p>}
              {flags.map((flag) => (
                <article className="admin-dash__flag" key={flag.id}>
                  <p className="admin-dash__title">
                    {flag.title}
                    {flag.employeeName ? ` · ${flag.employeeName}` : ''}
                  </p>
                  <p className="admin-dash__meta">{flag.message}</p>
                  <AttentionScore score={flag.attentionScore} breakdown={flag.breakdown} />
                </article>
              ))}
            </div>
          )}
        </DashboardCard>

        <DashboardCard title="Attention-ranked approval queue">
          {errors.queue ? (
            <ErrorState title="Could not load the approval queue" onRetry={retry} />
          ) : queue.length === 0 ? (
            <EmptyState title="No pending approvals" message="The queue is clear." />
          ) : (
            <div>
              {actionError && (
                <p className="att-banner att-banner--error" role="alert">
                  {actionError}
                </p>
              )}
              {queue.slice(0, 5).map((item) => (
                <article className="admin-dash__queue-item" key={item.id}>
                  <p className="admin-dash__title">{item.label}</p>
                  <StatusBadge status="PENDING" />
                  <AttentionScore score={item.attentionScore} breakdown={item.breakdown} />
                  <div className="admin-dash__actions">
                    <button
                      type="button"
                      className="btn"
                      disabled={Boolean(busyId)}
                      onClick={() => handleQueueAction(item, 'approve')}
                    >
                      {busyId === item.id ? 'Working…' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      className="leave-cancel"
                      disabled={Boolean(busyId)}
                      onClick={() => handleQueueAction(item, 'reject')}
                    >
                      Reject
                    </button>
                    <Link
                      className="admin-dash__link"
                      to={item.source === 'LEAVE' ? '/admin/leave-approvals' : '/admin/attendance-corrections'}
                    >
                      Open queue
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </DashboardCard>

        <DashboardCard title="Payroll status" to="/admin/payroll">
          {errors.payrollRuns ? (
            <ErrorState title="Could not load payroll status" onRetry={retry} />
          ) : !latestRun ? (
            <EmptyState title="No payroll runs yet" />
          ) : (
            <div>
              <p className="admin-dash__title">{latestRun.periodLabel}</p>
              <p className="admin-dash__meta">Latest payroll run</p>
              <StatusBadge status={latestRun.status} />
            </div>
          )}
        </DashboardCard>

        <DashboardCard title="Notifications" to="/notifications">
          {errors.notifications ? (
            <ErrorState title="Could not load notifications" onRetry={retry} />
          ) : notifications.length === 0 ? (
            <EmptyState title="No notifications" />
          ) : (
            <div>
              <p className="admin-dash__title">
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
              </p>
              {notifications.slice(0, 2).map((notification) => (
                <p className="admin-dash__meta" key={notification.id}>
                  {notification.message}
                </p>
              ))}
            </div>
          )}
        </DashboardCard>
      </div>
    </section>
  )
}
