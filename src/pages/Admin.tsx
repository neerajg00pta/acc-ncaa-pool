import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { saveUsers, updateConfig } from '../lib/github-data-service'
import type { User } from '../lib/types'
import styles from './Admin.module.css'

export function AdminPage() {
  const { isAdmin } = useAuth()
  const { config, users, refresh } = useData()
  const { addToast } = useToast()
  const [saving, setSaving] = useState(false)

  if (!isAdmin) {
    return <div className={styles.forbidden}>Admin access required.</div>
  }

  const paidCount = users.filter(u => u.paid).length
  const totalCollected = paidCount * 100

  // === Board Controls ===

  const toggleLock = async () => {
    setSaving(true)
    try {
      await updateConfig(c => ({ ...c, boardLocked: !c.boardLocked }))
      await refresh()
      addToast(config.boardLocked ? 'Board unlocked' : 'Board locked', 'success')
    } catch { addToast('Failed to update', 'error') }
    finally { setSaving(false) }
  }

  const randomizeNumbers = async () => {
    if (!confirm('Randomize row and column numbers? This replaces any current assignment.')) return
    setSaving(true)
    try {
      const shuffle = (arr: number[]) => {
        const a = [...arr]
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[a[i], a[j]] = [a[j], a[i]]
        }
        return a
      }
      const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
      await updateConfig(c => ({
        ...c,
        rowNumbers: shuffle(digits),
        colNumbers: shuffle(digits),
      }))
      await refresh()
      addToast('Numbers randomized!', 'success')
    } catch { addToast('Failed to randomize', 'error') }
    finally { setSaving(false) }
  }

  const updateMaxSquares = async (val: number) => {
    setSaving(true)
    try {
      await updateConfig(c => ({ ...c, maxSquaresPerPerson: val }))
      await refresh()
      addToast(`Max squares set to ${val}`, 'success')
    } catch { addToast('Failed to update', 'error') }
    finally { setSaving(false) }
  }

  // === User Management ===

  const addUser = async () => {
    const name = prompt('Player name:')
    if (!name) return
    const code = prompt('Access code:')
    if (!code) return
    const isAdminUser = confirm('Grant admin privileges?')

    setSaving(true)
    try {
      await saveUsers(prev => [
        ...prev,
        {
          id: `u${Date.now()}`,
          name,
          code,
          admin: isAdminUser,
          paid: false,
          createdAt: new Date().toISOString(),
        },
      ])
      await refresh()
      addToast(`Added ${name}`, 'success')
    } catch { addToast('Failed to add user', 'error') }
    finally { setSaving(false) }
  }

  const deleteUser = async (user: User) => {
    if (!confirm(`Delete ${user.name}?`)) return
    setSaving(true)
    try {
      await saveUsers(prev => prev.filter(u => u.id !== user.id))
      await refresh()
      addToast(`Deleted ${user.name}`, 'success')
    } catch { addToast('Failed to delete', 'error') }
    finally { setSaving(false) }
  }

  const togglePaid = async (user: User) => {
    setSaving(true)
    try {
      await saveUsers(prev =>
        prev.map(u => u.id === user.id ? { ...u, paid: !u.paid } : u)
      )
      await refresh()
    } catch { addToast('Failed to update', 'error') }
    finally { setSaving(false) }
  }

  const toggleAdmin = async (user: User) => {
    setSaving(true)
    try {
      await saveUsers(prev =>
        prev.map(u => u.id === user.id ? { ...u, admin: !u.admin } : u)
      )
      await refresh()
    } catch { addToast('Failed to update', 'error') }
    finally { setSaving(false) }
  }

  const editUser = async (user: User, field: 'name' | 'code') => {
    const current = field === 'name' ? user.name : user.code
    const newVal = prompt(`New ${field}:`, current)
    if (!newVal || newVal === current) return
    setSaving(true)
    try {
      await saveUsers(prev =>
        prev.map(u => u.id === user.id ? { ...u, [field]: newVal } : u)
      )
      await refresh()
      addToast('Updated', 'success')
    } catch { addToast('Failed to update', 'error') }
    finally { setSaving(false) }
  }

  return (
    <div className={styles.admin}>
      <h1 className={styles.pageTitle}>Admin Panel</h1>

      {/* Board Controls */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Board Controls</h2>
        <div className={styles.controls}>
          <button
            className={`${styles.btn} ${config.boardLocked ? styles.btnDanger : styles.btnPrimary}`}
            onClick={toggleLock}
            disabled={saving}
          >
            {config.boardLocked ? '🔒 Unlock Board' : '🔓 Lock Board'}
          </button>

          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={randomizeNumbers}
            disabled={saving}
          >
            🎲 Randomize Numbers
          </button>

          <div className={styles.inlineControl}>
            <label className={styles.label}>Max squares per person:</label>
            <input
              type="number"
              min={1}
              max={100}
              value={config.maxSquaresPerPerson}
              onChange={e => updateMaxSquares(Number(e.target.value))}
              className={styles.numInput}
              disabled={saving}
            />
          </div>
        </div>

        {config.rowNumbers && (
          <div className={styles.numberDisplay}>
            <span className={styles.numberLabel}>Rows:</span>
            <span className={styles.numbers}>{config.rowNumbers.join(' ')}</span>
            <span className={styles.numberLabel}>Cols:</span>
            <span className={styles.numbers}>{config.colNumbers?.join(' ')}</span>
          </div>
        )}
      </section>

      {/* User Management */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            Players
            <span className={styles.badge}>{users.length}</span>
          </h2>
          <span className={styles.paidSummary}>
            {paidCount}/{users.length} paid · ${totalCollected.toLocaleString()} collected
          </span>
          <button className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`} onClick={addUser} disabled={saving}>
            + Add Player
          </button>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Admin</th>
                <th>Paid</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td>
                    <button className={styles.cellBtn} onClick={() => editUser(user, 'name')}>
                      {user.name}
                    </button>
                  </td>
                  <td>
                    <button className={styles.cellBtn} onClick={() => editUser(user, 'code')}>
                      <code className={styles.code}>{user.code}</code>
                    </button>
                  </td>
                  <td>
                    <button
                      className={`${styles.toggle} ${user.admin ? styles.toggleOn : ''}`}
                      onClick={() => toggleAdmin(user)}
                      disabled={saving}
                    >
                      {user.admin ? '✓' : '—'}
                    </button>
                  </td>
                  <td>
                    <button
                      className={`${styles.toggle} ${user.paid ? styles.toggleOn : ''}`}
                      onClick={() => togglePaid(user)}
                      disabled={saving}
                    >
                      {user.paid ? '✓' : '—'}
                    </button>
                  </td>
                  <td>
                    <button
                      className={styles.deleteBtn}
                      onClick={() => deleteUser(user)}
                      disabled={saving}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
