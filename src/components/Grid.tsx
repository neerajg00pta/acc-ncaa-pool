import { useState, useMemo, useCallback } from 'react'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { saveSquares, updateConfig } from '../lib/github-data-service'
import {
  type Game, type Square,
  getGameStatus, gameToSquare, ownerColor,
  ROUND_PAYOUTS, ROUND_LABELS, getGameWinner,
} from '../lib/types'
import styles from './Grid.module.css'

interface GridProps {
  searchQuery: string
}

export function Grid({ searchQuery }: GridProps) {
  const { config, users, squares, games, refresh } = useData()
  const { currentUser, isAdmin } = useAuth()
  const { addToast } = useToast()
  const [claiming, setClaiming] = useState<string | null>(null)
  const [flashCell, setFlashCell] = useState<string | null>(null)
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)

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

  // Compute heat map values
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

  const mySquareCount = useMemo(() => {
    if (!currentUser) return 0
    return squares.filter(s => s.userId === currentUser.id).length
  }, [squares, currentUser])

  const handleSquareClick = async (row: number, col: number) => {
    if (!currentUser) return
    const key = `${row}-${col}`
    const existing = squareMap.get(key)

    // When board is locked, show detail card instead
    if (config.boardLocked) {
      setSelectedSquare(selectedSquare === key ? null : key)
      return
    }

    if (existing && existing.userId !== currentUser.id) return

    setClaiming(key)
    setFlashCell(key)
    setTimeout(() => setFlashCell(null), 400)

    try {
      if (existing) {
        await saveSquares(prev => prev.filter(s => !(s.row === row && s.col === col)))
        addToast('Released!', 'success')
      } else {
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

  const toggleLock = async () => {
    try {
      await updateConfig(c => ({ ...c, boardLocked: !c.boardLocked }))
      await refresh()
      addToast(config.boardLocked ? 'Unlocked' : 'Locked', 'success')
    } catch { addToast('Failed', 'error') }
  }

  // Search
  const searchLower = searchQuery.toLowerCase()
  const matchedUserIds = useMemo(() => {
    if (!searchLower) return null
    return new Set(users.filter(u => u.name.toLowerCase().includes(searchLower)).map(u => u.id))
  }, [searchLower, users])

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

  // Detail card data
  const selectedData = useMemo(() => {
    if (!selectedSquare) return null
    const sq = squareMap.get(selectedSquare)
    const entries = gameSquareMap.get(selectedSquare) || []
    const total = payoutMap.map.get(selectedSquare) || 0
    const ownerName = sq ? userMap.get(sq.userId) || '???' : null
    const [r, c] = selectedSquare.split('-').map(Number)
    return { sq, entries, total, ownerName, row: r, col: c }
  }, [selectedSquare, squareMap, gameSquareMap, payoutMap, userMap])

  return (
    <div className={styles.gridWrapper}>
      {!rowNumbers && (
        <div className={styles.banner + ' ' + styles.bannerInfo}>Numbers not yet assigned</div>
      )}

      {/* Winner label + admin lock toggle */}
      <div className={styles.axisLabelRow}>
        <div className={styles.axisLabelCorner}>
          {isAdmin ? (
            <button className={styles.lockToggle} onClick={toggleLock} title={config.boardLocked ? 'Unlock board' : 'Lock board'}>
              {config.boardLocked ? '🔒' : '🔓'}
            </button>
          ) : (
            config.boardLocked && <span className={styles.lockIcon} title="Board is locked">🔒</span>
          )}
        </div>
        <div className={styles.axisLabelWinner}>← WINNER →</div>
      </div>

      <div className={styles.gridWithLoser}>
        <div className={styles.axisLabelLoser}>
          <span>↑ LOSER ↓</span>
        </div>

        <div className={styles.gridScroll} onMouseLeave={clearHover}>
          <div className={styles.grid}>
            <div className={styles.cornerCell} />

            {Array.from({ length: 10 }, (_, ci) => (
              <div key={`ch-${ci}`} className={`${styles.headerCell} ${styles.headerWinner} ${hoverCol === ci ? styles.headerHighlight : ''}`}>
                {colNumbers ? colNumbers[ci] : '?'}
              </div>
            ))}

            {Array.from({ length: 10 }, (_, ri) => (
              <>
                <div key={`rh-${ri}`} className={`${styles.headerCell} ${styles.headerLoser} ${hoverRow === ri ? styles.headerHighlight : ''}`}>
                  {rowNumbers ? rowNumbers[ri] : '?'}
                </div>

                {Array.from({ length: 10 }, (_, ci) => {
                  const key = `${ri}-${ci}`
                  const sq = squareMap.get(key)
                  const ownerName = sq ? (userMap.get(sq.userId) || '???') : null
                  const isMine = sq?.userId === currentUser?.id
                  const totalPayout = payoutMap.map.get(key) || 0
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
                        ${selectedSquare === key ? styles.cellSelected : ''}
                      `}
                      style={undefined}
                      onMouseEnter={() => handleCellHover(ri, ci)}
                      onClick={() => handleSquareClick(ri, ci)}
                    >
                      {ownerName && (
                        <span className={`${styles.ownerName} ${isMine ? styles.ownerMine : ''}`}>
                          {ownerName}
                        </span>
                      )}
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

      {/* Detail card for selected square */}
      {selectedData && config.boardLocked && (
        <div className={styles.detailCard}>
          <div className={styles.detailHeader}>
            <span className={styles.detailCoord}>
              [{rowNumbers?.[selectedData.row]},{colNumbers?.[selectedData.col]}]
            </span>
            {selectedData.ownerName ? (
              <span className={styles.detailOwner}>{selectedData.ownerName}</span>
            ) : (
              <span className={styles.detailUnclaimed}>Unclaimed</span>
            )}
            {selectedData.total > 0 && (
              <span className={styles.detailTotal}>${selectedData.total.toLocaleString()}</span>
            )}
            <button className={styles.detailClose} onClick={() => setSelectedSquare(null)}>✕</button>
          </div>
          {selectedData.entries.length > 0 ? (
            <div className={styles.detailGames}>
              {selectedData.entries.map(({ game, payout }) => {
                const winner = getGameWinner(game)
                return (
                  <div key={game.id} className={styles.detailGame}>
                    <span className={styles.detailRound}>{ROUND_LABELS[game.round]}</span>
                    <span className={styles.detailMatchup}>
                      <span className={winner === 'A' ? styles.detailWinTeam : ''}>{game.teamA}</span>
                      {' '}{game.scoreA}-{game.scoreB}{' '}
                      <span className={winner === 'B' ? styles.detailWinTeam : ''}>{game.teamB}</span>
                    </span>
                    {payout > 0 && <span className={styles.detailPayout}>${payout}</span>}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className={styles.detailEmpty}>No games on this square yet</div>
          )}
        </div>
      )}
    </div>
  )
}
