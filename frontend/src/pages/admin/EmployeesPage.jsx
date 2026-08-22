import PagePlaceholder from '../../components/ui/PagePlaceholder.jsx'

// Spec §2/§7: create employees (Login ID + temp password generated backend-side,
// shown once), edit profiles, activate/deactivate. Departments and job
// positions are seeded selections — no CRUD screens.
export default function EmployeesPage() {
  return (
    <PagePlaceholder
      title="Employees"
      description="Manage the employee directory: onboard new employees, update profiles, and handle activations."
      specArea="employee management"
    />
  )
}
