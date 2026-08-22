import './ui.css'

function initialsOf(name) {
  if (!name) return '?'
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

/**
 * Circular avatar. Renders the profile image when `src` is given,
 * otherwise falls back to initials derived from `name`.
 * size: 'sm' | 'md' | 'lg'
 */
export default function Avatar({ name, src, size = 'md', alt }) {
  return (
    <span className={`avatar avatar--${size}`} title={name}>
      {src ? <img src={src} alt={alt ?? name ?? ''} /> : initialsOf(name)}
    </span>
  )
}
