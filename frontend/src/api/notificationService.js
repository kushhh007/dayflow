import { mockResponse } from './mock.js'

// MOCK SERVICE. Contract areas follow the Dayflow v4.5 spec; endpoint paths
// will be defined in docs/api.md by the backend lead and must not be invented
// here. Replace bodies with apiRequest() calls when it lands.

export async function listNotifications() {
  // Contract area: NOTIFICATIONS — in-app only: leave approved/rejected,
  // attendance anomaly, payroll ready for review (spec §9). Sample shape:
  // [{ id, type, message, isRead, createdAt }]. Final schema pending
  // docs/api.md.
  const notifications = [
    {
      id: 'ntf-sample-1',
      type: 'LEAVE_APPROVED',
      message: 'Your sick leave request was approved.',
      isRead: false,
      createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'ntf-sample-2',
      type: 'PAYROLL_READY',
      message: 'Your payslip is ready for review.',
      isRead: true,
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ]
  return mockResponse(notifications)
}

export async function markNotificationRead(notificationId) {
  // Contract area: NOTIFICATIONS — set is_read on one notification.
  return mockResponse({ id: notificationId, isRead: true })
}
