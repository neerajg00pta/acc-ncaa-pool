import { useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { saveGames } from '../lib/github-data-service'
import {
  type Game,
  getGameStatus, ROUND_LABELS, ROUND_PAYOUTS, ROUNDS_IN_ORDER,
  generateInitialGames,
} from '../lib/types'
import styles from './AdminGames.module.css'

export function AdminGamesPage() {
  const { isAdmin } = useAuth()
  const { games, refresh } = useData()
  const { addToast } = useToast()
  const [saving, setSaving] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  if (!isAdmin) {
    return <div className={styles.forbidden}>Admin access required.</div>
  }

  // Initialize 63 games if empty
  const initGames = async () => {
    setSaving(true)
    try {
      await saveGames(() => generateInitialGames())
      await refresh()
      addToast('63 games created!', 'success')
    } catch { addToast('Failed to initialize games', 'error') }
    finally { setSaving(false) }
  }

  // Debounced save — waits 800ms after last edit
  const debouncedSave = (updater: (games: Game[]) => Game[]) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSaving(true)
      try {
        await saveGames(updater)
        await refresh()
      } catch {
        addToast('Save failed — will retry', 'error')
      } finally {
        setSaving(false)
      }
    }, 800)
  }

  const updateGame = (gameId: number, field: keyof Game, value: string) => {
    debouncedSave(prev =>
      prev.map(g => {
        if (g.id !== gameId) return g
        if (field === 'teamA' || field === 'teamB') {
          return { ...g, [field]: value }
        }
        if (field === 'scoreA' || field === 'scoreB') {
          const num = value === '' ? null : Number(value)
          return { ...g, [field]: num }
        }
        return g
      })
    )
  }

  if (games.length === 0) {
    return (
      <div className={styles.emptyState}>
        <h1>Game Management</h1>
        <p>No games yet. Initialize all 63 tournament games?</p>
        <button className={styles.initBtn} onClick={initGames} disabled={saving}>
          🏀 Create 63 Games
        </button>
      </div>
    )
  }

  // Group games by round
  const gamesByRound = ROUNDS_IN_ORDER.map(round => ({
    round,
    games: games.filter(g => g.round === round),
  }))

  // Stats
  const finalCount = games.filter(g => getGameStatus(g) === 'final').length
  const activeCount = games.filter(g => getGameStatus(g) === 'active').length

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Games</h1>
        <div className={styles.stats}>
          <span className={styles.statFinal}>{finalCount} final</span>
          <span className={styles.statActive}>{activeCount} active</span>
          <span className={styles.statScheduled}>{63 - finalCount - activeCount} scheduled</span>
        </div>
        {saving && <span className={styles.savingBadge}>Saving...</span>}
      </div>

      {gamesByRound.map(({ round, games: roundGames }) => (
        <section key={round} className={styles.roundSection}>
          <div className={styles.roundHeader}>
            <h2 className={styles.roundTitle}>{ROUND_LABELS[round]}</h2>
            <span className={styles.roundPayout}>${ROUND_PAYOUTS[round]}/game</span>
            <span className={styles.roundCount}>{roundGames.length} games</span>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.thNum}>#</th>
                  <th>Team A</th>
                  <th className={styles.thScore}>Score</th>
                  <th>Team B</th>
                  <th className={styles.thScore}>Score</th>
                  <th className={styles.thStatus}>Status</th>
                </tr>
              </thead>
              <tbody>
                {roundGames.map(game => (
                  <GameRow
                    key={game.id}
                    game={game}
                    onUpdate={updateGame}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  )
}

function GameRow({
  game,
  onUpdate,
}: {
  game: Game
  onUpdate: (id: number, field: keyof Game, value: string) => void
}) {
  const status = getGameStatus(game)

  return (
    <tr className={`${styles.row} ${styles[`row_${status}`]}`}>
      <td className={styles.gameNum}>{game.id}</td>
      <td>
        <input
          className={styles.teamInput}
          value={game.teamA}
          onChange={e => onUpdate(game.id, 'teamA', e.target.value)}
          placeholder="Team A"
        />
      </td>
      <td>
        <input
          className={styles.scoreInput}
          type="number"
          min={0}
          value={game.scoreA ?? ''}
          onChange={e => onUpdate(game.id, 'scoreA', e.target.value)}
          placeholder="—"
        />
      </td>
      <td>
        <input
          className={styles.teamInput}
          value={game.teamB}
          onChange={e => onUpdate(game.id, 'teamB', e.target.value)}
          placeholder="Team B"
        />
      </td>
      <td>
        <input
          className={styles.scoreInput}
          type="number"
          min={0}
          value={game.scoreB ?? ''}
          onChange={e => onUpdate(game.id, 'scoreB', e.target.value)}
          placeholder="—"
        />
      </td>
      <td>
        <span className={`${styles.statusBadge} ${styles[`status_${status}`]}`}>
          {status}
        </span>
      </td>
    </tr>
  )
}
