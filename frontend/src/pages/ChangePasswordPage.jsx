import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import Loading from '../components/states/Loading.jsx'
import { homePathForRole } from '../config/navigation.js'
import './loginPage.css'

// Spec §2: employees receive a temporary password from Admin and must change
// it at first login. This screen is only reachable while mustChangePassword
// is set (enforced by the RequirePasswordChange route guard). The change is
// mocked locally until the auth contract exists — no backend endpoint is
// invented here.

const MIN_PASSWORD_LENGTH = 8

export default function ChangePasswordPage() {
  const { user, completePasswordChange } = useAuth()
  const navigate = useNavigate()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  function validate() {
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`
    }
    if (newPassword !== confirmPassword) {
      return 'Passwords do not match.'
    }
    return null
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting) return
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await completePasswordChange({ newPassword })
      navigate(homePathForRole(user?.role), { replace: true })
    } catch (err) {
      setError(err.message || 'Could not update your password.')
      setSubmitting(false)
    }
  }

  return (
    <main className="login">
      <div className="login__card">
        <h1>Set your new password</h1>
        <p className="login__subtitle">
          Your account uses a temporary password. Choose a new one to continue.
        </p>

        <form className="login__form" onSubmit={handleSubmit} noValidate>
          <label className="login__field">
            <span>New password</span>
            <input
              type="password"
              name="newPassword"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              disabled={submitting}
              required
            />
          </label>

          <label className="login__field">
            <span>Confirm new password</span>
            <input
              type="password"
              name="confirmPassword"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              disabled={submitting}
              required
            />
          </label>

          <button type="submit" className="btn" disabled={submitting}>
            Save password and continue
          </button>

          {error && (
            <p className="login__status login__status--error" role="alert">
              {error}
            </p>
          )}
          {submitting && <Loading inline label="Updating password…" />}
        </form>

        <p className="login__note">
          Password updates are simulated in this development build until the API contract is agreed.
        </p>
      </div>
    </main>
  )
}
