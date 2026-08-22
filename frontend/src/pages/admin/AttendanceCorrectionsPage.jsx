import PagePlaceholder from '../../components/ui/PagePlaceholder.jsx'

// Spec §5: Admin approval queue for attendance correction requests. Allowed
// transitions: ABSENT → PRESENT/HALF_DAY, corrected PRESENT/HALF_DAY. Never
// LEAVE → PRESENT. Corrections inside finalized payroll runs surface a note.
export default function AttendanceCorrectionsPage() {
  return (
    <PagePlaceholder
      title="Attendance Corrections"
      description="Review and approve or reject employee correction requests, ranked by attention score."
      specArea="attendance corrections"
    />
  )
}
