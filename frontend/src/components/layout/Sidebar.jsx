import { NavLink } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import { navItemsForRole } from '../../config/navigation.js'

export default function Sidebar({ onNavigate }) {
  const { user, role } = useAuth()
  const items = navItemsForRole(role)

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__brand-mark" aria-hidden="true">
          D
        </span>
        <span className="sidebar__brand-name">Dayflow</span>
      </div>

      <p className="sidebar__role">{role} workspace</p>

      <nav className="sidebar__nav" aria-label="Primary navigation">
        <ul>
          {items.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                end={Boolean(item.end)}
                onClick={onNavigate}
                className={({ isActive }) =>
                  isActive ? 'sidebar__link sidebar__link--active' : 'sidebar__link'
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <p className="sidebar__user" title={user?.loginId}>
        {user?.name}
      </p>
    </aside>
  )
}
