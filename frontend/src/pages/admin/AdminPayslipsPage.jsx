import { useAsyncData } from '../../hooks/useAsyncData.js'
import Loading from '../../components/states/Loading.jsx'
import EmptyState from '../../components/states/EmptyState.jsx'
import ErrorState from '../../components/states/ErrorState.jsx'
import PayslipCard from '../../components/ui/PayslipCard.jsx'
import * as payrollService from '../../api/payrollService.js'
import '../payslipGrid.css'

// Spec §3/§4: Admin view across all payslips, including the component
// snapshot stored at finalization. Read-only — no mutation controls exist.
export default function AdminPayslipsPage() {
  const { loading, data, errors, retry } = useAsyncData({
    payslips: payrollService.listAllPayslips,
  })

  if (loading) {
    return (
      <section className="page">
        <h1>All Payslips</h1>
        <Loading label="Loading payslips…" />
      </section>
    )
  }

  const payslips = Array.isArray(data.payslips) ? data.payslips : []

  return (
    <section className="page">
      <header className="page__header">
        <h1>All Payslips</h1>
        <p className="page__description">
          Company-wide payslips with the salary component snapshot stored at finalization.
        </p>
      </header>

      {errors.payslips ? (
        <ErrorState title="Could not load payslips" message="Please try again." onRetry={retry} />
      ) : payslips.length === 0 ? (
        <EmptyState title="No payslips yet" message="Payslips appear once payroll runs are calculated." />
      ) : (
        <div className="payslip-grid">
          {payslips.map((payslip) => (
            <PayslipCard key={payslip.id} payslip={payslip} showEmployee />
          ))}
        </div>
      )}
    </section>
  )
}
