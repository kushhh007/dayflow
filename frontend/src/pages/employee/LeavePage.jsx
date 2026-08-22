import PagePlaceholder from '../../components/ui/PagePlaceholder.jsx'

// Spec §6: apply for full-day Paid/Sick/Unpaid leave. Sick requires an
// attachment; no cross-year spans; only PENDING requests can be cancelled —
// approved leave is terminal.
export default function LeavePage() {
  return (
    <PagePlaceholder
      title="My Leave"
      description="Apply for leave, track request status, view balances, and cancel pending requests."
      specArea="leave"
    />
  )
}
