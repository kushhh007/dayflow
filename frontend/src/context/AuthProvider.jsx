import { useCallback, useMemo, useState } from 'react'
import { AuthContext } from './authContext.js'
import {
  login as loginRequest,
  logout as logoutRequest,
  changePassword as changePasswordRequest,
} from '../api/authService.js'

const STORAGE_KEY = 'dayflow.session'

function readStoredUser() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function persistUser(user) {
  try {
    if (user) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage unavailable — session stays in memory only.
  }
}

// Session handling is a temporary local mock until the auth API contract
// exists. Token/refresh semantics will replace localStorage persistence.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser)

  const login = useCallback(async (credentials) => {
    const sessionUser = await loginRequest(credentials)
    setUser(sessionUser)
    persistUser(sessionUser)
    return sessionUser
  }, [])

  const logout = useCallback(async () => {
    await logoutRequest()
    setUser(null)
    persistUser(null)
  }, [])

  const completePasswordChange = useCallback(async () => {
    await changePasswordRequest()
    // Frontend-only completion: the real backend will own the password change
    // and session behavior once the auth contract exists.
    setUser((current) => {
      if (!current) return current
      const updated = { ...current, mustChangePassword: false }
      persistUser(updated)
      return updated
    })
  }, [])

  const value = useMemo(
    () => ({
      user,
      role: user?.role ?? null,
      isAuthenticated: Boolean(user),
      mustChangePassword: Boolean(user?.mustChangePassword),
      login,
      logout,
      completePasswordChange,
    }),
    [user, login, logout, completePasswordChange],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
