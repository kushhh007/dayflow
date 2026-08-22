import './employeeWorkStatus.css'

export default function EmployeeWorkStatus({ summary, employeeStatus }) {
  if (employeeStatus === 'INACTIVE') {
    return <span className="employee-work-status employee-work-status--unknown">Inactive</span>
  }
  const status = summary?.status
  if (status === 'LEAVE') {
    return (
      <span className="employee-work-status employee-work-status--leave" title="On leave">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m3 14 7-2 4-8 2 1-1 7 5 2-1 2-5-1-4 6-2-1 1-6-6 1Z" />
        </svg>
        On leave
      </span>
    )
  }
  if (status === 'PRESENT') {
    return (
      <span className="employee-work-status employee-work-status--present" title="Present">
        <span className="employee-work-status__dot" aria-hidden="true" />
        Present
      </span>
    )
  }
  if (status === 'ABSENT') {
    return (
      <span
        className="employee-work-status employee-work-status--absent"
        title="Absent without approved time off"
      >
        <span className="employee-work-status__dot" aria-hidden="true" />
        Absent
      </span>
    )
  }
  return <span className="employee-work-status employee-work-status--unknown">No status</span>
}
