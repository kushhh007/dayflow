import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { ROLES } from '../constants/roles.js'
import { useAuth } from '../hooks/useAuth.js'
import { homePathForRole } from '../config/navigation.js'
import AppLayout from '../components/layout/AppLayout.jsx'
import LoginPage from '../pages/LoginPage.jsx'
import ChangePasswordPage from '../pages/ChangePasswordPage.jsx'
import NotFoundPage from '../pages/NotFoundPage.jsx'
import NotificationsPage from '../pages/NotificationsPage.jsx'
import EmployeeDashboardPage from '../pages/employee/EmployeeDashboardPage.jsx'
import ProfilePage from '../pages/employee/ProfilePage.jsx'
import AttendancePage from '../pages/employee/AttendancePage.jsx'
import LeavePage from '../pages/employee/LeavePage.jsx'
import PayslipsPage from '../pages/employee/PayslipsPage.jsx'
import AdminDashboardPage from '../pages/admin/AdminDashboardPage.jsx'
import EmployeesPage from '../pages/admin/EmployeesPage.jsx'
import AttendanceCorrectionsPage from '../pages/admin/AttendanceCorrectionsPage.jsx'
import LeaveApprovalsPage from '../pages/admin/LeaveApprovalsPage.jsx'
import PayrollPage from '../pages/admin/PayrollPage.jsx'
import AdminPayslipsPage from '../pages/admin/AdminPayslipsPage.jsx'

// Guards every authenticated area. Users with a pending first-login password
// change are locked out of everything except /change-password.
function RequireSession() {
  const { isAuthenticated, mustChangePassword } = useAuth()
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  if (mustChangePassword) {
    return <Navigate to="/change-password" replace />
  }
  return <Outlet />
}

// /change-password is only reachable while the pending change exists; it sits
// outside RequireSession so the redirect above cannot loop against it.
function RequirePasswordChange() {
  const { isAuthenticated, mustChangePassword, role } = useAuth()
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  if (!mustChangePassword) {
    return <Navigate to={homePathForRole(role)} replace />
  }
  return <Outlet />
}

function RequireRole({ role }) {
  const { isAuthenticated, mustChangePassword, role: userRole } = useAuth()
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  if (mustChangePassword) {
    return <Navigate to="/change-password" replace />
  }
  if (userRole !== role) {
    return <Navigate to="/" replace />
  }
  return <Outlet />
}

function RoleRedirect() {
  const { isAuthenticated, mustChangePassword, role } = useAuth()
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  if (mustChangePassword) {
    return <Navigate to="/change-password" replace />
  }
  return <Navigate to={homePathForRole(role)} replace />
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RoleRedirect />} />
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequirePasswordChange />}>
        <Route path="/change-password" element={<ChangePasswordPage />} />
      </Route>

      <Route element={<RequireSession />}>
        <Route element={<AppLayout />}>
          <Route path="/notifications" element={<NotificationsPage />} />

          <Route element={<RequireRole role={ROLES.EMPLOYEE} />}>
            <Route path="/employee" element={<EmployeeDashboardPage />} />
            <Route path="/employee/profile" element={<ProfilePage />} />
            <Route path="/employee/attendance" element={<AttendancePage />} />
            <Route path="/employee/leave" element={<LeavePage />} />
            <Route path="/employee/payslips" element={<PayslipsPage />} />
          </Route>

          <Route element={<RequireRole role={ROLES.ADMIN} />}>
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/admin/employees" element={<EmployeesPage />} />
            <Route path="/admin/attendance-corrections" element={<AttendanceCorrectionsPage />} />
            <Route path="/admin/leave-approvals" element={<LeaveApprovalsPage />} />
            <Route path="/admin/payroll" element={<PayrollPage />} />
            <Route path="/admin/payslips" element={<AdminPayslipsPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
