import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { createUser } from '../lib/github-data-service'
import styles from './RegisterModal.module.css'

interface Props {
  onClose: () => void
  onRegistered: () => void
}

export function RegisterModal({ onClose, onRegistered }: Props) {
  const { loginDirect } = useAuth()
  const { users, refresh } = useData()
  const { addToast } = useToast()
  const [fullName, setFullName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const trimFull = fullName.trim()
    const trimDisplay = displayName.trim()
    const trimEmail = email.trim().toLowerCase()

    if (!trimFull || !trimDisplay || !trimEmail) {
      setError('All fields are required')
      return
    }

    if (trimDisplay.length > 8) {
      setError('Display name must be 8 characters or less')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimEmail)) {
      setError('Please enter a valid email')
      return
    }

    if (users.some(u => u.email?.toLowerCase() === trimEmail)) {
      setError('That email is already registered — use Sign In')
      return
    }
    if (users.some(u => u.name.toLowerCase() === trimDisplay.toLowerCase())) {
      setError('That display name is taken — pick another')
      return
    }
    if (users.some(u => u.fullName?.toLowerCase() === trimFull.toLowerCase())) {
      setError('That name is already registered — use Sign In')
      return
    }

    setSaving(true)
    try {
      const newUser = await createUser({ name: trimDisplay, email: trimEmail, fullName: trimFull })
      loginDirect(newUser)
      refresh()
      addToast(`Welcome, ${trimDisplay}!`, 'success')
      onRegistered()
    } catch (err) {
      console.error('Registration error:', err)
      setError('Something went wrong — try again')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.card} onClick={e => e.stopPropagation()}>
        <h2 className={styles.title}>Join the Pool</h2>
        <p className={styles.subtitle}>
          Sign up to claim squares. You'll use your email to log back in.
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.field}>
            <span className={styles.label}>Full Name</span>
            <input
              className={styles.input}
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="First and last name"
              autoFocus
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Display Name <span className={styles.optional}>(max 8 chars, shown on board)</span></span>
            <input
              className={styles.input}
              value={displayName}
              onChange={e => setDisplayName(e.target.value.slice(0, 8))}
              placeholder="e.g. Marc"
              maxLength={8}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Email</span>
            <input
              className={styles.input}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Your email — this is how you log in"
            />
          </label>

          {error && <div className={styles.error}>{error}</div>}

          <button className={styles.submit} type="submit" disabled={saving || !fullName.trim() || !displayName.trim() || !email.trim()}>
            {saving ? 'Joining...' : 'Join'}
          </button>
        </form>
      </div>
    </div>
  )
}
