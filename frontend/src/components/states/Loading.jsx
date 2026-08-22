import './states.css'

export default function Loading({ label = 'Loading…', inline = false }) {
  return (
    <div className={inline ? 'state state--inline' : 'state'} role="status">
      <span className="state__spinner" aria-hidden="true" />
      <p className="state__label">{label}</p>
    </div>
  )
}
