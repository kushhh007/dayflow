import PagePlaceholder from '../components/ui/PagePlaceholder.jsx'

// Spec §9: in-app notifications only (leave approved/rejected, attendance
// anomaly, payroll ready). Shared by ADMIN and EMPLOYEE roles.
export default function NotificationsPage() {
  return (
    <PagePlaceholder
      title="Notifications"
      description="Your in-app notification feed. Unread items are highlighted and can be marked read."
      specArea="notifications"
    />
  )
}
