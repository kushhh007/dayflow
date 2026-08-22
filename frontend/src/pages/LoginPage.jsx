import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import Loading from '../components/states/Loading.jsx'
import { homePathForRole } from '../config/navigation.js'
import './loginPage.css'

// TEMPORARY MOCK SIGN-IN: authentication runs against local demo accounts in
// api/authService.js until the real auth contract is published in docs/api.md.
// The listed accounts exist only for development/testing of the auth flows.
// No backend or API details are exposed here — only mock credentials.

const DEMO_ACCOUNTS = [
  { label: 'Employee', loginId: 'demo.employee', password: 'demo1234' },
  { label: 'Admin', loginId: 'demo.admin', password: 'demo1234' },
  { label: 'First-login employee', loginId: 'demo.firstlogin', password: 'temp1234' },
]

export default function LoginPage() {
  const { login, isAuthenticated, mustChangePassword, role } = useAuth()
  const navigate = useNavigate()
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  if (isAuthenticated) {
    return <Navigate to={mustChangePassword ? '/change-password' : homePathForRole(role)} replace />
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const user = await login({ loginId: loginId.trim(), password })
      navigate(
        user.mustChangePassword ? '/change-password' : homePathForRole(user.role),
        { replace: true },
      )
    } catch (err) {
      setError(err.message || 'Unable to sign in.')
      setSubmitting(false)
    }
  }

  function fillDemoAccount(account) {
    if (submitting) return
    setError(null)
    setLoginId(account.loginId)
    setPassword(account.password)
  }

  return (
    <main className="login">
      <div className="login__card">
        <span className="login__mark" aria-hidden="true">
          D
        </span>
        <h1>Dayflow</h1>
        <p className="login__subtitle">Sign in to your HRMS workspace</p>

        <form className="login__form" onSubmit={handleSubmit} noValidate>
          <label className="login__field">
            <span>Login ID</span>
            <input
              type="text"
              name="loginId"
              autoComplete="username"
              value={loginId}
              onChange={(event) => setLoginId(event.target.value)}
              disabled={submitting}
              required
            />
          </label>

          <label className="login__field">
            <span>Password</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={submitting}
              required
            />
          </label>

          <button type="submit" className="btn" disabled={submitting}>
            Sign in
          </button>

          {error && (
            <p className="login__status login__status--error" role="alert">
              {error}
            </p>
          )}
          {submitting && <Loading inline label="Signing in…" />}
        </form>

        <div className="login__demo">
          <p className="login__note">
            Development mock accounts (removed when the real API connects):
          </p>
          <ul className="login__demo-list">
            {DEMO_ACCOUNTS.map((account) => (
              <li key={account.loginId}>
                <button
                  type="button"
                  className="login__demo-fill"
                  disabled={submitting}
                  onClick={() => fillDemoAccount(account)}
                >
                  {account.label}: {account.loginId}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  )
}
