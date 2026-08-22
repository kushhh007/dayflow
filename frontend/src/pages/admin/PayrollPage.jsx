import PagePlaceholder from '../../components/ui/PagePlaceholder.jsx'

// Spec §4: Admin-only payroll run lifecycle DRAFT → CALCULATED → FINALIZED.
// All amounts are computed by the backend; this UI only triggers actions and
// displays returned data. FINALIZED runs are terminal and immutable.
export default function PayrollPage() {
  return (
    <PagePlaceholder
      title="Payroll Runs"
      description="Create monthly payroll runs, calculate provisional payslips, review, then finalize."
      specArea="payroll"
    />
  )
}
