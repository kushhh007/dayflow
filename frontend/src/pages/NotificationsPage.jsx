import { useState } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import { useAsyncData } from '../hooks/useAsyncData.js'
import Loading from '../components/states/Loading.jsx'
import EmptyState from '../components/states/EmptyState.jsx'
import ErrorState from '../components/states/ErrorState.jsx'
import * as notificationService from '../api/notificationService.js'
import './notificationsPage.css'

// Notification types are limited to the v4.5 minimum event set. The page
// renders recipient-scoped service data and never invents notification rules.
function formatCreatedAt(value) {
  if (!value) return 'Unknown time'
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default function NotificationsPage() {
  const { role } = useAuth()
  const { loading, data, errors, retry } = useAsyncData({
    notifications: () => notificationService.listNotifications({ role }),
  })
  const [readIds, setReadIds] = useState(() => new Set())
  const [busyId, setBusyId] = useState(null)
  const [actionError, setActionError] = useState(null)

  if (loading) {
    return (
      <section className="page">
        <h1>Notifications</h1>
        <Loading label="Loading notifications…" />
      </section>
    )
  }

  const notifications = Array.isArray(data.notifications) ? data.notifications : []
  const unreadCount = notifications.filter(
    (notification) => !notification.isRead && !readIds.has(notification.id),
  ).length

  async function handleMarkRead(notificationId) {
    if (busyId) return
    setBusyId(notificationId)
    setActionError(null)
    try {
      await notificationService.markNotificationRead(notificationId)
      setReadIds((current) => new Set([...current, notificationId]))
    } catch (error) {
      setActionError(error.message || 'Could not mark the notification as read.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="page notifications">
      <header className="page__header">
        <h1>Notifications</h1>
        <p className="page__description">
          In-app updates for leave, attendance anomalies, and payroll readiness.
        </p>
      </header>

      {errors.notifications ? (
        <ErrorState title="Could not load notifications" onRetry={retry} />
      ) : notifications.length === 0 ? (
        <EmptyState title="No notifications" message="You are all caught up." />
      ) : (
        <div className="notifications__panel">
          <div className="notifications__summary">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </div>
          {actionError && (
            <p className="notifications__error" role="alert">
              {actionError}
            </p>
          )}
          <ul className="notifications__list">
            {notifications.map((notification) => {
              const isRead = notification.isRead || readIds.has(notification.id)
              return (
                <li className={isRead ? 'notification' : 'notification notification--unread'} key={notification.id}>
                  <div className="notification__body">
                    <div className="notification__heading">
                      <span className="notification__type">
                        {String(notification.type ?? 'UPDATE').replaceAll('_', ' ')}
                      </span>
                      {!isRead && <span className="notification__dot" aria-label="Unread" />}
                    </div>
                    <p className="notification__message">{notification.message}</p>
                    <p className="notification__time">{formatCreatedAt(notification.createdAt)}</p>
                  </div>
                  {!isRead && (
                    <button
                      type="button"
                      className="notification__read"
                      disabled={Boolean(busyId)}
                      onClick={() => handleMarkRead(notification.id)}
                    >
                      {busyId === notification.id ? 'Updating…' : 'Mark as read'}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
