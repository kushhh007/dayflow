import { useRef, useState } from 'react'
import { useAuth } from '../../hooks/useAuth.js'
import { useAsyncData } from '../../hooks/useAsyncData.js'
import DashboardCard from '../../components/ui/DashboardCard.jsx'
import ProfileAvatar from '../../components/ui/ProfileAvatar.jsx'
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
      <header className="profile-page__header">
        <div className="profile-page__identity">
          <ProfileAvatar name={employee.name} src={employee.profilePicture} size="large" />
          <div>
            <h1>My Profile</h1>
            <p>{employee.name} · {employee.jobPosition || 'Employee'}</p>
          </div>
        </div>
        <StatusBadge status={employee.status} />
      </header>
      <p className="page__description profile-page__description">
        View your employee information. Only contact details and profile picture can be edited here.
      </p>

      {feedback && <p className="profile-banner profile-banner--success">{feedback}</p>}
      {saveError && (
        <p className="profile-banner profile-banner--error" role="alert">
          {saveError}
        </p>
      )}

      <div className="profile-page__grid">
        <DashboardCard title="General profile">
          <div className="profile-page__picture-row">
            <ProfileAvatar name={employee.name} src={employee.profilePicture} size="medium" />
            <p>Profile picture is employee-managed through the contact editor.</p>
          </div>
          <dl className="profile-facts">
            <ReadOnlyFact label="Name" value={employee.name} />
            <ReadOnlyFact label="Mobile" value={employee.phone} />
            <ReadOnlyFact label="Email / Personal email" value={employee.personalEmail} />
            <ReadOnlyFact label="Department" value={employee.department} />
            <ReadOnlyFact label="Job position" value={employee.jobPosition} />
            <ReadOnlyFact label="Manager" value={employee.manager} />
            <ReadOnlyFact label="Company" value={employee.company} />
            <ReadOnlyFact label="Location" value={employee.location} />
            <ReadOnlyFact label="Date of joining" value={employee.joinDate} />
            <ReadOnlyFact label="Employee code" value={employee.employeeCode} />
            <ReadOnlyFact label="Login ID" value={employee.loginId} />
          </dl>
        </DashboardCard>

        <DashboardCard title="About">
          <dl className="profile-facts">
            <ReadOnlyFact label="About" value={employee.about} />
            <ReadOnlyFact label="What I love about my job" value={employee.jobLove} />
            <ReadOnlyFact label="My interests and hobbies" value={employee.interestsAndHobbies} />
          </dl>
        </DashboardCard>

        <DashboardCard title="Private information">
          <dl className="profile-facts">
            <ReadOnlyFact label="Resume" value={employee.resume} />
            <ReadOnlyFact label="Skills" value={employee.skills} />
            <ReadOnlyFact label="Certifications" value={employee.certifications} />
            <ReadOnlyFact label="PAN No" value={employee.pan} />
            <ReadOnlyFact label="UAN No" value={employee.uan} />
            <ReadOnlyFact label="Date of birth" value={employee.dateOfBirth} />
            <ReadOnlyFact label="Residing address" value={employee.residingAddress} />
            <ReadOnlyFact label="Personal email" value={employee.personalEmail} />
            <ReadOnlyFact label="Gender" value={employee.gender} />
            <ReadOnlyFact label="Nationality" value={employee.nationality} />
            <ReadOnlyFact label="Marital status" value={employee.maritalStatus} />
          </dl>
        </DashboardCard>

        <DashboardCard title="Bank details">
          <dl className="profile-facts">
            <ReadOnlyFact label="Account number" value={employee.bankDetails?.accountNumber} />
            <ReadOnlyFact label="Bank name" value={employee.bankDetails?.bankName} />
            <ReadOnlyFact label="IFSC code" value={employee.bankDetails?.ifscCode} />
          </dl>
        </DashboardCard>

        <DashboardCard title="Contact details" className="profile-page__contact">
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
