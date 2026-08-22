import { ROLES } from '../constants/roles.js'
import { mockResponse } from './mock.js'
import { getEmployee } from './employeeService.js'

// MOCK SERVICE. Contract areas below follow the Dayflow v4.5 spec; endpoint
// paths will be defined in docs/api.md by the backend lead and must not be
// invented here. Replace bodies with apiRequest() calls when it lands.
//
// Demo accounts exist only so this shell is navigable before authentication
// is wired to the backend. Remove once the real auth flow exists.
//
// Dev-only persistence: passwords changed through the first-login flow are
// stored in localStorage and honored by later logins in the same browser,
// simulating a persistent credential store. Clearing site data resets all
// mocks. This models no real token/session behavior.

const MOCK_OVERRIDES_KEY = 'dayflow.mockUsers'

function readOverrides() {
  try {
    const raw = window.localStorage.getItem(MOCK_OVERRIDES_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeOverrides(overrides) {
  try {
    window.localStorage.setItem(MOCK_OVERRIDES_KEY, JSON.stringify(overrides))
  } catch {
    // Storage unavailable — overrides degrade to non-persistent dev behavior.
  }
}

function applyOverride(user, overrides) {
  const override = overrides[user.loginId]
  return override ? { ...user, ...override } : user
}

const DEMO_PASSWORD = 'demo1234'

const DEMO_USERS = [
  {
    id: 'emp-demo',
    loginId: 'demo.employee',
    password: DEMO_PASSWORD,
    name: 'Demo Employee',
    role: ROLES.EMPLOYEE,
    mustChangePassword: false,
  },
  {
    id: 'adm-demo',
    loginId: 'demo.admin',
    password: DEMO_PASSWORD,
    name: 'Demo Admin',
    role: ROLES.ADMIN,
    mustChangePassword: false,
  },
  {
    id: 'emp-first',
    loginId: 'demo.firstlogin',
    password: 'temp1234',
    name: 'First Login Employee',
    role: ROLES.EMPLOYEE,
    mustChangePassword: true,
  },
]

function toSessionUser(user) {
  return {
    id: user.id,
    loginId: user.loginId,
    name: user.name,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  }
}

export async function login({ loginId, password }) {
  // Contract area: AUTH — authenticate with system-generated Login ID + password
  // (spec §2). Real behavior: backend validates credentials, checks employee
  // status is ACTIVE, returns session/token, flags first-login password change.
  const account = DEMO_USERS.find((user) => user.loginId === loginId)

  if (!account) {
    throw new Error('Invalid login ID or password.')
  }

  const effectiveUser = applyOverride(account, readOverrides())

  if (effectiveUser.password !== password) {
    throw new Error('Invalid login ID or password.')
  }

  const employee = await getEmployee(effectiveUser.id)
  if (employee.status !== 'ACTIVE') {
    throw new Error('This employee is inactive and cannot log in.')
  }

  return mockResponse(toSessionUser(effectiveUser))
}

export async function logout() {
  // Contract area: AUTH — invalidate the current session/token.
  return mockResponse({ success: true })
}

export async function changePassword({ loginId, newPassword }) {
  // Contract area: AUTH — forced first-login password change (spec §2).
  // Mock-only: persists the new password and clears the mustChangePassword
  // flag so subsequent logins in this browser use the changed credentials.
  if (!loginId) {
    throw new Error('Cannot change password without an active session.')
  }
  if (!newPassword) {
    throw new Error('New password is required.')
  }

  const account = DEMO_USERS.find((user) => user.loginId === loginId)
  if (!account) {
    throw new Error('Unknown account.')
  }

  const overrides = readOverrides()
  overrides[loginId] = { password: newPassword, mustChangePassword: false }
  writeOverrides(overrides)

  return mockResponse({ success: true })
}
