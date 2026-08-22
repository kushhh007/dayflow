import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import Topbar from './Topbar.jsx'
import './layout.css'

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className={sidebarOpen ? 'app-shell app-shell--sidebar-open' : 'app-shell'}>
      <Sidebar onNavigate={() => setSidebarOpen(false)} />
      {sidebarOpen && (
        <button
          type="button"
          className="app-shell__backdrop"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div className="app-shell__main">
        <Topbar onMenuToggle={() => setSidebarOpen((open) => !open)} />
        <main className="app-shell__content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
