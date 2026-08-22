import { Link, useParams } from 'react-router-dom'
import { useAsyncData } from '../../hooks/useAsyncData.js'
import DashboardCard from '../../components/ui/DashboardCard.jsx'
import ProfileAvatar from '../../components/ui/ProfileAvatar.jsx'
import EmployeeWorkStatus from '../../components/ui/EmployeeWorkStatus.jsx'
import StatusBadge from '../../components/ui/StatusBadge.jsx'
import Loading from '../../components/states/Loading.jsx'
import EmptyState from '../../components/states/EmptyState.jsx'
import ErrorState from '../../components/states/ErrorState.jsx'
import * as employeeService from '../../api/employeeService.js'
import * as attendanceService from '../../api/attendanceService.js'
import './adminEmployeeProfile.css'

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

function displayValue(value) {
  if (Array.isArray(value)) return value.join(', ')
  return value || 'Not provided'
}

function InfoGrid({ facts }) {
  return (
    <dl className="admin-profile__facts">
      {facts.map(([label, value]) => (
        <div className="admin-profile__fact" key={label}>
          <dt>{label}</dt>
          <dd>{displayValue(value)}</dd>
        </div>
      ))}
    </dl>
  )
}

function SalaryGrid({ salary }) {
  const fund = salary.providentFund ?? {}
  return (
    <>
      <InfoGrid
        facts={[
          ['Wage type', salary.wageType],
          ['Monthly wage', salary.monthlyWage == null ? null : inr.format(salary.monthlyWage)],
          ['Yearly wage', salary.yearlyWage == null ? null : inr.format(salary.yearlyWage)],
          ['Basic salary', salary.basicSalary == null ? null : inr.format(salary.basicSalary)],
          [
            'House rent allowance',
            salary.houseRentAllowance == null ? null : inr.format(salary.houseRentAllowance),
          ],
          [
            'Standard allowance',
            salary.standardAllowance == null ? null : inr.format(salary.standardAllowance),
          ],
          [
            'Performance bonus',
            salary.performanceBonus == null ? null : inr.format(salary.performanceBonus),
          ],
          [
            'Leave travel allowance',
            salary.leaveTravelAllowance == null ? null : inr.format(salary.leaveTravelAllowance),
          ],
          ['Fixed allowance', salary.fixedAllowance == null ? null : inr.format(salary.fixedAllowance)],
          [
            'Professional tax',
            salary.professionalTax == null ? null : inr.format(salary.professionalTax),
          ],
          [
            'Employee PF contribution',
            fund.employeeContribution == null ? null : inr.format(fund.employeeContribution),
          ],
          ['Employee PF rate', fund.employeeRate],
          [
            'Employer PF contribution',
            fund.employerContribution == null ? null : inr.format(fund.employerContribution),
          ],
          ['Employer PF rate', fund.employerRate],
        ]}
      />
      {salary.componentConfiguration && (
        <p className="admin-profile__note">
          Component configuration: {salary.componentConfiguration}
        </p>
      )}
    </>
  )
}

export default function AdminEmployeeProfilePage() {
  const { employeeId } = useParams()
  const { loading, data, errors, retry } = useAsyncData({
    employee: () => employeeService.getEmployee(employeeId),
    salary: () => employeeService.getEmployeeSalary(employeeId),
    attendance: () => attendanceService.getEmployeeAttendanceSummary(employeeId),
  })

  if (loading) {
    return (
      <section className="page">
        <h1>Employee Profile</h1>
        <Loading label="Loading employee profile…" />
      </section>
    )
  }

  if (errors.employee || !data.employee?.id) {
    return (
      <section className="page">
        <h1>Employee Profile</h1>
        <ErrorState title="Could not load employee profile" onRetry={retry} />
      </section>
    )
  }

  const employee = data.employee
  const bank = employee.bankDetails ?? {}

  return (
    <section className="page admin-profile">
      <Link className="admin-profile__back" to="/admin/employees">
        Back to employees
      </Link>
      <header className="admin-profile__header">
        <div className="admin-profile__identity">
          <ProfileAvatar name={employee.name} src={employee.profilePicture} size="large" />
          <div>
            <div className="admin-profile__title-row">
              <h1>{employee.name}</h1>
              <StatusBadge status={employee.status} />
            </div>
            <p className="admin-profile__subtitle">
              {employee.jobPosition || 'Position unavailable'} · {employee.department || 'Department unavailable'}
            </p>
            <p className="admin-profile__mode">View-only employee information</p>
          </div>
        </div>
        <EmployeeWorkStatus summary={data.attendance} employeeStatus={employee.status} />
      </header>

      <div className="admin-profile__grid">
        <DashboardCard title="General profile">
          <InfoGrid
            facts={[
              ['Name', employee.name],
              ['Mobile', employee.phone],
              ['Email / Personal email', employee.personalEmail],
              ['Department', employee.department],
              ['Job position', employee.jobPosition],
              ['Manager', employee.manager],
              ['Company', employee.company],
              ['Location', employee.location],
              ['Date of joining', employee.joinDate],
              ['Employee code', employee.employeeCode],
              ['Login ID', employee.loginId],
            ]}
          />
        </DashboardCard>

        <DashboardCard title="About">
          <InfoGrid
            facts={[
              ['About', employee.about],
              ['What I love about my job', employee.jobLove],
              ['My interests and hobbies', employee.interestsAndHobbies],
            ]}
          />
        </DashboardCard>

        <DashboardCard title="Private information">
          <InfoGrid
            facts={[
              ['Resume', employee.resume],
              ['Skills', employee.skills],
              ['Certifications', employee.certifications],
              ['PAN No', employee.pan],
              ['UAN No', employee.uan],
              ['Date of birth', employee.dateOfBirth],
              ['Residing address', employee.residingAddress],
              ['Personal email', employee.personalEmail],
              ['Gender', employee.gender],
              ['Nationality', employee.nationality],
              ['Marital status', employee.maritalStatus],
              ['Employment status', employee.status],
              ['Employment end date', employee.employmentEndDate],
            ]}
          />
        </DashboardCard>

        <DashboardCard title="Bank details">
          <InfoGrid
            facts={[
              ['Account number', bank.accountNumber],
              ['Bank name', bank.bankName],
              ['IFSC code', bank.ifscCode],
            ]}
          />
        </DashboardCard>

        <DashboardCard title="Salary information" className="admin-profile__salary">
          {errors.salary ? (
            <ErrorState title="Could not load salary information" onRetry={retry} />
          ) : !data.salary ? (
            <EmptyState title="Salary information unavailable" message="No salary structure was returned for this employee." />
          ) : (
            <SalaryGrid salary={data.salary} />
          )}
        </DashboardCard>

        {errors.attendance && (
          <p className="admin-profile__inline-error" role="alert">
            Current attendance status is unavailable.
          </p>
        )}
      </div>
    </section>
  )
}
