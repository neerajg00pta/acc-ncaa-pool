import { useMemo, useState } from 'react'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import {
  type LeaderboardEntry, type Payout,
  getGameStatus, gameToSquare,
  ROUND_PAYOUTS, ROUND_LABELS,
} from '../lib/types'
import styles from './Leaderboard.module.css'

export function Leaderboard({ searchQuery }: { searchQuery: string }) {
  const { config, users, squares, games } = useData()
  const { currentUser } = useAuth()

  const entries = useMemo(() => {
    const { rowNumbers, colNumbers } = config
    if (!rowNumbers || !colNumbers) {
      // No numbers assigned — show all users with $0
      return users.map(u => ({
        userId: u.id,
        userName: u.name,
        totalWinnings: 0,
        payouts: [],
      }))
    }

    // Compute all payouts
    const payouts: Payout[] = []
    const squareOwnerMap = new Map<string, string>()
    squares.forEach(s => squareOwnerMap.set(`${s.row}-${s.col}`, s.userId))

    games.forEach(game => {
      if (getGameStatus(game) !== 'final') return
      const pos = gameToSquare(game, rowNumbers, colNumbers)
      if (!pos) return
      const key = `${pos.row}-${pos.col}`
      const userId = squareOwnerMap.get(key)
      if (!userId) return // unclaimed square
      payouts.push({
        gameId: game.id,
        squareRow: pos.row,
        squareCol: pos.col,
        userId,
        amount: ROUND_PAYOUTS[game.round],
        round: game.round,
        teamA: game.teamA,
        teamB: game.teamB,
        scoreA: game.scoreA!,
        scoreB: game.scoreB!,
      })
    })

    // Aggregate by user
    const entryMap = new Map<string, LeaderboardEntry>()
    users.forEach(u => {
      entryMap.set(u.id, { userId: u.id, userName: u.name, totalWinnings: 0, payouts: [] })
    })
    payouts.forEach(p => {
      const entry = entryMap.get(p.userId)
      if (entry) {
        entry.totalWinnings += p.amount
        entry.payouts.push(p)
      }
    })

    // Sort: winnings desc, then alpha
    return [...entryMap.values()].sort((a, b) =>
      b.totalWinnings - a.totalWinnings || a.userName.localeCompare(b.userName)
    )
  }, [config, users, squares, games])

  // Pin current user to top
  const myEntry = currentUser ? entries.find(e => e.userId === currentUser.id) : null
  const myRank = myEntry ? entries.indexOf(myEntry) + 1 : null

  return (
    <div className={styles.leaderboard}>
      <h2 className={styles.title}>Leaderboard</h2>

      {myEntry && (
        <>
          <LeaderboardRow
            entry={myEntry}
            rank={myRank!}
            isMine
            config={config}
          />
          <div className={styles.pinnedGap} />
        </>
      )}

      <div className={styles.list}>
        {entries.map((entry, i) => {
          const searchLower = searchQuery.toLowerCase()
          if (searchLower && !entry.userName.toLowerCase().includes(searchLower)) return null
          return (
            <LeaderboardRow
              key={entry.userId}
              entry={entry}
              rank={i + 1}
              isMine={entry.userId === currentUser?.id}
              config={config}
            />
          )
        })}
      </div>
    </div>
  )
}

function LeaderboardRow({
  entry,
  rank,
  isMine,
  config,
}: {
  entry: LeaderboardEntry
  rank: number
  isMine: boolean
  config: { rowNumbers: number[] | null; colNumbers: number[] | null }
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={`${styles.row} ${isMine ? styles.rowMine : ''}`}>
      <button
        className={styles.rowHeader}
        onClick={() => setExpanded(!expanded)}
      >
        <span className={styles.rank}>#{rank}</span>
        <span className={styles.name}>{entry.userName}</span>
        <span className={styles.winnings}>
          ${entry.totalWinnings.toLocaleString()}
        </span>
        <span className={`${styles.chevron} ${expanded ? styles.chevronOpen : ''}`}>
          ▸
          </span>
      </button>

      {expanded && (
        <div className={styles.breakdown}>
          {entry.payouts.length > 0 ? entry.payouts.map(p => (
            <div key={p.gameId} className={styles.payoutRow}>
              <span className={styles.payoutSquare}>
                [{config.colNumbers?.[p.squareCol]},{config.rowNumbers?.[p.squareRow]}]
              </span>
              <span className={styles.payoutGame}>
                {p.teamA} {p.scoreA}-{p.scoreB} {p.teamB}
              </span>
              <span className={styles.payoutRound}>{ROUND_LABELS[p.round]}</span>
              <span className={styles.payoutAmount}>${p.amount}</span>
            </div>
          )) : (
            <div className={styles.noWins}>No wins yet</div>
          )}
        </div>
      )}
    </div>
  )
}
