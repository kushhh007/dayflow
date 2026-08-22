// Single source of truth for sidebar navigation. Paths must mirror
// routes/AppRoutes.jsx. /notifications is shared by both roles and is
// handled separately by the Topbar.
export const NAV_ITEMS = [
  { label: 'Dashboard', path: '/employee', roles: ['EMPLOYEE'], end: true },
  { label: 'My Profile', path: '/employee/profile', roles: ['EMPLOYEE'] },
  { label: 'Attendance', path: '/employee/attendance', roles: ['EMPLOYEE'] },
  { label: 'Leave', path: '/employee/leave', roles: ['EMPLOYEE'] },
  { label: 'Payslips', path: '/employee/payslips', roles: ['EMPLOYEE'] },
  { label: 'Daily Brief', path: '/admin', roles: ['ADMIN'], end: true },
  { label: 'Employees', path: '/admin/employees', roles: ['ADMIN'] },
  { label: 'Attendance Corrections', path: '/admin/attendance-corrections', roles: ['ADMIN'] },
  { label: 'Leave Approvals', path: '/admin/leave-approvals', roles: ['ADMIN'] },
  { label: 'Payroll Runs', path: '/admin/payroll', roles: ['ADMIN'] },
  { label: 'All Payslips', path: '/admin/payslips', roles: ['ADMIN'] },
]

export function navItemsForRole(role) {
  return NAV_ITEMS.filter((item) => item.roles.includes(role))
}
