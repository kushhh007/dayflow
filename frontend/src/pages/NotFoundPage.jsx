import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="page" style={{ justifyItems: 'center', textAlign: 'center' }}>
        <h1>Page not found</h1>
        <p className="page__description">The page you requested does not exist.</p>
        <Link to="/">Go to my workspace</Link>
      </div>
    </main>
  )
}
