import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ROLES } from '../constants/roles.js'
import { useAuth } from '../hooks/useAuth.js'
import './loginPage.css'

// TEMPORARY: authentication is mocked locally until the auth API contract is
// published in docs/api.md. The two demo buttons exist so the shell and
// role-guarded routes are navigable during development. Replace this form's
// submit with the real login service call once available.

export default function LoginPage() {
  const { login, isAuthenticated, role } = useAuth()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  if (isAuthenticated) {
    return <Navigate to={role === ROLES.ADMIN ? '/admin' : '/employee'} replace />
  }

  async function handleDemoLogin(demoRole) {
    setSubmitting(true)
    setError(null)
    try {
      const user = await login({
        loginId: demoRole === ROLES.ADMIN ? 'demo.admin' : 'demo.employee',
        password: 'demo1234',
      })
      navigate(user.role === ROLES.ADMIN ? '/admin' : '/employee', { replace: true })
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <main className="login">
      <div className="login__card">
        <span className="login__mark" aria-hidden="true">
          D
        </span>
        <h1>Dayflow</h1>
        <p className="login__subtitle">HRMS workspace</p>

        <p className="login__note">
          Sign-in is mocked for shell development. Real authentication (system-generated Login IDs,
          temporary passwords, first-login change) connects here once the API contract is agreed.
        </p>

        <div className="login__options">
          <button
            type="button"
            className="btn"
            disabled={submitting}
            onClick={() => handleDemoLogin(ROLES.EMPLOYEE)}
          >
            Enter as Employee
          </button>
          <button
            type="button"
            className="btn btn--secondary"
            disabled={submitting}
            onClick={() => handleDemoLogin(ROLES.ADMIN)}
          >
            Enter as Admin
          </button>
        </div>

        {submitting && <p className="login__status">Signing in…</p>}
        {error && (
          <p className="login__status login__status--error" role="alert">
            {error}
          </p>
        )}
      </div>
    </main>
  )
}
