import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
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
import './employeesPage.css'

const EMPTY_FORM = {
  name: '',
  joinDate: '',
  departmentId: '',
  jobPositionId: '',
  phone: '',
  personalEmail: '',
  residingAddress: '',
  profilePicture: '',
  location: '',
  manager: '',
}

function formFromEmployee(employee) {
  return {
    name: employee.name ?? '',
    joinDate: employee.joinDate ?? '',
    departmentId: employee.departmentId ?? '',
    jobPositionId: employee.jobPositionId ?? '',
    phone: employee.phone ?? '',
    personalEmail: employee.personalEmail ?? '',
    residingAddress: employee.residingAddress ?? '',
    profilePicture: employee.profilePicture ?? '',
    location: employee.location ?? '',
    manager: employee.manager ?? '',
  }
}

function Field({ label, name, value, onChange, required = false, type = 'text', disabled = false }) {
  return (
    <label className="employee-field">
      <span>
        {label}
        {required ? ' *' : ''}
      </span>
      <input
        name={name}
        type={type}
        value={value ?? ''}
        required={required}
        disabled={disabled}
        onChange={onChange}
      />
    </label>
  )
}

function SelectField({ label, name, value, options, onChange, required = false, disabled = false }) {
  return (
    <label className="employee-field">
      <span>
        {label}
        {required ? ' *' : ''}
      </span>
      <select
        name={name}
        value={value ?? ''}
        required={required}
        disabled={disabled}
        onChange={onChange}
      >
        <option value="">Select {label.toLowerCase()}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  )
}

export default function EmployeesPage() {
  const { loading, data, errors, retry } = useAsyncData({
    employees: employeeService.listEmployees,
    departments: employeeService.listDepartments,
    jobPositions: employeeService.listJobPositions,
    attendance: attendanceService.listEmployeeAttendanceSummary,
  })
  const [createForm, setCreateForm] = useState(EMPTY_FORM)
  const [editEmployeeId, setEditEmployeeId] = useState(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [deactivateTarget, setDeactivateTarget] = useState(null)
  const [employmentEndDate, setEmploymentEndDate] = useState('')
  const [busyKey, setBusyKey] = useState(null)
  const [formError, setFormError] = useState(null)
  const [mutationError, setMutationError] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [credentials, setCredentials] = useState(null)
  const mutationLockRef = useRef(false)

  if (loading) {
    return (
      <section className="page">
        <h1>Employees</h1>
        <Loading label="Loading employee directory…" />
      </section>
    )
  }

  const employees = Array.isArray(data.employees) ? data.employees : []
  const departments = Array.isArray(data.departments) ? data.departments : []
  const jobPositions = Array.isArray(data.jobPositions) ? data.jobPositions : []
  const attendance = Array.isArray(data.attendance) ? data.attendance : []
  const attendanceByEmployeeId = Object.fromEntries(
    attendance.map((summary) => [summary.employeeId, summary]),
  )
  const dataError = errors.employees || errors.departments || errors.jobPositions || errors.attendance
  const editingEmployee = employees.find((employee) => employee.id === editEmployeeId)

  function updateForm(setter, event) {
    const { name, value } = event.target
    setter((current) => ({ ...current, [name]: value }))
  }

  function clearMessages() {
    setFormError(null)
    setMutationError(null)
    setFeedback(null)
  }

  async function handleCreate(event) {
    event.preventDefault()
    if (mutationLockRef.current || busyKey) return
    clearMessages()
    if (!createForm.name.trim() || !createForm.joinDate || !createForm.departmentId || !createForm.jobPositionId) {
      setFormError('Name, join date, department, and job position are required.')
      return
    }

    mutationLockRef.current = true
    setBusyKey('create')
    try {
      const created = await employeeService.createEmployee(createForm)
      setCredentials({ loginId: created.loginId, temporaryPassword: created.temporaryPassword })
      setFeedback(`${created.name} was created and added to the directory.`)
      setCreateForm(EMPTY_FORM)
      retry()
    } catch (error) {
      setMutationError(error.message || 'Could not create employee.')
    } finally {
      setBusyKey(null)
      mutationLockRef.current = false
    }
  }

  function openEdit(employee) {
    clearMessages()
    setDeactivateTarget(null)
    setEditEmployeeId(employee.id)
    setEditForm(formFromEmployee(employee))
  }

  function closeEdit() {
    setEditEmployeeId(null)
    setEditForm(EMPTY_FORM)
    clearMessages()
  }

  async function handleEdit(event) {
    event.preventDefault()
    if (!editEmployeeId || mutationLockRef.current || busyKey) return
    clearMessages()
    if (!editForm.name.trim() || !editForm.joinDate || !editForm.departmentId || !editForm.jobPositionId) {
      setFormError('Name, join date, department, and job position are required.')
      return
    }

    mutationLockRef.current = true
    setBusyKey(`edit:${editEmployeeId}`)
    try {
      const updated = await employeeService.updateEmployee(editEmployeeId, editForm)
      setFeedback(`${updated.name} was updated.`)
      setEditEmployeeId(null)
      setEditForm(EMPTY_FORM)
      retry()
    } catch (error) {
      setMutationError(error.message || 'Could not update employee.')
    } finally {
      setBusyKey(null)
      mutationLockRef.current = false
    }
  }

  function openDeactivate(employee) {
    clearMessages()
    setEditEmployeeId(null)
    setDeactivateTarget(employee)
    setEmploymentEndDate('')
  }

  function closeDeactivate() {
    setDeactivateTarget(null)
    setEmploymentEndDate('')
    clearMessages()
  }

  async function handleDeactivate(event) {
    event.preventDefault()
    if (!deactivateTarget || mutationLockRef.current || busyKey) return
    clearMessages()
    if (!employmentEndDate) {
      setMutationError('Employment end date is required before deactivation.')
      return
    }

    mutationLockRef.current = true
    setBusyKey(`deactivate:${deactivateTarget.id}`)
    try {
      const updated = await employeeService.deactivateEmployee(
        deactivateTarget.id,
        employmentEndDate,
      )
      setFeedback(`${updated.name} is now INACTIVE from ${updated.employmentEndDate}.`)
      setDeactivateTarget(null)
      setEmploymentEndDate('')
      retry()
    } catch (error) {
      setMutationError(error.message || 'Could not deactivate employee.')
    } finally {
      setBusyKey(null)
      mutationLockRef.current = false
    }
  }

  async function handleReactivate(employee) {
    if (mutationLockRef.current || busyKey) return
    clearMessages()
    mutationLockRef.current = true
    setBusyKey(`reactivate:${employee.id}`)
    try {
      const updated = await employeeService.reactivateEmployee(employee.id)
      setFeedback(`${updated.name} is ACTIVE again.`)
      retry()
    } catch (error) {
      setMutationError(error.message || 'Could not reactivate employee.')
    } finally {
      setBusyKey(null)
      mutationLockRef.current = false
    }
  }

  if (dataError) {
    return (
      <section className="page">
        <h1>Employees</h1>
        <ErrorState title="Could not load employee management" onRetry={retry} />
      </section>
    )
  }

  return (
    <section className="page employees-page">
      <header className="page__header">
        <h1>Employees</h1>
        <p className="page__description">
          Manage employee profiles, onboarding credentials, and employment status.
        </p>
      </header>

      {feedback && <p className="employee-banner employee-banner--success">{feedback}</p>}
      {mutationError && (
        <p className="employee-banner employee-banner--error" role="alert">
          {mutationError}
        </p>
      )}
      {credentials && (
        <div className="employee-credentials" role="status">
          <div>
            <strong>Temporary credentials shown once</strong>
            <p>
              Login ID: <strong>{credentials.loginId}</strong> · Temporary password:{' '}
              <strong>{credentials.temporaryPassword}</strong>
            </p>
            <p className="employee-banner__note">
              Share this password now. It is not stored or available again after this notice is dismissed.
            </p>
          </div>
          <button type="button" className="employee-button employee-button--quiet" onClick={() => setCredentials(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="employees-page__grid">
        <DashboardCard title="Create employee">
          <form className="employee-form" onSubmit={handleCreate} noValidate>
            <div className="employee-form__row">
              <Field
                label="Name"
                name="name"
                value={createForm.name}
                required
                disabled={Boolean(busyKey)}
                onChange={(event) => updateForm(setCreateForm, event)}
              />
              <Field
                label="Join date"
                name="joinDate"
                type="date"
                value={createForm.joinDate}
                required
                disabled={Boolean(busyKey)}
                onChange={(event) => updateForm(setCreateForm, event)}
              />
            </div>
            <div className="employee-form__row">
              <SelectField
                label="Department"
                name="departmentId"
                value={createForm.departmentId}
                options={departments}
                required
                disabled={Boolean(busyKey)}
                onChange={(event) => updateForm(setCreateForm, event)}
              />
              <SelectField
                label="Job position"
                name="jobPositionId"
                value={createForm.jobPositionId}
                options={jobPositions}
                required
                disabled={Boolean(busyKey)}
                onChange={(event) => updateForm(setCreateForm, event)}
              />
            </div>
            <div className="employee-form__row">
              <Field
                label="Phone"
                name="phone"
                value={createForm.phone}
                disabled={Boolean(busyKey)}
                onChange={(event) => updateForm(setCreateForm, event)}
              />
              <Field
                label="Personal email"
                name="personalEmail"
                type="email"
                value={createForm.personalEmail}
                disabled={Boolean(busyKey)}
                onChange={(event) => updateForm(setCreateForm, event)}
              />
            </div>
            <Field
              label="Residing address"
              name="residingAddress"
              value={createForm.residingAddress}
              disabled={Boolean(busyKey)}
              onChange={(event) => updateForm(setCreateForm, event)}
            />
            <div className="employee-form__row">
              <Field
                label="Profile picture reference"
                name="profilePicture"
                value={createForm.profilePicture}
                disabled={Boolean(busyKey)}
                onChange={(event) => updateForm(setCreateForm, event)}
              />
              <Field
                label="Location"
                name="location"
                value={createForm.location}
                disabled={Boolean(busyKey)}
                onChange={(event) => updateForm(setCreateForm, event)}
              />
            </div>
            <Field
              label="Manager"
              name="manager"
              value={createForm.manager}
              disabled={Boolean(busyKey)}
              onChange={(event) => updateForm(setCreateForm, event)}
            />
            {formError && <p className="employee-banner employee-banner--error" role="alert">{formError}</p>}
            <button type="submit" className="employee-button" disabled={Boolean(busyKey)}>
              {busyKey === 'create' ? 'Creating…' : 'Create employee'}
            </button>
          </form>
        </DashboardCard>

        {editingEmployee && (
          <DashboardCard title={`Edit ${editingEmployee.name}`}>
            <form className="employee-form" onSubmit={handleEdit} noValidate>
              <div className="employee-form__row">
                <Field
                  label="Name"
                  name="name"
                  value={editForm.name}
                  required
                  disabled={Boolean(busyKey)}
                  onChange={(event) => updateForm(setEditForm, event)}
                />
                <Field
                  label="Join date"
                  name="joinDate"
                  type="date"
                  value={editForm.joinDate}
                  required
                  disabled={Boolean(busyKey)}
                  onChange={(event) => updateForm(setEditForm, event)}
                />
              </div>
              <div className="employee-form__row">
                <SelectField
                  label="Department"
                  name="departmentId"
                  value={editForm.departmentId}
                  options={departments}
                  required
                  disabled={Boolean(busyKey)}
                  onChange={(event) => updateForm(setEditForm, event)}
                />
                <SelectField
                  label="Job position"
                  name="jobPositionId"
                  value={editForm.jobPositionId}
                  options={jobPositions}
                  required
                  disabled={Boolean(busyKey)}
                  onChange={(event) => updateForm(setEditForm, event)}
                />
              </div>
              <div className="employee-form__row">
                <Field
                  label="Phone"
                  name="phone"
                  value={editForm.phone}
                  disabled={Boolean(busyKey)}
                  onChange={(event) => updateForm(setEditForm, event)}
                />
                <Field
                  label="Personal email"
                  name="personalEmail"
                  type="email"
                  value={editForm.personalEmail}
                  disabled={Boolean(busyKey)}
                  onChange={(event) => updateForm(setEditForm, event)}
                />
              </div>
              <Field
                label="Residing address"
                name="residingAddress"
                value={editForm.residingAddress}
                disabled={Boolean(busyKey)}
                onChange={(event) => updateForm(setEditForm, event)}
              />
              <div className="employee-form__row">
                <Field
                  label="Profile picture reference"
                  name="profilePicture"
                  value={editForm.profilePicture}
                  disabled={Boolean(busyKey)}
                  onChange={(event) => updateForm(setEditForm, event)}
                />
                <Field
                  label="Location"
                  name="location"
                  value={editForm.location}
                  disabled={Boolean(busyKey)}
                  onChange={(event) => updateForm(setEditForm, event)}
                />
              </div>
              <Field
                  label="Manager"
                  name="manager"
                  value={editForm.manager}
                  disabled={Boolean(busyKey)}
                  onChange={(event) => updateForm(setEditForm, event)}
              />
              {formError && <p className="employee-banner employee-banner--error" role="alert">{formError}</p>}
              <div className="employee-form__actions">
                <button type="submit" className="employee-button" disabled={Boolean(busyKey)}>
                  {busyKey === `edit:${editingEmployee.id}` ? 'Saving…' : 'Save changes'}
                </button>
                <button type="button" className="employee-button employee-button--quiet" disabled={Boolean(busyKey)} onClick={closeEdit}>
                  Cancel
                </button>
              </div>
            </form>
          </DashboardCard>
        )}
      </div>

      <DashboardCard title={`Employee directory (${employees.length})`}>
        {employees.length === 0 ? (
          <EmptyState title="No employees yet" message="Create an employee to populate the directory." />
        ) : (
          <ul className="employee-list">
            {employees.map((employee) => {
              const attendanceSummary = attendanceByEmployeeId[employee.id]
              return (
                <li className="employee-row" key={employee.id}>
                  <Link className="employee-row__link" to={`/admin/employees/${employee.id}`}>
                    <div className="employee-row__avatar">
                      <ProfileAvatar name={employee.name} src={employee.profilePicture} />
                    </div>
                    <div className="employee-row__main">
                      <div className="employee-row__heading">
                        <p className="employee-row__name">{employee.name}</p>
                        <StatusBadge status={employee.status} />
                      </div>
                      <p className="employee-row__meta">Login ID: {employee.loginId || '—'}</p>
                      <div className="employee-row__details">
                        <span>{employee.department || 'Department unavailable'}</span>
                        <span>{employee.jobPosition || 'Position unavailable'}</span>
                        <span>Joined {employee.joinDate || '—'}</span>
                        {employee.status === 'INACTIVE' && (
                          <span>Ended {employee.employmentEndDate || '—'}</span>
                        )}
                      </div>
                    </div>
                    <EmployeeWorkStatus summary={attendanceSummary} employeeStatus={employee.status} />
                  </Link>
                  <div className="employee-row__actions">
                  <button
                    type="button"
                    className="employee-button employee-button--quiet"
                    disabled={Boolean(busyKey)}
                    onClick={() => openEdit(employee)}
                  >
                    Edit
                  </button>
                  {employee.status === 'ACTIVE' ? (
                    <button
                      type="button"
                      className="employee-button employee-button--danger"
                      disabled={Boolean(busyKey)}
                      onClick={() => openDeactivate(employee)}
                    >
                      Deactivate
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="employee-button"
                      disabled={Boolean(busyKey)}
                      onClick={() => handleReactivate(employee)}
                    >
                      {busyKey === `reactivate:${employee.id}` ? 'Reactivating…' : 'Reactivate'}
                    </button>
                  )}
                  </div>
                  {deactivateTarget?.id === employee.id && (
                    <form className="employee-deactivate" onSubmit={handleDeactivate} noValidate>
                      <label className="employee-field">
                        <span>Employment end date *</span>
                        <input
                          type="date"
                          value={employmentEndDate}
                          min={employee.joinDate}
                          required
                          disabled={Boolean(busyKey)}
                          onChange={(event) => setEmploymentEndDate(event.target.value)}
                        />
                      </label>
                      <p className="employee-banner__note">
                        This explicit date is required; deactivation will not happen immediately without confirmation.
                      </p>
                      <div className="employee-form__actions">
                        <button
                          type="submit"
                          className="employee-button employee-button--danger"
                          disabled={Boolean(busyKey) || !employmentEndDate}
                        >
                          {busyKey === `deactivate:${employee.id}` ? 'Deactivating…' : 'Confirm deactivation'}
                        </button>
                        <button type="button" className="employee-button employee-button--quiet" disabled={Boolean(busyKey)} onClick={closeDeactivate}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </DashboardCard>
    </section>
  )
}
