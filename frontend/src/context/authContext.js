import { createContext } from 'react'

// Shape: { user, role, isAuthenticated, mustChangePassword, login, logout,
// completePasswordChange }
export const AuthContext = createContext(null)
