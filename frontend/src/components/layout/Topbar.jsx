import { NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth.js'
import ProfileAvatar from '../ui/ProfileAvatar.jsx'

export default function Topbar({ onMenuToggle }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)

  const profilePath = user?.role === 'ADMIN' ? `/admin/employees/${user.id}` : '/employee/profile'

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

      <div className="topbar__profile">
        <button
          type="button"
          className="topbar__profile-trigger"
          aria-expanded={profileMenuOpen}
          aria-haspopup="menu"
          onClick={() => setProfileMenuOpen((open) => !open)}
        >
          <ProfileAvatar name={user?.name} src={user?.profilePicture} size="small" />
          <span className="topbar__user-name">{user?.name}</span>
          <span className="topbar__profile-chevron" aria-hidden="true">⌄</span>
        </button>
        {profileMenuOpen && (
          <div className="topbar__profile-menu" role="menu">
            <NavLink to={profilePath} role="menuitem" onClick={() => setProfileMenuOpen(false)}>
              My Profile
            </NavLink>
            <button type="button" role="menuitem" onClick={handleLogout}>
              Log out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
