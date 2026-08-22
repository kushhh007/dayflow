import './ui.css'

/**
 * Bordered surface panel with optional header row.
 */
export default function Card({ title, actions, children, className = '', ...rest }) {
  return (
    <section className={`card ${className}`.trim()} {...rest}>
      {(title || actions) && (
        <header className="card__header">
          {title && <h2 className="card__title">{title}</h2>}
          {actions && <div>{actions}</div>}
        </header>
      )}
      <div className="card__body">{children}</div>
    </section>
  )
}
