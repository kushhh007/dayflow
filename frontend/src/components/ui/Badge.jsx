import './ui.css'

const TONES = ['success', 'warning', 'danger', 'info', 'neutral', 'accent']

/**
 * Pill label. tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral'
 */
export default function Badge({ tone = 'neutral', children, ...rest }) {
  const safeTone = TONES.includes(tone) ? tone : 'neutral'
  return (
    <span className={`badge badge--${safeTone}`} {...rest}>
      {children}
    </span>
  )
}
