import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import { useAsyncData } from '../../hooks/useAsyncData.js'
import DashboardCard from '../../components/ui/DashboardCard.jsx'
import StatusBadge from '../../components/ui/StatusBadge.jsx'
import Loading from '../../components/states/Loading.jsx'
import EmptyState from '../../components/states/EmptyState.jsx'
import ErrorState from '../../components/states/ErrorState.jsx'
import * as attendanceService from '../../api/attendanceService.js'
import * as leaveService from '../../api/leaveService.js'
import * as payrollService from '../../api/payrollService.js'
import * as notificationService from '../../api/notificationService.js'
import './employeeDashboard.css'

// Employee home (spec §3/§5/§6/§9 scope): today's attendance, own leave
// balances and requests, latest payslip, notifications. Every value shown
// here is returned by a service — the frontend computes no attendance,
// leave, or payroll figures itself.

const inrFormat = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const dayFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' })

function greetingForHour(hour) {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function localIsoDate(date = new Date()) {
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60 * 1000).toISOString().slice(0, 10)
}

function formatDay(dateString) {
  if (!dateString) return '—'
  return dayFormat.format(new Date(`${dateString}T00:00:00`))
}

function CardError({ onRetry }) {
  return <ErrorState title="Could not load" message="Please try again." onRetry={onRetry} />
}

function LeaveBalanceRow({ balance }) {
  return (
    <li className="dash-balance">
      <span className="dash-balance__type">{balance.type}</span>
      {balance.allocated == null ? (
        <span className="dash-balance__value">No allocation</span>
      ) : (
        <span className="dash-balance__value">
          <strong>{balance.available}</strong> of {balance.allocated} available
          <span className="dash-balance__meta">
            {balance.approvedOrUsed} used
          </span>
        </span>
      )}
    </li>
  )
}

function LeaveRequestRow({ request }) {
  return (
    <li className="dash-row">
      <div>
        <p className="dash-row__title">{request.type} leave</p>
        <p className="dash-row__meta">
          {formatDay(request.startDate)} – {formatDay(request.endDate)} · {request.days}{' '}
          {request.days === 1 ? 'day' : 'days'}
        </p>
      </div>
      <StatusBadge status={request.status} />
    </li>
  )
}

export default function EmployeeDashboardPage() {
  const { user } = useAuth()
  const now = new Date()
  const { loading, data, errors, retry } = useAsyncData({
    attendance: attendanceService.getMyAttendance,
    leaveRequests: leaveService.listLeaveRequests,
    leaveBalances: leaveService.getLeaveBalances,
    payslips: payrollService.listPayslips,
    notifications: notificationService.listNotifications,
  })

  if (loading) {
    return (
      <section className="page">
        <h1>Dashboard</h1>
        <Loading label="Loading your dashboard…" />
      </section>
    )
  }

  const records = Array.isArray(data.attendance) ? data.attendance : []
  const todayRecord =
    records.find((record) => record.date === localIsoDate(now)) ?? null

  const balances = Array.isArray(data.leaveBalances) ? data.leaveBalances : []
  const leaveRequests = Array.isArray(data.leaveRequests) ? data.leaveRequests : []
  const pendingLeaveCount = leaveRequests.filter((r) => r.status === 'PENDING').length
  const recentLeave = leaveRequests.slice(0, 3)

  const payslips = Array.isArray(data.payslips) ? data.payslips : []
  const latestPayslip = payslips[0] ?? null

  const notifications = Array.isArray(data.notifications) ? data.notifications : []
  const unreadCount = notifications.filter((n) => !n.isRead).length
  const recentNotifications = notifications.slice(0, 2)

  return (
    <section className="page dash">
      <header className="dash__header">
        <h1>
          {greetingForHour(now.getHours())}, {user?.name}
        </h1>
        <p className="dash__date">
          {now.toLocaleDateString('en-IN', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </header>

      <div className="dash__grid">
        <DashboardCard title="Today's attendance" to="/employee/attendance">
          {errors.attendance ? (
            <CardError onRetry={retry} />
          ) : !todayRecord ? (
            <EmptyState
              title="No attendance recorded today"
              message="Nothing marked for today yet."
            />
          ) : (
            <div className="dash-attendance">
              <StatusBadge status={todayRecord.status} />
              <dl className="dash-attendance__times">
                <div>
                  <dt>Check-in</dt>
                  <dd>{todayRecord.checkIn ?? '—'}</dd>
                </div>
                <div>
                  <dt>Check-out</dt>
                  <dd>{todayRecord.checkOut ?? '—'}</dd>
                </div>
              </dl>
            </div>
          )}
        </DashboardCard>

        <DashboardCard title="Leave balances" to="/employee/leave">
          {errors.leaveBalances ? (
            <CardError onRetry={retry} />
          ) : balances.length === 0 ? (
            <EmptyState title="No leave allocations found" />
          ) : (
            <ul className="dash-list">
              {balances.map((balance) => (
                <LeaveBalanceRow key={balance.type} balance={balance} />
              ))}
            </ul>
          )}
        </DashboardCard>

        <DashboardCard title="My leave requests" to="/employee/leave">
          {errors.leaveRequests ? (
            <CardError onRetry={retry} />
          ) : recentLeave.length === 0 ? (
            <EmptyState title="You have not applied for leave yet" />
          ) : (
            <>
              {pendingLeaveCount > 0 && (
                <p className="dash-note">
                  {pendingLeaveCount} pending approval
                </p>
              )}
              <ul className="dash-list">
                {recentLeave.map((request) => (
                  <LeaveRequestRow key={request.id} request={request} />
                ))}
              </ul>
            </>
          )}
        </DashboardCard>

        <DashboardCard title="Latest payslip" to="/employee/payslips">
          {errors.payslips ? (
            <CardError onRetry={retry} />
          ) : !latestPayslip ? (
            <EmptyState title="No payslip available yet" />
          ) : (
            <div className="dash-payslip">
              <div className="dash-payslip__head">
                <p className="dash-row__title">{latestPayslip.periodLabel}</p>
                <StatusBadge status={latestPayslip.status} />
              </div>
              <p className="dash-payslip__net">{inrFormat.format(latestPayslip.net)}</p>
              <p className="dash-row__meta">Gross {inrFormat.format(latestPayslip.gross)}</p>
            </div>
          )}
        </DashboardCard>

        <DashboardCard title="Notifications" to="/notifications">
          {errors.notifications ? (
            <CardError onRetry={retry} />
          ) : notifications.length === 0 ? (
            <EmptyState title="No notifications" />
          ) : (
            <>
              <p className="dash-note">
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
              </p>
              <ul className="dash-list">
                {recentNotifications.map((notification) => (
                  <li key={notification.id} className="dash-row">
                    <p className={notification.isRead ? 'dash-row__meta' : 'dash-row__title'}>
                      {notification.message}
                    </p>
                    {!notification.isRead && <span className="dash-dot" aria-label="Unread" />}
                  </li>
                ))}
              </ul>
            </>
          )}
        </DashboardCard>

        <DashboardCard title="Quick links">
          <nav className="dash-links" aria-label="Quick links">
            <Link to="/employee/profile">My profile</Link>
            <Link to="/employee/attendance">Attendance</Link>
            <Link to="/employee/leave">Apply for leave</Link>
            <Link to="/employee/payslips">Payslips</Link>
          </nav>
        </DashboardCard>
      </div>
    </section>
  )
}

