import EmptyState from '../states/EmptyState.jsx'
import './pagePlaceholder.css'

/**
 * Standard shell for placeholder pages: title, description, and a consistent
 * "not implemented yet" body. Feature work will replace the body content
 * page by page.
 */
export default function PagePlaceholder({ title, description, specArea }) {
  return (
    <section className="page">
      <header className="page__header">
        <h1>{title}</h1>
        {description && <p className="page__description">{description}</p>}
      </header>
      <EmptyState
        title="Not implemented yet"
        message={
          specArea
            ? `This screen arrives with the ${specArea} feature. The Dayflow API contract (docs/api.md) must be agreed before implementation.`
            : 'This screen is part of a later task. The Dayflow API contract (docs/api.md) must be agreed before implementation.'
        }
      />
    </section>
  )
}
