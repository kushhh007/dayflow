import { useAsyncData } from '../../hooks/useAsyncData.js'
import Loading from '../../components/states/Loading.jsx'
import EmptyState from '../../components/states/EmptyState.jsx'
import ErrorState from '../../components/states/ErrorState.jsx'
import PayslipCard from '../../components/ui/PayslipCard.jsx'
import * as payrollService from '../../api/payrollService.js'
import '../payslipGrid.css'

// Spec §3: employees see only their own payslips — gross, itemized
// components/deductions, net. Salary structure and other employees' data are
// never present on this page. Payslips are display-only; FINALIZED records
// expose no edit/reopen/recalculate controls (immutable per spec §4).
export default function PayslipsPage() {
  const { loading, data, errors, retry } = useAsyncData({
    payslips: payrollService.listPayslips,
  })

  if (loading) {
    return (
      <section className="page">
        <h1>My Payslips</h1>
        <Loading label="Loading payslips…" />
      </section>
    )
  }

  const payslips = Array.isArray(data.payslips) ? data.payslips : []

  return (
    <section className="page">
      <header className="page__header">
        <h1>My Payslips</h1>
        <p className="page__description">
          Monthly payslips with gross pay, itemized earnings and deductions, and net pay.
        </p>
      </header>

      {errors.payslips ? (
        <ErrorState
          title="Could not load payslips"
          message="Please try again."
          onRetry={retry}
        />
      ) : payslips.length === 0 ? (
        <EmptyState
          title="No payslips yet"
          message="Your first payslip appears here once a payroll run is processed."
        />
      ) : (
        <div className="payslip-grid">
          {payslips.map((payslip) => (
            <PayslipCard key={payslip.id} payslip={payslip} />
          ))}
        </div>
      )}
    </section>
  )
}
