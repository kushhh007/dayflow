import PagePlaceholder from '../../components/ui/PagePlaceholder.jsx'

// Spec §3: employees see payslips only — gross, itemized deductions, net.
// The underlying salary structure is never visible to employees.
export default function PayslipsPage() {
  return (
    <PagePlaceholder
      title="My Payslips"
      description="Download and review your finalized monthly payslips with gross salary, deductions and net pay."
      specArea="payslips"
    />
  )
}
