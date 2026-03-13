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
  const { login } = useAuth()
  const { users, refresh } = useData()
  const { addToast } = useToast()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [secret, setSecret] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const trimName = name.trim()
    const trimSecret = secret.trim().toLowerCase()
    const trimEmail = email.trim()

    if (!trimName || !trimSecret) {
      setError('Name and secret word are required')
      return
    }

    if (trimSecret.includes(' ')) {
      setError('Secret word must be one word, no spaces')
      return
    }

    // Check if secret already taken
    if (users.some(u => u.code === trimSecret)) {
      setError('That secret word is already taken — pick another')
      return
    }

    setSaving(true)
    try {
      await createUser({ name: trimName, code: trimSecret, email: trimEmail })
      await refresh()
      login(trimSecret)
      addToast(`Welcome, ${trimName}!`, 'success')
      onRegistered()
    } catch {
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
          Pick a name and a secret word. You'll use the secret word to log back in on any device.
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.field}>
            <span className={styles.label}>Display Name</span>
            <input
              className={styles.input}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="How your name shows on the board"
              autoFocus
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Email <span className={styles.optional}>(optional)</span></span>
            <input
              className={styles.input}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="For payout notifications"
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Secret Word</span>
            <input
              className={styles.input}
              value={secret}
              onChange={e => setSecret(e.target.value.replace(/\s/g, ''))}
              placeholder="One word — your personal login"
            />
            <span className={styles.hint}>
              This is your password. Pick something easy to remember. One word, no spaces.
            </span>
          </label>

          {error && <div className={styles.error}>{error}</div>}

          <button className={styles.submit} type="submit" disabled={saving || !name.trim() || !secret.trim()}>
            {saving ? 'Joining...' : 'Join'}
          </button>
        </form>
      </div>
    </div>
  )
}
