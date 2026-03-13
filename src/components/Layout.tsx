import { useState, useEffect, useRef, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import styles from './Layout.module.css'

export function Layout({ children }: { children: ReactNode }) {
  const { currentUser, login, logout, isAdmin, activateAdmin, deactivateAdmin } = useAuth()
  const { loading } = useData()
  const { addToast } = useToast()
  const [emailInput, setEmailInput] = useState('')
  const [loginError, setLoginError] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const location = useLocation()

  // Hidden admin activation: type "admin" anywhere on the page
  const keyBuffer = useRef('')
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      keyBuffer.current += e.key.toLowerCase()
      keyBuffer.current = keyBuffer.current.slice(-5)
      if (keyBuffer.current === 'admin') {
        keyBuffer.current = ''
        if (activateAdmin()) {
          addToast('Admin mode activated', 'success')
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activateAdmin, addToast])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = emailInput.trim().toLowerCase()
    if (!login(trimmed)) {
      setLoginError(true)
      setTimeout(() => setLoginError(false), 2000)
    } else {
      setShowLogin(false)
    }
    setEmailInput('')
  }

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <span>Loading pool data...</span>
      </div>
    )
  }

  return (
    <>
      <header className={styles.header}>
        <Link to="/" className={styles.brand}>
          <span className={styles.brandIcon}>🏀</span>
          <span className={styles.brandText}>March Madness Squares</span>
        </Link>

        <div className={styles.headerRight}>
          <Link
            to="/rules"
            className={`${styles.navLink} ${location.pathname === '/rules' ? styles.navLinkActive : ''}`}
          >
            Rules
          </Link>
          {currentUser ? (
            <>
              <span className={styles.userName}>{currentUser.name}</span>
              {isAdmin && (
                <nav className={styles.adminNav}>
                  <Link
                    to="/admin"
                    className={`${styles.navLink} ${location.pathname === '/admin' ? styles.navLinkActive : ''}`}
                  >
                    Admin
                  </Link>
                  <Link
                    to="/admin/games"
                    className={`${styles.navLink} ${location.pathname === '/admin/games' ? styles.navLinkActive : ''}`}
                  >
                    Games
                  </Link>
                  <button
                    className={styles.exitAdminBtn}
                    onClick={() => { deactivateAdmin(); addToast('Player mode', 'success') }}
                  >
                    Exit Admin
                  </button>
                </nav>
              )}
              <button onClick={logout} className={styles.logoutBtn}>
                Log out
              </button>
            </>
          ) : showLogin ? (
            <form onSubmit={handleLogin} className={styles.loginForm}>
              <input
                type="email"
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                placeholder="Your email"
                className={`${styles.codeInput} ${loginError ? styles.codeInputError : ''}`}
                autoFocus
              />
              <button type="submit" className={styles.goBtn}>Go</button>
              <button type="button" className={styles.cancelBtn} onClick={() => setShowLogin(false)}>✕</button>
            </form>
          ) : (
            <button className={styles.signInBtn} onClick={() => setShowLogin(true)}>
              Sign in
            </button>
          )}
        </div>
      </header>

      <main className={styles.main}>
        {children}
      </main>
    </>
  )
}
