import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'

export default function Topbar({ onMenuToggle }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="topbar">
      <button
        type="button"
        className="topbar__menu"
        aria-label="Toggle navigation"
        onClick={onMenuToggle}
      >
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>

      <div className="topbar__spacer" />

      <NavLink to="/notifications" className="topbar__notifications">
        Notifications
      </NavLink>

      <div className="topbar__user">
        <span className="topbar__user-name">{user?.name}</span>
        <button type="button" className="topbar__logout" onClick={handleLogout}>
          Log out
        </button>
      </div>
    </header>
  )
}
