import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { User } from '../lib/types'
import { SESSION_COOKIE_NAME, SESSION_EXPIRY_DAYS } from '../lib/config'
import { useData } from './DataContext'

interface AuthState {
  currentUser: User | null
  login: (code: string) => boolean
  logout: () => void
  isAdmin: boolean
}

const AuthContext = createContext<AuthState | null>(null)

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires};path=/;SameSite=Lax`
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

function deleteCookie(name: string) {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Lax`
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { users } = useData()
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  const findUser = useCallback(
    (code: string) => users.find(u => u.code === code) || null,
    [users]
  )

  // Restore session from cookie
  useEffect(() => {
    const savedCode = getCookie(SESSION_COOKIE_NAME)
    if (savedCode && !currentUser) {
      const user = findUser(savedCode)
      if (user) setCurrentUser(user)
    }
  }, [users, currentUser, findUser])

  // Auto-login via URL param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search || window.location.hash.split('?')[1] || '')
    const token = params.get('token')
    if (token && !currentUser) {
      const user = findUser(token)
      if (user) {
        setCurrentUser(user)
        setCookie(SESSION_COOKIE_NAME, token, SESSION_EXPIRY_DAYS)
        // Clean up URL
        const url = new URL(window.location.href)
        url.searchParams.delete('token')
        window.history.replaceState({}, '', url.toString())
      }
    }
  }, [users, currentUser, findUser])

  const login = useCallback(
    (code: string) => {
      const user = findUser(code)
      if (user) {
        setCurrentUser(user)
        setCookie(SESSION_COOKIE_NAME, code, SESSION_EXPIRY_DAYS)
        return true
      }
      return false
    },
    [findUser]
  )

  const logout = useCallback(() => {
    setCurrentUser(null)
    deleteCookie(SESSION_COOKIE_NAME)
  }, [])

  return (
    <AuthContext.Provider value={{ currentUser, login, logout, isAdmin: currentUser?.admin ?? false }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
