import './attentionScore.css'

// Attention scores and their point breakdown are supplied by the backend/mock
// service. This component only presents the values and never derives them.
export default function AttentionScore({ score, breakdown = [] }) {
  const items = Array.isArray(breakdown) ? breakdown : []
  if (score == null && items.length === 0) return null

  return (
    <div className="attention-score">
      {score != null && <span className="attention-score__total">Attention {score}</span>}
      {items.length > 0 && (
        <span className="attention-score__breakdown">
          {items.map((entry) => `+${entry.points} ${entry.label}`).join(' · ')}
        </span>
      )}
    </div>
  )
}
