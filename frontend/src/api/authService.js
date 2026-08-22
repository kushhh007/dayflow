import { ROLES } from '../constants/roles.js'
import { mockResponse } from './mock.js'

// MOCK SERVICE. Contract areas below follow the Dayflow v4.5 spec; endpoint
// paths will be defined in docs/api.md by the backend lead and must not be
// invented here. Replace bodies with apiRequest() calls when it lands.
//
// Demo accounts exist only so this shell is navigable before authentication
// is wired to the backend. Remove once the real auth flow exists.

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
  const match = DEMO_USERS.find((user) => user.loginId === loginId && user.password === password)

  if (!match) {
    throw new Error('Invalid login ID or password.')
  }

  return mockResponse(toSessionUser(match))
}

export async function logout() {
  // Contract area: AUTH — invalidate the current session/token.
  return mockResponse({ success: true })
}

export async function changePassword() {
  // Contract area: AUTH — forced first-login password change (spec §2).
  return mockResponse({ success: true })
}
