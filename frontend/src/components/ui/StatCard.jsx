import './ui.css'

/**
 * Dashboard metric tile.
 * tone (applied to hint): undefined | 'success' | 'warning' | 'danger'
 */
export default function StatCard({ label, value, hint, tone, ...rest }) {
  const hintClass = tone ? `stat-card__hint stat-card__hint--${tone}` : 'stat-card__hint'
  return (
    <div className="stat-card" {...rest}>
      <p className="stat-card__label">{label}</p>
      <p className="stat-card__value">{value}</p>
      {hint && <p className={hintClass}>{hint}</p>}
    </div>
  )
}
