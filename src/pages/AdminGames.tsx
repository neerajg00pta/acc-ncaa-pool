import { useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { saveGames, updateConfig } from '../lib/github-data-service'
import {
  type Game,
  getGameStatus, getGameWinner, gameToSquare,
  ROUND_LABELS, ROUND_PAYOUTS, ROUNDS_IN_ORDER,
  generateInitialGames,
} from '../lib/types'
import { useLiveScoringState } from '../context/LiveScoringContext'
import type { MatchResult } from '../lib/espn'
import styles from './AdminGames.module.css'

export function AdminGamesPage() {
  const { isAdmin } = useAuth()
  const { config, games, squares, users, refresh } = useData()
  const { addToast } = useToast()
  const [saving, setSaving] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  // Live scoring state from app-wide context
  const liveScoring = useLiveScoringState()

  // Build match lookup: poolGameId → MatchResult
  const matchMap = new Map<number, MatchResult>()
  liveScoring.matches.forEach(m => matchMap.set(m.poolGameId, m))

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
          // Auto-lock when manually editing scores while live scoring is on
          const autoLock = config.liveScoring ? true : g.scoreLocked
          return { ...g, [field]: num, scoreLocked: autoLock }
        }
        return g
      })
    )
  }

  const toggleGameLock = (gameId: number) => {
    debouncedSave(prev =>
      prev.map(g => g.id === gameId ? { ...g, scoreLocked: !g.scoreLocked } : g)
    )
  }

  const toggleLiveScoring = async () => {
    const willEnable = !config.liveScoring
    setSaving(true)
    try {
      await updateConfig(c => ({ ...c, liveScoring: willEnable }))
      await refresh()
      addToast(willEnable ? 'Live scoring enabled' : 'Live scoring disabled', 'success')
    } catch { addToast('Failed to toggle live scoring', 'error') }
    finally { setSaving(false) }
  }

  if (games.length === 0) {
    return (
      <div className={styles.emptyState}>
        <h1>Game Management</h1>
        <p>No games yet. Initialize all 63 tournament games?</p>
        <button className={styles.initBtn} onClick={initGames} disabled={saving}>
          Create 63 Games
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
    if (getGameStatus(game) === 'scheduled' || !config.rowNumbers || !config.colNumbers) return null
    const pos = gameToSquare(game, config.rowNumbers, config.colNumbers)
    if (!pos) return null
    const squareLabel = `${config.colNumbers[pos.col]}${config.rowNumbers[pos.row]}`
    const uid = squareOwnerMap.get(`${pos.row}-${pos.col}`)
    const ownerName = uid ? (userNameMap.get(uid) || '???') : 'Unclaimed'
    return { squareLabel, ownerName }
  }

  // Stats
  const finalCount = games.filter(g => getGameStatus(g) === 'final').length
  const liveCount = games.filter(g => getGameStatus(g) === 'live').length

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
          <span className={styles.statLive}>{liveCount} live</span>
          <span className={styles.statScheduled}>{63 - finalCount - liveCount} scheduled</span>
        </div>
        {saving && <span className={styles.savingBadge}>Saving...</span>}

        {/* Live Scoring Toggle */}
        <button
          className={`${styles.liveToggle} ${config.liveScoring ? styles.liveToggleOn : ''}`}
          onClick={toggleLiveScoring}
          disabled={saving}
        >
          {config.liveScoring && <span className={styles.liveDot} />}
          {config.liveScoring ? 'Live Scoring ON' : 'Live Scoring OFF'}
        </button>

        {config.liveScoring && liveScoring.lastPoll && (
          <span className={styles.lastPoll}>
            Last poll: {liveScoring.lastPoll.toLocaleTimeString()}
            {liveScoring.error && <span className={styles.pollError}> ({liveScoring.error})</span>}
          </span>
        )}

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
                  {config.liveScoring && <th className={styles.thEspn}>ESPN</th>}
                  <th className={styles.thSquare}>Square</th>
                  <th className={styles.thPayout}>Payout</th>
                  <th className={styles.thOwner}>Owner</th>
                </tr>
              </thead>
              <tbody>
                {roundGames.map(game => {
                  const info = getGameInfo(game)
                  const match = matchMap.get(game.id)
                  return (
                    <GameRow
                      key={game.id}
                      game={game}
                      onUpdate={updateGame}
                      onToggleLock={toggleGameLock}
                      squareLabel={info?.squareLabel || null}
                      ownerName={info?.ownerName || null}
                      payout={getGameStatus(game) !== 'scheduled' ? ROUND_PAYOUTS[game.round] : null}
                      liveEnabled={config.liveScoring}
                      espnMatch={match || null}
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
  onToggleLock,
  squareLabel,
  ownerName,
  payout,
  liveEnabled,
  espnMatch,
}: {
  game: Game
  onUpdate: (id: number, field: keyof Game, value: string) => void
  onToggleLock: (id: number) => void
  squareLabel: string | null
  ownerName: string | null
  payout: number | null
  liveEnabled: boolean
  espnMatch: MatchResult | null
}) {
  const status = getGameStatus(game)

  return (
    <tr className={`${styles.row} ${styles[`row_${status}`]}`}>
      <td className={styles.gameNum}>
        {liveEnabled && (
          game.scoreLocked
            ? <span className={styles.lockIcon} title="Score locked — click to unlock" onClick={() => onToggleLock(game.id)}>&#x1F512;</span>
            : <span className={styles.unlockIcon} title="Click to lock score" onClick={() => onToggleLock(game.id)}>&#x1F513;</span>
        )}
        {game.id}
      </td>
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
          className={`${styles.scoreInput} ${game.scoreLocked ? styles.lockedInput : ''}`}
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
          className={`${styles.scoreInput} ${game.scoreLocked ? styles.lockedInput : ''}`}
          type="number"
          min={0}
          value={game.scoreB ?? ''}
          onChange={e => onUpdate(game.id, 'scoreB', e.target.value)}
          placeholder="—"
        />
      </td>
      <td>
        <span className={`${styles.statusBadge} ${styles[`status_${status}`]}`}>
          {status === 'live' ? 'LIVE' : status}
        </span>
      </td>
      {liveEnabled && (
        <td className={styles.espnCell}>
          {espnMatch ? (
            espnMatch.espnGame.status === 'live' ? (
              <span className={styles.espnLive} title={espnMatch.espnGame.detail}>
                &#x1F7E2;
              </span>
            ) : espnMatch.espnGame.status === 'final' ? (
              <span className={styles.espnFinal} title={`Final — ${espnMatch.espnGame.detail}`}>
                &#x26AA;
              </span>
            ) : (
              <span className={styles.espnPre} title={`Linked — ${espnMatch.espnGame.detail}`}>
                &#x1F7E1;
              </span>
            )
          ) : (game.teamA || game.teamB) ? (
            <span className={styles.espnUnmatched} title="No ESPN match found">
              &#x1F534;
            </span>
          ) : (
            <span className={styles.espnNone}>—</span>
          )}
        </td>
      )}
      <td className={styles.squareCell}>{squareLabel || '—'}</td>
      <td className={styles.payoutCell}>{payout ? `$${payout.toLocaleString()}` : '—'}</td>
      <td className={`${styles.ownerCell} ${ownerName === '(unclaimed)' ? styles.unclaimed : ''}`}>
        {ownerName || '—'}
      </td>
    </tr>
  )
}
