import PagePlaceholder from '../../components/ui/PagePlaceholder.jsx'

// Spec §5: check-in/check-out within the 06:00–22:00 company-local window,
// Mon–Fri only. Includes correction request submission (one pending per date;
// LEAVE → PRESENT is permanently prohibited).
export default function AttendancePage() {
  return (
    <PagePlaceholder
      title="My Attendance"
      description="Check in, check out, review your records, and submit correction requests for Admin approval."
      specArea="attendance"
    />
  )
}
