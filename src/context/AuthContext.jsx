import { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../api'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    api('/auth/me').then((d) => setUser(d.user)).catch(() => {}).finally(() => setReady(true))
  }, [])

  const login = async (identifier, password) => {
    const d = await api('/auth/login', { method: 'POST', data: { identifier, password } })
    setUser(d.user)
  }
  const logout = async () => {
    await api('/auth/logout', { method: 'POST' })
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, ready, login, logout }}>{children}</AuthContext.Provider>
}
