import './states.css'

export default function ErrorState({ title = 'Something went wrong', message, onRetry }) {
  return (
    <div className="state state--card state--error" role="alert">
      <p className="state__title">{title}</p>
      {message && <p className="state__message">{message}</p>}
      {onRetry && (
        <button type="button" className="btn" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}
