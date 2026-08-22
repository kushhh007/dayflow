import PagePlaceholder from '../../components/ui/PagePlaceholder.jsx'

// Spec §6: Admin leave approval queue, Attention-ranked. Admins never act on
// their own requests; approval atomically updates attendance and balance.
export default function LeaveApprovalsPage() {
  return (
    <PagePlaceholder
      title="Leave Approvals"
      description="Approve or reject pending leave requests with balances and coverage impact in view."
      specArea="leave approvals"
    />
  )
}
