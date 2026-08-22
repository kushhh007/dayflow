import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Card from '../../components/ui/Card.jsx'
import DataTable from '../../components/ui/DataTable.jsx'
import StatCard from '../../components/ui/StatCard.jsx'
import Badge from '../../components/ui/Badge.jsx'
import Skeleton from '../../components/ui/Skeleton.jsx'
import ErrorState from '../../components/states/ErrorState.jsx'
import { getMyAttendance } from '../../api/attendanceService.js'
import { getLeaveBalances } from '../../api/leaveService.js'
import { listPayslips } from '../../api/payrollService.js'
import { useAuth } from '../../hooks/useAuth.js'
import './dashboard.css'

const STATUS_TONE = {
  PRESENT: 'accent',
  LEAVE: 'info',
  ABSENT: 'danger',
  WEEKEND: 'neutral',
}

const TODAY = new Date().toLocaleDateString('en-IN', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export default function EmployeeDashboardPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [attendance, setAttendance] = useState([])
  const [balances, setBalances] = useState([])
  const [payslips, setPayslips] = useState([])

  useEffect(() => {
    let cancelled = false
    Promise.all([getMyAttendance(), getLeaveBalances(), listPayslips()])
      .then(([attendanceRows, leaveBalances, payslipRows]) => {
        if (cancelled) return
        setAttendance(attendanceRows)
        setBalances(leaveBalances)
        setPayslips(payslipRows)
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return <ErrorState message="Dashboard data could not be loaded." onRetry={() => window.location.reload()} />
  }

  const todayRow = attendance.find((row) => row.checkIn && !row.checkOut)
  const presentCount = attendance.filter((row) => row.status === 'PRESENT').length
  const annual = balances.find((balance) => balance.type === 'ANNUAL')
  const latestPayslip = payslips[0]

  const attendanceColumns = [
    { key: 'dayLabel', label: 'Day' },
    { key: 'checkIn', label: 'Check in' },
    { key: 'checkOut', label: 'Check out' },
    { key: 'hours', label: 'Hours', align: 'right' },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <Badge tone={STATUS_TONE[row.status] ?? 'neutral'}>{row.status}</Badge>,
    },
  ]

  return (
    <section className="page">
      <header className="dash__greeting">
        <h1>Hi {user?.name?.split(' ')[0] ?? 'there'},</h1>
        <p className="page__description">{TODAY}</p>
      </header>

      {loading ? (
        <div className="dash__stats">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="stat-card" aria-hidden="true">
              <Skeleton width="40%" height="12px" />
              <Skeleton width="60%" height="30px" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="dash__stats">
            <StatCard
              label="Today"
              value={todayRow ? `In since ${todayRow.checkIn}` : attendance.at(-1)?.status ?? '—'}
            />
            <StatCard label="Present this week" value={`${presentCount}/5 days`} />
            <StatCard
              label="Annual leave left"
              value={annual ? `${annual.allocated - annual.usedOrApproved}` : '—'}
              hint={annual ? `of ${annual.allocated} days` : undefined}
            />
            <StatCard
              label={latestPayslip ? `${latestPayslip.period} net` : 'Latest payslip'}
              value={latestPayslip?.net ?? '—'}
              hint={latestPayslip?.status}
            />
          </div>

          <div className="dash__grid">
            <Card title="This week" className="dash__span-2">
              <DataTable columns={attendanceColumns} rows={attendance} rowKey={(row) => row.id} />
            </Card>

            <Card title="Leave balances">
              <ul className="dash__balances">
                {balances.map((balance) => (
                  <li key={balance.type}>
                    <span>{balance.type}</span>
                    <strong>
                      {balance.allocated - balance.usedOrApproved}
                      <em> / {balance.allocated}</em>
                    </strong>
                  </li>
                ))}
              </ul>
              <Link to="/employee/leave" className="dash__more-link">
                Manage leave
              </Link>
            </Card>

            <Card
              title="Latest payslip"
              className="dash__span-2"
              actions={
                <Link to="/employee/payslips" className="dash__more-link">
                  All payslips
                </Link>
              }
            >
              {latestPayslip ? (
                <dl className="dash__payslip">
                  <div>
                    <dt>Payable days</dt>
                    <dd>{latestPayslip.payableDays} / {latestPayslip.workingDays}</dd>
                  </div>
                  <div>
                    <dt>Gross</dt>
                    <dd>{latestPayslip.gross}</dd>
                  </div>
                  <div>
                    <dt>Deductions</dt>
                    <dd>{latestPayslip.deductions}</dd>
                  </div>
                  <div>
                    <dt>Net paid</dt>
                    <dd>{latestPayslip.net}</dd>
                  </div>
                </dl>
              ) : null}
            </Card>
          </div>
        </>
      )}
    </section>
  )
}
