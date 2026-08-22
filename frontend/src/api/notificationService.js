import { mockResponse } from './mock.js'

// MOCK SERVICE. Contract areas follow the Dayflow v4.5 spec; endpoint paths
// will be defined in docs/api.md by the backend lead and must not be invented
// here. Replace bodies with apiRequest() calls when it lands.

const store = [
  {
    id: 'ntf-employee-leave',
    audience: 'EMPLOYEE',
    type: 'LEAVE_APPROVED',
    message: 'Your sick leave request was approved.',
    isRead: false,
    createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'ntf-employee-payroll',
    audience: 'EMPLOYEE',
    type: 'PAYROLL_READY',
    message: 'Your payslip is ready for review.',
    isRead: true,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'ntf-admin-attendance',
    audience: 'ADMIN',
    type: 'ATTENDANCE_ANOMALY',
    message: 'An attendance anomaly needs review.',
    isRead: false,
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'ntf-admin-payroll',
    audience: 'ADMIN',
    type: 'PAYROLL_READY',
    message: 'A payroll run is ready for review.',
    isRead: false,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
]

function publicNotification(notification) {
  const { audience, ...payload } = notification
  void audience
  return { ...payload }
}

export async function listNotifications({ role = 'EMPLOYEE' } = {}) {
  // Contract area: NOTIFICATIONS — in-app only: leave approved/rejected,
  // attendance anomaly, payroll ready for review (spec §9). The audience is
  // mock-only filtering metadata; the eventual recipient_id contract belongs
  // in docs/api.md. Public shape: { id, type, message, isRead, createdAt }.
  const notifications = store
    .filter((notification) => notification.audience === role)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(publicNotification)
  return mockResponse(notifications)
}

export async function markNotificationRead(notificationId) {
  // Contract area: NOTIFICATIONS — set is_read on one notification.
  const notification = store.find((entry) => entry.id === notificationId)
  if (!notification) {
    throw new Error('Notification not found.')
  }
  notification.isRead = true
  return mockResponse(publicNotification(notification))
}
