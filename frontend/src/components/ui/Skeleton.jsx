import './ui.css'

/**
 * Shimmering loading placeholder. Defaults to a full-width text line;
 * pass width/height for custom shapes ('100%', '24px', ...).
 */
export default function Skeleton({ width = '100%', height = '14px', radius }) {
  return <span className="skeleton" style={{ width, height, borderRadius: radius }} aria-hidden="true" />
}
