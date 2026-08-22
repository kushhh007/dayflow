import { useRef, useState } from 'react'
import { useAuth } from '../../hooks/useAuth.js'
import { useAsyncData } from '../../hooks/useAsyncData.js'
import DashboardCard from '../../components/ui/DashboardCard.jsx'
import StatusBadge from '../../components/ui/StatusBadge.jsx'
import Loading from '../../components/states/Loading.jsx'
import EmptyState from '../../components/states/EmptyState.jsx'
import ErrorState from '../../components/states/ErrorState.jsx'
import * as employeeService from '../../api/employeeService.js'
import './profilePage.css'

const EMPTY_DRAFT = {
  phone: '',
  personalEmail: '',
  residingAddress: '',
  profilePicture: '',
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_PATTERN = /^[+\d][\d\s().-]{6,19}$/

function draftFromEmployee(employee) {
  return {
    phone: employee.phone ?? '',
    personalEmail: employee.personalEmail ?? '',
    residingAddress: employee.residingAddress ?? '',
    profilePicture: employee.profilePicture ?? '',
  }
}

function ReadOnlyFact({ label, value }) {
  return (
    <div className="profile-fact">
      <dt>{label}</dt>
      <dd>{value || 'Not provided'}</dd>
    </div>
  )
}

export default function ProfilePage() {
  const { user } = useAuth()
  const { loading, data, errors, retry } = useAsyncData({
    profile: () =>
      user?.id
        ? employeeService.getEmployee(user.id)
        : Promise.reject(new Error('Your employee profile is unavailable.')),
  })
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const saveLockRef = useRef(false)

  if (loading) {
    return (
      <section className="page">
        <h1>My Profile</h1>
        <Loading label="Loading your profile…" />
      </section>
    )
  }

  if (errors.profile) {
    return (
      <section className="page">
        <h1>My Profile</h1>
        <ErrorState title="Could not load your profile" onRetry={retry} />
      </section>
    )
  }

  const employee = data.profile
  if (!employee?.id) {
    return (
      <section className="page">
        <h1>My Profile</h1>
        <EmptyState title="Profile unavailable" message="No employee profile is linked to this account." />
      </section>
    )
  }

  function beginEdit() {
    setDraft(draftFromEmployee(employee))
    setSaveError(null)
    setFeedback(null)
    setEditing(true)
  }

  function cancelEdit() {
    setDraft(EMPTY_DRAFT)
    setSaveError(null)
    setEditing(false)
  }

  function updateDraft(event) {
    const { name, value } = event.target
    setDraft((current) => ({ ...current, [name]: value }))
  }

  async function handleSave(event) {
    event.preventDefault()
    if (saveLockRef.current || saving) return
    setSaveError(null)
    setFeedback(null)
    if (draft.phone && !PHONE_PATTERN.test(draft.phone.trim())) {
      setSaveError('Enter a valid phone number.')
      return
    }
    if (draft.personalEmail && !EMAIL_PATTERN.test(draft.personalEmail.trim())) {
      setSaveError('Enter a valid personal email address.')
      return
    }

    saveLockRef.current = true
    setSaving(true)
    try {
      const updated = await employeeService.updateOwnProfile(employee.id, draft)
      setFeedback(`${updated.name}'s contact profile was saved.`)
      setEditing(false)
      setDraft(EMPTY_DRAFT)
      retry()
    } catch (error) {
      setSaveError(error.message || 'Could not save your profile.')
    } finally {
      setSaving(false)
      saveLockRef.current = false
    }
  }

  return (
    <section className="page profile-page">
      <header className="page__header">
        <h1>My Profile</h1>
        <p className="page__description">
          View your employee information. Only contact details and profile picture can be edited here.
        </p>
      </header>

      {feedback && <p className="profile-banner profile-banner--success">{feedback}</p>}
      {saveError && (
        <p className="profile-banner profile-banner--error" role="alert">
          {saveError}
        </p>
      )}

      <div className="profile-page__grid">
        <DashboardCard title="Employee information">
          <dl className="profile-facts">
            <ReadOnlyFact label="Name" value={employee.name} />
            <ReadOnlyFact label="Login ID" value={employee.loginId} />
            <ReadOnlyFact label="Department" value={employee.department} />
            <ReadOnlyFact label="Job position" value={employee.jobPosition} />
            <ReadOnlyFact label="Manager" value={employee.manager} />
            <ReadOnlyFact label="Join date" value={employee.joinDate} />
            <ReadOnlyFact label="Date of birth" value={employee.dateOfBirth} />
            <ReadOnlyFact label="Gender" value={employee.gender} />
            <ReadOnlyFact label="Marital status" value={employee.maritalStatus} />
            <ReadOnlyFact label="Nationality" value={employee.nationality} />
            <ReadOnlyFact label="Bank details" value={employee.bankDetails} />
            <ReadOnlyFact label="PAN" value={employee.pan} />
            <ReadOnlyFact label="UAN" value={employee.uan} />
            {employee.status === 'INACTIVE' && (
              <ReadOnlyFact label="Employment end date" value={employee.employmentEndDate} />
            )}
            <div className="profile-fact">
              <dt>Employment status</dt>
              <dd><StatusBadge status={employee.status} /></dd>
            </div>
          </dl>
        </DashboardCard>

        <DashboardCard title="Contact details">
          {editing ? (
            <form className="profile-form" onSubmit={handleSave} noValidate>
              <label className="profile-field">
                <span>Phone</span>
                <input name="phone" value={draft.phone} disabled={saving} onChange={updateDraft} />
              </label>
              <label className="profile-field">
                <span>Personal email</span>
                <input
                  name="personalEmail"
                  type="email"
                  value={draft.personalEmail}
                  disabled={saving}
                  onChange={updateDraft}
                />
              </label>
              <label className="profile-field">
                <span>Residing address</span>
                <textarea
                  name="residingAddress"
                  rows="3"
                  value={draft.residingAddress}
                  disabled={saving}
                  onChange={updateDraft}
                />
              </label>
              <label className="profile-field">
                <span>Profile picture reference</span>
                <input
                  name="profilePicture"
                  value={draft.profilePicture}
                  disabled={saving}
                  onChange={updateDraft}
                />
              </label>
              <div className="profile-form__actions">
                <button type="submit" className="profile-button" disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
                <button type="button" className="profile-button profile-button--quiet" disabled={saving} onClick={cancelEdit}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              <dl className="profile-facts profile-facts--contact">
                <ReadOnlyFact label="Phone" value={employee.phone} />
                <ReadOnlyFact label="Personal email" value={employee.personalEmail} />
                <ReadOnlyFact label="Residing address" value={employee.residingAddress} />
                <ReadOnlyFact label="Profile picture reference" value={employee.profilePicture} />
              </dl>
              <button type="button" className="profile-button" onClick={beginEdit}>
                Edit contact details
              </button>
            </>
          )}
        </DashboardCard>
      </div>
    </section>
  )
}
