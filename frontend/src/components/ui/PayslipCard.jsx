import StatusBadge from './StatusBadge.jsx'
import './payslipCard.css'

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

// Read-only payslip renderer shared by the employee and admin pages.
// Every figure comes from the service payload — this component performs no
// payroll math and offers no mutation controls (finalized payslips are
// immutable, spec §4).
export default function PayslipCard({ payslip, showEmployee = false }) {
  const p = payslip

  return (
    <article className="payslip">
      <header className="payslip__head">
        <div>
          <p className="payslip__period">{p.periodLabel}</p>
          {showEmployee && p.employeeName && (
            <p className="payslip__employee">{p.employeeName}</p>
          )}
        </div>
        <StatusBadge status={p.status} />
      </header>

      <div className="payslip__net">
        <span>Net pay</span>
        <strong>{inr.format(p.net)}</strong>
      </div>

      <dl className="payslip__lines">
        <div className="payslip__section">Earnings</div>
        <div>
          <dt>Basic</dt>
          <dd>{inr.format(p.basic)}</dd>
        </div>
        <div>
          <dt>HRA</dt>
          <dd>{inr.format(p.hra)}</dd>
        </div>
        <div>
          <dt>Standard allowance</dt>
          <dd>{inr.format(p.standardAllowance)}</dd>
        </div>
        <div>
          <dt>Performance bonus</dt>
          <dd>{inr.format(p.performanceBonus)}</dd>
        </div>
        <div>
          <dt>LTA</dt>
          <dd>{inr.format(p.lta)}</dd>
        </div>
        <div>
          <dt>Fixed allowance</dt>
          <dd>{inr.format(p.fixedAllowance)}</dd>
        </div>
        <div className="payslip__gross">
          <dt>Gross salary</dt>
          <dd>{inr.format(p.gross)}</dd>
        </div>

        <div className="payslip__section">Deductions</div>
        <div>
          <dt>Employee PF</dt>
          <dd>{inr.format(p.employeePF)}</dd>
        </div>
        <div>
          <dt>Professional tax</dt>
          <dd>{inr.format(p.professionalTax)}</dd>
        </div>
        {showEmployee && (
          <div>
            <dt>Employer PF (company cost)</dt>
            <dd>{inr.format(p.employerPF)}</dd>
          </div>
        )}
      </dl>

      <footer className="payslip__meta">
        Payable days {p.payableDays} of {p.workingDays} working days
        {p.status === 'CALCULATED'
          ? ' · Provisional — replaced when the run is recalculated'
          : ' · Finalized — immutable record'}
      </footer>
    </article>
  )
}
