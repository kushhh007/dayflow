import './statusBadge.css'

// Visual mapping for the status vocabulary defined by the Dayflow v4.5 spec.
// Unknown values render as neutral badges instead of breaking the UI.
const STATUS_TONE = {
  PRESENT: 'success',
  APPROVED: 'success',
  FINALIZED: 'success',
  HALF_DAY: 'warning',
  PENDING: 'warning',
  CALCULATED: 'warning',
  ABSENT: 'danger',
  REJECTED: 'danger',
  LEAVE: 'info',
  DRAFT: 'info',
  CANCELLED: 'muted',
}

export default function StatusBadge({ status }) {
  const tone = STATUS_TONE[status] ?? 'muted'
  const text = String(status ?? 'UNKNOWN').replaceAll('_', ' ')
  return <span className={`badge badge--${tone}`}>{text}</span>
}
