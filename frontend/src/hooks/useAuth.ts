import { useState, useEffect, useRef, createContext, useContext } from 'react'
import type { User, RegisterPayload } from '../api/client'
import * as api from '../api/client'

interface AuthCtx {
  user: User | null
  loading: boolean
  initializing: boolean
  login: (email: string, password: string) => Promise<void>
  register: (payload: RegisterPayload) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

export const AuthContext = createContext<AuthCtx>({} as AuthCtx)
export const useAuth = () => useContext(AuthContext)

export function useAuthProvider(): AuthCtx {
  const [user, setUser]         = useState<User | null>(null)
  const [loading, setLoading]   = useState(false)
  const [initializing, setInit] = useState(true)
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    if (api.hasToken()) {
      api.getMe()
        .then(u => setUser(u))
        .catch(() => { api.logout() })
        .finally(() => setInit(false))
    } else {
      setInit(false)
    }
  }, [])

  const refreshUser = async () => {
    try { setUser(await api.getMe()) }
    catch { setUser(null); api.logout() }
  }

  const login = async (email: string, password: string) => {
    setLoading(true)
    try {
      await api.login(email, password)
      setUser(await api.getMe())
    } finally { setLoading(false) }
  }

  const register = async (payload: RegisterPayload) => {
    setLoading(true)
    try {
      await api.register(payload)
      await api.login(payload.email, payload.password)
      setUser(await api.getMe())
    } finally { setLoading(false) }
  }

  const logout = () => { api.logout(); setUser(null) }

  return { user, loading, initializing, login, register, logout, refreshUser }
}