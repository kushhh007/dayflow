import PagePlaceholder from '../components/ui/PagePlaceholder.jsx'

// Spec §2: employees created by Admin receive a temporary password and are
// forced to change it at first login. The real form connects to the auth
// service once the API contract exists.
export default function ChangePasswordPage() {
  return (
    <PagePlaceholder
      title="Change your password"
      description="First-login security step required by the Dayflow spec. You will set a new password before reaching your workspace."
    />
  )
}
