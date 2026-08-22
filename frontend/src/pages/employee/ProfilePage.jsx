import PagePlaceholder from '../../components/ui/PagePlaceholder.jsx'

// Spec §7: employees may edit only phone, personal email, residing address,
// and profile picture. All other fields are read-only here (Admin-edit-only).
export default function ProfilePage() {
  return (
    <PagePlaceholder
      title="My Profile"
      description="View your profile. Only phone, personal email, address and picture are editable; everything else is Admin-managed."
      specArea="employee profile"
    />
  )
}
