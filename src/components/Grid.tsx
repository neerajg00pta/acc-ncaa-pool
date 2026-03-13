import { useState, useMemo, useCallback } from 'react'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { saveSquares } from '../lib/github-data-service'
import {
  type Game, type Square,
  getGameStatus, gameToSquare, ownerColor,
  ROUND_PAYOUTS, getGameWinner,
} from '../lib/types'
import styles from './Grid.module.css'

interface GridProps {
  searchQuery: string
}

export function Grid({ searchQuery }: GridProps) {
  const { config, users, squares, games, refresh } = useData()
  const { currentUser } = useAuth()
  const { addToast } = useToast()
  const [claiming, setClaiming] = useState<string | null>(null) // "row-col" being claimed
  const [flashCell, setFlashCell] = useState<string | null>(null)

  const { rowNumbers, colNumbers } = config

  // Build lookup maps
  const squareMap = useMemo(() => {
    const map = new Map<string, Square>()
    squares.forEach(s => map.set(`${s.row}-${s.col}`, s))
    return map
  }, [squares])

  const userMap = useMemo(() => {
    const map = new Map<string, string>()
    users.forEach(u => map.set(u.id, u.name))
    return map
  }, [users])

  // Compute game-to-square mappings and payouts
  const gameSquareMap = useMemo(() => {
    const map = new Map<string, { game: Game; payout: number }[]>()
    if (!rowNumbers || !colNumbers) return map
    games.forEach(game => {
      const status = getGameStatus(game)
      if (status === 'scheduled') return
      const pos = gameToSquare(game, rowNumbers, colNumbers)
      if (!pos) return
      const key = `${pos.row}-${pos.col}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push({
        game,
        payout: status === 'final' ? ROUND_PAYOUTS[game.round] : 0,
      })
    })
    return map
  }, [games, rowNumbers, colNumbers])

  // Compute heat map values (total payout per square)
  const payoutMap = useMemo(() => {
    const map = new Map<string, number>()
    let maxPayout = 0
    gameSquareMap.forEach((entries, key) => {
      const total = entries.reduce((sum, e) => sum + e.payout, 0)
      map.set(key, total)
      if (total > maxPayout) maxPayout = total
    })
    return { map, maxPayout }
  }, [gameSquareMap])

  // Count current user's squares
  const mySquareCount = useMemo(() => {
    if (!currentUser) return 0
    return squares.filter(s => s.userId === currentUser.id).length
  }, [squares, currentUser])

  const handleSquareClick = async (row: number, col: number) => {
    if (!currentUser) return
    const key = `${row}-${col}`
    const existing = squareMap.get(key)

    if (config.boardLocked) {
      addToast('Board is locked', 'error')
      return
    }

    // Click someone else's square — ignore
    if (existing && existing.userId !== currentUser.id) return

    setClaiming(key)
    setFlashCell(key)
    setTimeout(() => setFlashCell(null), 400)

    try {
      if (existing) {
        // Unclaim
        await saveSquares(prev => prev.filter(s => !(s.row === row && s.col === col)))
        addToast('Released!', 'success')
      } else {
        // Claim
        if (mySquareCount >= config.maxSquaresPerPerson) {
          addToast(`Max ${config.maxSquaresPerPerson} squares reached`, 'error')
          return
        }
        await saveSquares(prev => [
          ...prev,
          { row, col, userId: currentUser.id, claimedAt: new Date().toISOString() },
        ])
        addToast('Claimed!', 'success')
      }
      await refresh()
    } catch (err) {
      console.error('Square claim error:', err)
      addToast('Failed — try again', 'error')
    } finally {
      setClaiming(null)
    }
  }

  // Search filtering
  const searchLower = searchQuery.toLowerCase()
  const matchedUserIds = useMemo(() => {
    if (!searchLower) return null
    return new Set(users.filter(u => u.name.toLowerCase().includes(searchLower)).map(u => u.id))
  }, [searchLower, users])

  // Search: always dim (same behavior on mobile and desktop)

  // Hover crosshair
  const [hoverRow, setHoverRow] = useState<number | null>(null)
  const [hoverCol, setHoverCol] = useState<number | null>(null)
  const handleCellHover = useCallback((row: number, col: number) => {
    setHoverRow(row)
    setHoverCol(col)
  }, [])
  const clearHover = useCallback(() => {
    setHoverRow(null)
    setHoverCol(null)
  }, [])

  return (
    <div className={styles.gridWrapper}>
      {!rowNumbers && (
        <div className={styles.banner + ' ' + styles.bannerInfo}>Numbers not yet assigned</div>
      )}

      {/* Winner label spanning columns */}
      <div className={styles.axisLabelRow}>
        <div className={styles.axisLabelCorner}>
          {config.boardLocked && <span className={styles.lockIcon} title="Board is locked">🔒</span>}
        </div>
        <div className={styles.axisLabelWinner}>← WINNER →</div>
      </div>

      <div className={styles.gridWithLoser}>
        {/* Loser label spanning rows */}
        <div className={styles.axisLabelLoser}>
          <span>↑ LOSER ↓</span>
        </div>

        <div className={styles.gridScroll} onMouseLeave={clearHover}>
          <div className={styles.grid}>
            {/* Corner cell */}
            <div className={styles.cornerCell} />

            {/* Column headers (winner axis) */}
            {Array.from({ length: 10 }, (_, ci) => (
              <div key={`ch-${ci}`} className={`${styles.headerCell} ${styles.headerWinner} ${hoverCol === ci ? styles.headerHighlight : ''}`}>
                {colNumbers ? colNumbers[ci] : '?'}
              </div>
            ))}

            {/* Rows */}
            {Array.from({ length: 10 }, (_, ri) => (
              <>
                {/* Row header (loser axis) */}
                <div key={`rh-${ri}`} className={`${styles.headerCell} ${styles.headerLoser} ${hoverRow === ri ? styles.headerHighlight : ''}`}>
                  {rowNumbers ? rowNumbers[ri] : '?'}
                </div>

              {/* Square cells */}
              {Array.from({ length: 10 }, (_, ci) => {
                const key = `${ri}-${ci}`
                const sq = squareMap.get(key)
                const ownerName = sq ? (userMap.get(sq.userId) || '???') : null
                const isMine = sq?.userId === currentUser?.id
                const gameEntries = gameSquareMap.get(key)
                const totalPayout = payoutMap.map.get(key) || 0
                const heatLevel = payoutMap.maxPayout > 0 ? totalPayout / payoutMap.maxPayout : 0

                // Search visibility (dim non-matches on all devices)
                const matchesSearch = !matchedUserIds || (sq && matchedUserIds.has(sq.userId))
                const dimmed = matchedUserIds && !matchesSearch

                const onHoverRow = hoverRow === ri
                const onHoverCol = hoverCol === ci
                const crossClass = onHoverRow && onHoverCol
                  ? styles.cellCrosshairBoth
                  : onHoverRow ? styles.cellCrosshairRow
                  : onHoverCol ? styles.cellCrosshairCol
                  : ''

                return (
                  <div
                    key={key}
                    className={`
                      ${styles.cell}
                      ${sq ? styles.cellClaimed : styles.cellEmpty}
                      ${isMine ? styles.cellMine : ''}
                      ${dimmed ? styles.cellDimmed : ''}
                      ${matchesSearch && matchedUserIds ? styles.cellSearchMatch : ''}
                      ${flashCell === key ? styles.cellFlash : ''}
                      ${claiming === key ? styles.cellClaiming : ''}
                      ${crossClass}
                    `}
                    style={
                      sq && heatLevel > 0
                        ? { borderColor: `color-mix(in srgb, var(--heat-hot) ${Math.round(heatLevel * 100)}%, var(--heat-cold))` }
                        : sq
                          ? { borderColor: ownerColor(sq.userId) + '60' }
                          : undefined
                    }
                    onMouseEnter={() => handleCellHover(ri, ci)}
                    onClick={() => handleSquareClick(ri, ci)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Square ${rowNumbers?.[ri] ?? ri}-${colNumbers?.[ci] ?? ci}${ownerName ? `, owned by ${ownerName}` : ', unclaimed'}`}
                  >
                    {ownerName && (
                      <span
                        className={styles.ownerName}
                        style={{ color: ownerColor(sq!.userId) }}
                      >
                        {ownerName}
                      </span>
                    )}

                    {gameEntries && gameEntries.map(({ game }) => (
                      <GameChip key={game.id} game={game} />
                    ))}

                    {totalPayout > 0 && (
                      <span className={styles.payoutBadge}>${totalPayout}</span>
                    )}
                  </div>
                )
              })}
            </>
          ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function GameChip({ game }: { game: Game }) {
  const status = getGameStatus(game)
  const winner = getGameWinner(game)
  const teamA = game.teamA?.slice(0, 4) || '???'
  const teamB = game.teamB?.slice(0, 4) || '???'

  return (
    <div className={`${styles.gameChip} ${status === 'active' ? styles.gameChipActive : styles.gameChipFinal}`}>
      <span className={winner === 'A' ? styles.teamWin : ''}>{teamA}</span>
      <span className={styles.chipScore}>
        {game.scoreA ?? '-'}-{game.scoreB ?? '-'}
      </span>
      <span className={winner === 'B' ? styles.teamWin : ''}>{teamB}</span>
    </div>
  )
}
