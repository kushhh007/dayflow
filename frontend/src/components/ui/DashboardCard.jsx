import { Link } from 'react-router-dom'
import './dashboardCard.css'

export default function DashboardCard({ title, to, actionLabel = 'View all', className = '', children }) {
  return (
    <section className={`dash-card${className ? ` ${className}` : ''}`}>
      <header className="dash-card__header">
        <h2>{title}</h2>
        {to && (
          <Link className="dash-card__link" to={to}>
            {actionLabel}
          </Link>
        )}
      </header>
      <div className="dash-card__body">{children}</div>
    </section>
  )
}
