import './ui.css'

/**
 * Tab strip (underline style) for multi-tab pages like the employee profile.
 * items: [{ id, label }]; controlled via activeId + onChange.
 */
export default function Tabs({ items, activeId, onChange, ariaLabel = 'Sections' }) {
  return (
    <div className="tabs" role="tablist" aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={item.id === activeId}
          className="tabs__tab"
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
