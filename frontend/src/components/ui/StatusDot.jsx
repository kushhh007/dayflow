import './ui.css'

const LABELS = {
  present: 'Present',
  absent: 'Absent',
  leave: 'On leave',
  off: 'No record',
}

/**
 * Wireframe employee status indicator.
 * status: 'present' (green dot) | 'absent' (yellow dot) | 'leave' (plane) | 'off'
 */
export default function StatusDot({ status = 'off', label }) {
  return (
    <span className={`status-dot status-dot--${status}`}>
      <span className="status-dot__marker" aria-hidden="true">
        {status === 'leave' && (
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M21.5 15.5v-2l-8.5-5V3.75a1.25 1.25 0 0 0-2.5 0V8.5l-8.5 5v2L10.5 13v5.75l-2.25 1.69V22l3.5-1.06L15.25 22v-1.56L13 18.75V13l8.5 2.5Z" />
          </svg>
        )}
      </span>
      {label ?? LABELS[status] ?? LABELS.off}
    </span>
  )
}
