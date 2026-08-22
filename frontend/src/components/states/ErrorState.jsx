import Button from '../ui/Button.jsx'
import './states.css'

export default function ErrorState({ title = 'Something went wrong', message, onRetry }) {
  return (
    <div className="state state--card state--error" role="alert">
      <p className="state__title">{title}</p>
      {message && <p className="state__message">{message}</p>}
      {onRetry && (
        <Button onClick={onRetry}>Try again</Button>
      )}
    </div>
  )
}
