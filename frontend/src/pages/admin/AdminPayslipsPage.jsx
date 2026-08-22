import PagePlaceholder from '../../components/ui/PagePlaceholder.jsx'

// Spec §3: Admin sees every employee's payslip plus full salary structure
// configuration. Payslips are immutable once finalized.
export default function AdminPayslipsPage() {
  return (
    <PagePlaceholder
      title="All Payslips"
      description="Browse payslips across the company, including the salary component snapshot stored at finalization."
      specArea="company payslips"
    />
  )
}
