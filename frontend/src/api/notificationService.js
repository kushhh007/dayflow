import { mockResponse, DEMO_NOTIFICATIONS } from './mock.js'

// MOCK SERVICE. Contract areas follow the Dayflow v4.5 spec; endpoint paths
// will be defined in docs/api.md by the backend lead and must not be invented
// here. Replace bodies with apiRequest() calls when it lands.

export async function listNotifications() {
  // Contract area: NOTIFICATIONS — in-app only: leave approved/rejected,
  // attendance anomaly, payroll ready for review (spec §9).
  return mockResponse(DEMO_NOTIFICATIONS)
}

export async function markNotificationRead(notificationId) {
  // Contract area: NOTIFICATIONS — set is_read on one notification.
  return mockResponse({ id: notificationId, isRead: true })
}
