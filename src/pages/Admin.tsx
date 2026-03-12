import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { saveUsers, updateConfig } from '../lib/github-data-service'
import type { User } from '../lib/types'
import styles from './Admin.module.css'

const BASE_URL = `${window.location.origin}${window.location.pathname}`

export function AdminPage() {
  const { isAdmin } = useAuth()
  const { config, users, refresh } = useData()
  const { addToast } = useToast()
  const [saving, setSaving] = useState(false)

  // New player inline row state
  const [newName, setNewName] = useState('')
  const [newCode, setNewCode] = useState('')
  const [showNewRow, setShowNewRow] = useState(false)

  // Inline editing state
  const [editingCell, setEditingCell] = useState<{ userId: string; field: 'name' | 'code' } | null>(null)
  const [editValue, setEditValue] = useState('')
  // Delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  if (!isAdmin) {
    return <div className={styles.forbidden}>Admin access required.</div>
  }

  const paidCount = users.filter(u => u.paid).length
  const totalCollected = paidCount * 100

  // === Board Controls ===

  const toggleLock = async () => {
    const willLock = !config.boardLocked
    setSaving(true)
    try {
      await updateConfig(c => ({ ...c, boardLocked: willLock }))
      await refresh()
      addToast(willLock ? 'Board locked' : 'Board unlocked', 'success')
    } catch { addToast('Failed to update', 'error') }
    finally { setSaving(false) }
  }

  const randomizeNumbers = async () => {
    if (config.boardLocked) {
      addToast('Unlock the board first', 'error')
      return
    }
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

  const clearNumbers = async () => {
    if (config.boardLocked) {
      addToast('Unlock the board first', 'error')
      return
    }
    setSaving(true)
    try {
      await updateConfig(c => ({ ...c, rowNumbers: null, colNumbers: null }))
      await refresh()
      addToast('Numbers cleared', 'success')
    } catch { addToast('Failed to clear', 'error') }
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
    const name = newName.trim()
    const code = newCode.trim()
    if (!name || !code) {
      addToast('Name and code are required', 'error')
      return
    }

    setSaving(true)
    try {
      await saveUsers(prev => [
        ...prev,
        {
          id: `u${Date.now()}`,
          name,
          code,
          admin: false,
          paid: false,
          createdAt: new Date().toISOString(),
        },
      ])
      await refresh()
      setNewName('')
      setNewCode('')
      setShowNewRow(false)
      addToast(`Added ${name}`, 'success')
    } catch { addToast('Failed to add user', 'error') }
    finally { setSaving(false) }
  }

  const deleteUser = async (user: User) => {
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

  const startEdit = (userId: string, field: 'name' | 'code', currentValue: string) => {
    setEditingCell({ userId, field })
    setEditValue(currentValue)
  }

  const commitEdit = async () => {
    if (!editingCell) return
    const { userId, field } = editingCell
    const val = editValue.trim()
    if (!val) { setEditingCell(null); return }
    setSaving(true)
    try {
      await saveUsers(prev =>
        prev.map(u => u.id === userId ? { ...u, [field]: val } : u)
      )
      await refresh()
      setEditingCell(null)
    } catch { addToast('Failed to update', 'error') }
    finally { setSaving(false) }
  }

  const inviteLink = (code: string) => `${BASE_URL}#/?token=${code}`

  const copyLink = (code: string) => {
    navigator.clipboard.writeText(inviteLink(code))
    addToast('Link copied!', 'success')
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
            disabled={saving || config.boardLocked}
          >
            🎲 Randomize Numbers
          </button>

          {config.rowNumbers && (
            <button
              className={styles.btn}
              onClick={clearNumbers}
              disabled={saving || config.boardLocked}
            >
              ✕ Clear Numbers
            </button>
          )}

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
          <button
            className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}
            onClick={() => setShowNewRow(true)}
            disabled={saving || showNewRow}
          >
            + Add Player
          </button>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Invite Link</th>
                <th>Admin</th>
                <th>Paid</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {showNewRow && (
                <tr className={styles.newRow}>
                  <td>
                    <input
                      className={styles.inlineInput}
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      placeholder="Player name"
                      autoFocus
                      onKeyDown={e => e.key === 'Enter' && addUser()}
                    />
                  </td>
                  <td>
                    <input
                      className={styles.inlineInput}
                      value={newCode}
                      onChange={e => setNewCode(e.target.value)}
                      placeholder="Access code"
                      onKeyDown={e => e.key === 'Enter' && addUser()}
                    />
                  </td>
                  <td className={styles.linkPreview}>
                    {newCode ? <span className={styles.linkText}>...?token={newCode}</span> : '—'}
                  </td>
                  <td></td>
                  <td></td>
                  <td>
                    <div className={styles.newRowActions}>
                      <button
                        className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}
                        onClick={addUser}
                        disabled={saving || !newName.trim() || !newCode.trim()}
                      >
                        Save
                      </button>
                      <button
                        className={`${styles.btn} ${styles.btnSm}`}
                        onClick={() => { setShowNewRow(false); setNewName(''); setNewCode('') }}
                      >
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              )}
              {users.map(user => (
                <tr key={user.id}>
                  <td>
                    {editingCell?.userId === user.id && editingCell.field === 'name' ? (
                      <input
                        className={styles.inlineInput}
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingCell(null) }}
                        onBlur={commitEdit}
                        autoFocus
                      />
                    ) : (
                      <button className={styles.cellBtn} onClick={() => startEdit(user.id, 'name', user.name)}>
                        {user.name}
                      </button>
                    )}
                  </td>
                  <td>
                    {editingCell?.userId === user.id && editingCell.field === 'code' ? (
                      <input
                        className={styles.inlineInput}
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingCell(null) }}
                        onBlur={commitEdit}
                        autoFocus
                      />
                    ) : (
                      <button className={styles.cellBtn} onClick={() => startEdit(user.id, 'code', user.code)}>
                        <code className={styles.code}>{user.code}</code>
                      </button>
                    )}
                  </td>
                  <td>
                    <button className={styles.copyLinkBtn} onClick={() => copyLink(user.code)}>
                      Copy link
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
                    {confirmDeleteId === user.id ? (
                      <div className={styles.newRowActions}>
                        <button className={`${styles.btn} ${styles.btnDanger} ${styles.btnSm}`} onClick={() => { deleteUser(user); setConfirmDeleteId(null) }}>Delete</button>
                        <button className={`${styles.btn} ${styles.btnSm}`} onClick={() => setConfirmDeleteId(null)}>No</button>
                      </div>
                    ) : (
                      <button
                        className={styles.deleteBtn}
                        onClick={() => setConfirmDeleteId(user.id)}
                        disabled={saving}
                      >
                        ✕
                      </button>
                    )}
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
