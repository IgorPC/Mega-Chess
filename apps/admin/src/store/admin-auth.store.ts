import { create } from 'zustand'
import type { AdminRole, AdminUser } from '../types'

interface AdminAuthState {
  admin: AdminUser | null
  accessToken: string | null
  pendingOtpEmail: string | null
  mustChangePassword: boolean
  setAuth: (admin: AdminUser, accessToken: string, mustChangePassword?: boolean) => void
  setOtpPending: (email: string) => void
  clearOtpPending: () => void
  logout: () => void
  logoutLocal: () => void
  hasRole: (required: AdminRole) => boolean
}

const ROLE_HIERARCHY: Record<AdminRole, number> = {
  SUPORTE: 1,
  FINANCEIRO: 2,
  OPERADOR: 3,
  ADMIN: 4,
}

export const useAdminAuth = create<AdminAuthState>((set, get) => ({
  admin: (() => {
    try {
      const raw = localStorage.getItem('admin')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })(),
  accessToken: localStorage.getItem('adminToken'),
  pendingOtpEmail: null,
  mustChangePassword: false,

  setAuth: (admin, accessToken, mustChangePassword = false) => {
    localStorage.setItem('adminToken', accessToken)
    localStorage.setItem('admin', JSON.stringify(admin))
    set({ admin, accessToken, mustChangePassword, pendingOtpEmail: null })
  },

  setOtpPending: (email) => {
    set({ pendingOtpEmail: email })
  },

  clearOtpPending: () => {
    set({ pendingOtpEmail: null })
  },

  logout: () => {
    localStorage.removeItem('adminToken')
    localStorage.removeItem('admin')
    set({ admin: null, accessToken: null, mustChangePassword: false, pendingOtpEmail: null })
  },

  logoutLocal: () => {
    localStorage.removeItem('adminToken')
    localStorage.removeItem('admin')
    set({ admin: null, accessToken: null, mustChangePassword: false, pendingOtpEmail: null })
  },

  hasRole: (required) => {
    const { admin } = get()
    if (!admin) return false
    return ROLE_HIERARCHY[admin.role] >= ROLE_HIERARCHY[required]
  },
}))
