import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { authApi } from '../api/client'

export interface User {
  id: string
  email: string
  name: string
  picture?: string
  phone?: string
  role: 'patient' | 'physiotherapist' | 'admin'
  patient_id?: string
  physio_id?: string
  age?: number
  gender?: string
  diagnosis?: string
  rehab_goals?: string
  speciality?: string
  license_number?: string
  mobility_mode?: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (credentials: { identifier: string; password: string; role?: string }) => Promise<User>
  register: (data: any) => Promise<User>
  devLogin: (role?: 'patient' | 'physiotherapist') => Promise<User>
  logout: () => Promise<void>
  refreshUser: () => Promise<User | null>
  setToken: (token: string) => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const normalizeUser = (data: any): User | null => {
    if (!data) return null
    const baseUser = data.user || data
    const patientData = data.patient || {}
    const physioData = data.physiotherapist || {}

    return {
      id: baseUser.id || '',
      email: baseUser.email || '',
      name: baseUser.name || '',
      picture: baseUser.picture || '',
      phone: baseUser.phone || '',
      role: baseUser.role || (patientData.id ? 'patient' : physioData.id ? 'physiotherapist' : 'patient'),
      patient_id: patientData.id || baseUser.patient_id || '',
      physio_id: physioData.id || baseUser.physio_id || '',
      age: patientData.age ?? baseUser.age,
      gender: patientData.gender || baseUser.gender,
      diagnosis: patientData.diagnosis || baseUser.diagnosis,
      rehab_goals: patientData.rehab_goals || baseUser.rehab_goals,
      speciality: physioData.speciality || baseUser.speciality,
      license_number: physioData.license_number || baseUser.license_number,
      mobility_mode: patientData.mobility_mode || baseUser.mobility_mode,
    }
  }

  const refreshUser = async (): Promise<User | null> => {
    try {
      const res = await authApi.getMe()
      const normalized = normalizeUser(res.data)
      setUser(normalized)
      return normalized
    } catch {
      localStorage.removeItem('auth_token')
      setUser(null)
      return null
    }
  }

  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    if (token) {
      refreshUser().finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (credentials: { identifier: string; password: string; role?: string }): Promise<User> => {
    const res = await authApi.login(credentials)
    if (res.data.token) {
      localStorage.setItem('auth_token', res.data.token)
    }
    const normalized = normalizeUser(res.data)
    setUser(normalized)
    refreshUser().catch(() => {})
    return normalized!
  }

  const register = async (data: any): Promise<User> => {
    const res = await authApi.register(data)
    if (res.data.token) {
      localStorage.setItem('auth_token', res.data.token)
    }
    const normalized = normalizeUser(res.data)
    setUser(normalized)
    refreshUser().catch(() => {})
    return normalized!
  }

  const devLogin = async (role: 'patient' | 'physiotherapist' = 'patient'): Promise<User> => {
    const res = await authApi.devLogin(role)
    if (res.data.token) {
      localStorage.setItem('auth_token', res.data.token)
    }
    const normalized = normalizeUser(res.data)
    setUser(normalized)
    refreshUser().catch(() => {})
    return normalized!
  }

  const logout = async () => {
    await authApi.logout().catch(() => {})
    localStorage.removeItem('auth_token')
    setUser(null)
    window.location.href = '/login'
  }

  const setToken = (token: string) => {
    localStorage.setItem('auth_token', token)
    refreshUser().catch(() => {})
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, devLogin, logout, refreshUser, setToken }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
