import { createContext, useContext, useState, type ReactNode } from 'react'
import { callApi } from '@/lib/api'
import { clearToken, decodeToken, getToken, isExpired, setToken } from '@/lib/authToken'

export interface AuthUser {
  name: string
}

interface AuthContextValue {
  user: AuthUser | null
  login: (name: string, password: string) => Promise<void>
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

// Reading the token from localStorage is synchronous — unlike the old
// Supabase client, there is no async session recovery step, so this can run
// directly as the initial state instead of a `loading` flag + useEffect.
function readInitialUser(): AuthUser | null {
  const token = getToken()
  if (!token) return null
  const payload = decodeToken(token)
  if (payload && !isExpired(payload)) return { name: payload.name }
  clearToken()
  return null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(readInitialUser)

  const login = async (name: string, password: string) => {
    const { token } = await callApi<{ token: string }>('login', { name, password })
    setToken(token)
    setUser({ name })
  }

  const signOut = () => {
    clearToken()
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, login, signOut }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
