import './profileAvatar.css'

function initialsFor(name) {
  return String(name ?? 'Employee')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'E'
}

export default function ProfileAvatar({ name, src, size = 'medium' }) {
  return (
    <span className={`profile-avatar profile-avatar--${size}`} role="img" aria-label={`${name ?? 'Employee'} profile picture`}>
      {src ? <img src={src} alt="" /> : initialsFor(name)}
    </span>
  )
}
