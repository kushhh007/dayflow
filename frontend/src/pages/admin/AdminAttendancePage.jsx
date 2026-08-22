import { useAsyncData } from '../../hooks/useAsyncData.js'
import DashboardCard from '../../components/ui/DashboardCard.jsx'
import ProfileAvatar from '../../components/ui/ProfileAvatar.jsx'
import EmployeeWorkStatus from '../../components/ui/EmployeeWorkStatus.jsx'
import StatusBadge from '../../components/ui/StatusBadge.jsx'
import Loading from '../../components/states/Loading.jsx'
import EmptyState from '../../components/states/EmptyState.jsx'
import ErrorState from '../../components/states/ErrorState.jsx'
import * as attendanceService from '../../api/attendanceService.js'
import * as employeeService from '../../api/employeeService.js'
import './adminAttendance.css'

const dayFormat = new Intl.DateTimeFormat('en-IN', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

function formatDay(value) {
  if (!value) return 'Current day'
  return dayFormat.format(new Date(`${value}T00:00:00`))
}

export default function AdminAttendancePage() {
  const { loading, data, errors, retry } = useAsyncData({
    summaries: attendanceService.listEmployeeAttendanceSummary,
    employees: employeeService.listEmployees,
  })

  if (loading) {
    return (
      <section className="page">
        <h1>Employee Attendance</h1>
        <Loading label="Loading employee attendance…" />
      </section>
    )
  }

  if (errors.summaries || errors.employees) {
    return (
      <section className="page">
        <h1>Employee Attendance</h1>
        <ErrorState title="Could not load employee attendance" onRetry={retry} />
      </section>
    )
  }

  const summaries = Array.isArray(data.summaries) ? data.summaries : []
  const employees = Array.isArray(data.employees) ? data.employees : []
  const employeeById = Object.fromEntries(employees.map((employee) => [employee.id, employee]))
  const date = summaries[0]?.date

  return (
    <section className="page admin-attendance">
      <header className="page__header">
        <h1>Employee Attendance</h1>
        <p className="page__description">Current-day attendance for {formatDay(date)}.</p>
      </header>

      <DashboardCard title={`Today${date ? ` · ${date}` : ''}`}>
        {summaries.length === 0 ? (
          <EmptyState title="No employee attendance yet" message="No current-day attendance data was returned." />
        ) : (
          <div className="admin-attendance__table" role="table" aria-label="Employee attendance">
            <div className="admin-attendance__head" role="row">
              <span role="columnheader">Employee</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">Check-in / Check-out</span>
              <span role="columnheader">Work hours</span>
              <span role="columnheader">Extra hours</span>
            </div>
            {summaries.map((summary) => {
              const employee = employeeById[summary.employeeId]
              return (
                <div className="admin-attendance__row" role="row" key={summary.employeeId}>
                  <div className="admin-attendance__employee" role="cell">
                    <ProfileAvatar name={employee?.name ?? summary.employeeName} src={employee?.profilePicture} size="small" />
                    <div>
                      <strong>{employee?.name ?? summary.employeeName}</strong>
                      <span>{employee?.department ?? 'Department unavailable'}</span>
                    </div>
                  </div>
                  <div className="admin-attendance__status" role="cell">
                    <EmployeeWorkStatus summary={summary} employeeStatus={employee?.status} />
                    <StatusBadge status={summary.status} />
                  </div>
                  <span role="cell">{summary.checkIn ?? '—'} – {summary.checkOut ?? '—'}</span>
                  <span role="cell">{summary.workHours ?? '—'}</span>
                  <span role="cell">{summary.extraHours ?? '—'}</span>
                </div>
              )
            })}
          </div>
        )}
      </DashboardCard>
    </section>
  )
}
