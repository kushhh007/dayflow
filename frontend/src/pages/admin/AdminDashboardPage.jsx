import PagePlaceholder from '../../components/ui/PagePlaceholder.jsx'

// Spec §10: Smart Daily Brief with the four Ops rules, Attention Score
// (always shown with breakdown), Attention-ranked approval queue, and the
// exact empty state when no flags are active. Demo opens on this screen.
export default function AdminDashboardPage() {
  return (
    <PagePlaceholder
      title="Smart Daily Brief"
      description="Today's attendance, leave and payroll signals at a glance: unexplained absences, department coverage risk, low leave balances and anomalies — ranked by attention score."
      specArea="Ops Intelligence dashboard"
    />
  )
}
