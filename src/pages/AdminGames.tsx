import { useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { saveGames } from '../lib/github-data-service'
import {
  type Game,
  getGameStatus, getGameWinner, gameToSquare,
  ROUND_LABELS, ROUND_PAYOUTS, ROUNDS_IN_ORDER,
  generateInitialGames,
} from '../lib/types'
import styles from './AdminGames.module.css'

export function AdminGamesPage() {
  const { isAdmin } = useAuth()
  const { config, games, squares, users, refresh } = useData()
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

  // Build square owner + user name lookups for winner display
  const squareOwnerMap = new Map<string, string>()
  squares.forEach(s => squareOwnerMap.set(`${s.row}-${s.col}`, s.userId))
  const userNameMap = new Map<string, string>()
  users.forEach(u => userNameMap.set(u.id, u.fullName || u.name))

  const getGameInfo = (game: Game) => {
    if (getGameStatus(game) !== 'final' || !config.rowNumbers || !config.colNumbers) return null
    const pos = gameToSquare(game, config.rowNumbers, config.colNumbers)
    if (!pos) return null
    const squareLabel = `${config.colNumbers[pos.col]}${config.rowNumbers[pos.row]}`
    const uid = squareOwnerMap.get(`${pos.row}-${pos.col}`)
    const ownerName = uid ? (userNameMap.get(uid) || '???') : 'Unclaimed'
    return { squareLabel, ownerName }
  }

  // Stats
  const finalCount = games.filter(g => getGameStatus(g) === 'final').length
  const activeCount = games.filter(g => getGameStatus(g) === 'active').length

  const downloadCsv = () => {
    const header = 'Round,Game,Winning Team,Winning Score,Losing Team,Losing Score,Winning Square,Amount,Square Owner'
    const csvRows = games
      .filter(g => getGameStatus(g) === 'final')
      .map(g => {
        const winner = getGameWinner(g)
        const winTeam = winner === 'A' ? g.teamA : g.teamB
        const winScore = winner === 'A' ? g.scoreA : g.scoreB
        const loseTeam = winner === 'A' ? g.teamB : g.teamA
        const loseScore = winner === 'A' ? g.scoreB : g.scoreA
        const info = getGameInfo(g)
        return `"${ROUND_LABELS[g.round]}",${g.id},"${winTeam}",${winScore},"${loseTeam}",${loseScore},"${info?.squareLabel || ''}","$${ROUND_PAYOUTS[g.round]}","${info?.ownerName || ''}"`
      })
    const csv = [header, ...csvRows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'march-madness-winnings.csv'
    a.click()
    URL.revokeObjectURL(url)
    addToast('CSV downloaded', 'success')
  }

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
        {finalCount > 0 && (
          <button className={styles.csvBtn} onClick={downloadCsv}>Download CSV</button>
        )}
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
                  <th className={styles.thTeam}>Team A</th>
                  <th className={styles.thScore}>Score</th>
                  <th className={styles.thTeam}>Team B</th>
                  <th className={styles.thScore}>Score</th>
                  <th className={styles.thStatus}>Status</th>
                  <th className={styles.thSquare}>Square</th>
                  <th className={styles.thPayout}>Payout</th>
                  <th className={styles.thOwner}>Owner</th>
                </tr>
              </thead>
              <tbody>
                {roundGames.map(game => {
                  const info = getGameInfo(game)
                  return (
                    <GameRow
                      key={game.id}
                      game={game}
                      onUpdate={updateGame}
                      squareLabel={info?.squareLabel || null}
                      ownerName={info?.ownerName || null}
                      payout={getGameStatus(game) === 'final' ? ROUND_PAYOUTS[game.round] : null}
                    />
                  )
                })}
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
  squareLabel,
  ownerName,
  payout,
}: {
  game: Game
  onUpdate: (id: number, field: keyof Game, value: string) => void
  squareLabel: string | null
  ownerName: string | null
  payout: number | null
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
      <td className={styles.squareCell}>{squareLabel || '—'}</td>
      <td className={styles.payoutCell}>{payout ? `$${payout.toLocaleString()}` : '—'}</td>
      <td className={`${styles.ownerCell} ${ownerName === '(unclaimed)' ? styles.unclaimed : ''}`}>
        {ownerName || '—'}
      </td>
    </tr>
  )
}
