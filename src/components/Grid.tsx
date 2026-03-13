import { useState, useMemo, useCallback, useEffect } from 'react'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { saveSquares, updateConfig } from '../lib/github-data-service'
import {
  type Game, type Square,
  getGameStatus, gameToSquare,
  ROUND_PAYOUTS, ROUND_LABELS,
} from '../lib/types'
import { RegisterModal } from './RegisterModal'
import styles from './Grid.module.css'
import lbStyles from './Leaderboard.module.css'

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
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(null)
  const [showRegister, setShowRegister] = useState(false)
  const [pendingClaim, setPendingClaim] = useState<{ row: number; col: number } | null>(null)
  const [editingHeader, setEditingHeader] = useState<{ axis: 'row' | 'col'; index: number } | null>(null)
  const [editHeaderValue, setEditHeaderValue] = useState('')

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

  const handleSquareClick = async (row: number, col: number, e?: React.MouseEvent) => {
    const key = `${row}-${col}`
    const existing = squareMap.get(key)

    // When board is locked, show detail popover at click point
    if (config.boardLocked) {
      if (selectedSquare === key) {
        setSelectedSquare(null)
        setPopoverPos(null)
      } else {
        setSelectedSquare(key)
        if (e) {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
          setPopoverPos({ x: rect.left + rect.width / 2, y: rect.bottom + 8 })
        }
      }
      return
    }

    // Not logged in — prompt to register
    if (!currentUser) {
      if (!existing) {
        setPendingClaim({ row, col })
        setShowRegister(true)
      }
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

  const handleRegistered = () => {
    setShowRegister(false)
    // Claim the pending square after registration
    if (pendingClaim) {
      setTimeout(() => handleSquareClick(pendingClaim.row, pendingClaim.col), 300)
      setPendingClaim(null)
    }
  }

  const toggleLock = async () => {
    try {
      await updateConfig(c => ({ ...c, boardLocked: !c.boardLocked }))
      await refresh()
      addToast(config.boardLocked ? 'Unlocked' : 'Locked', 'success')
    } catch { addToast('Failed', 'error') }
  }

  const startHeaderEdit = (axis: 'row' | 'col', index: number) => {
    if (!isAdmin || config.boardLocked) return
    const nums = axis === 'row' ? rowNumbers : colNumbers
    setEditingHeader({ axis, index })
    setEditHeaderValue(nums ? String(nums[index]) : '')
  }

  const commitHeaderEdit = async () => {
    if (!editingHeader) return
    const val = parseInt(editHeaderValue)
    if (isNaN(val) || val < 0 || val > 9) { setEditingHeader(null); return }
    try {
      await updateConfig(c => {
        const nums = editingHeader.axis === 'row'
          ? [...(c.rowNumbers || [0,1,2,3,4,5,6,7,8,9])]
          : [...(c.colNumbers || [0,1,2,3,4,5,6,7,8,9])]
        nums[editingHeader.index] = val
        return editingHeader.axis === 'row'
          ? { ...c, rowNumbers: nums }
          : { ...c, colNumbers: nums }
      })
      await refresh()
    } catch { addToast('Failed to update', 'error') }
    setEditingHeader(null)
  }

  // Esc to close popover
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSelectedSquare(null); setPopoverPos(null) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

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
              <div
                key={`ch-${ci}`}
                className={`${styles.headerCell} ${styles.headerWinner} ${hoverCol === ci ? styles.headerHighlight : ''} ${isAdmin && !config.boardLocked ? styles.headerEditable : ''}`}
                onClick={() => startHeaderEdit('col', ci)}
              >
                {editingHeader?.axis === 'col' && editingHeader.index === ci ? (
                  <input
                    className={styles.headerInput}
                    value={editHeaderValue}
                    onChange={e => setEditHeaderValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') commitHeaderEdit(); if (e.key === 'Escape') setEditingHeader(null) }}
                    onBlur={commitHeaderEdit}
                    autoFocus
                    maxLength={1}
                  />
                ) : (
                  colNumbers ? colNumbers[ci] : '?'
                )}
              </div>
            ))}

            {Array.from({ length: 10 }, (_, ri) => (
              <>
                <div
                  key={`rh-${ri}`}
                  className={`${styles.headerCell} ${styles.headerLoser} ${hoverRow === ri ? styles.headerHighlight : ''} ${isAdmin && !config.boardLocked ? styles.headerEditable : ''}`}
                  onClick={() => startHeaderEdit('row', ri)}
                >
                  {editingHeader?.axis === 'row' && editingHeader.index === ri ? (
                    <input
                      className={styles.headerInput}
                      value={editHeaderValue}
                      onChange={e => setEditHeaderValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') commitHeaderEdit(); if (e.key === 'Escape') setEditingHeader(null) }}
                      onBlur={commitHeaderEdit}
                      autoFocus
                      maxLength={1}
                    />
                  ) : (
                    rowNumbers ? rowNumbers[ri] : '?'
                  )}
                </div>

                {Array.from({ length: 10 }, (_, ci) => {
                  const key = `${ri}-${ci}`
                  const sq = squareMap.get(key)
                  const ownerName = sq ? (userMap.get(sq.userId) || '???') : null
                  const isMine = !!(currentUser && sq && sq.userId === currentUser.id)
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

                  const squareNum = ri * 10 + ci + 1

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
                      onMouseEnter={() => handleCellHover(ri, ci)}
                      onClick={(e) => handleSquareClick(ri, ci, e)}
                    >
                      <span className={styles.squareNum}>{squareNum}</span>
                      <span className={styles.ownerName}>{ownerName || ''}</span>
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

      {/* Detail popover for selected square */}
      {selectedData && config.boardLocked && popoverPos && (
        <div className={styles.popoverBackdrop} onClick={() => { setSelectedSquare(null); setPopoverPos(null) }}>
          <div
            className={styles.popover}
            style={{ left: popoverPos.x, top: popoverPos.y }}
            onClick={e => e.stopPropagation()}
          >
            <div className={lbStyles.row}>
              <div className={lbStyles.rowHeader}>
                <span className={lbStyles.rank}>#{selectedData.row * 10 + selectedData.col + 1}</span>
                <span className={lbStyles.name}>{selectedData.ownerName || 'Unclaimed'}</span>
                <span className={lbStyles.winnings}>${selectedData.total.toLocaleString()}</span>
                <button className={styles.popoverClose} onClick={() => { setSelectedSquare(null); setPopoverPos(null) }}>✕</button>
              </div>
              <div className={lbStyles.breakdown}>
                {selectedData.entries.length > 0 ? selectedData.entries.map(({ game, payout }) => (
                  <div key={game.id} className={lbStyles.payoutRow}>
                    <span className={lbStyles.payoutSquare}>
                      [{colNumbers?.[selectedData.col]},{rowNumbers?.[selectedData.row]}]
                    </span>
                    <span className={lbStyles.payoutGame}>
                      {game.teamA} {game.scoreA}-{game.scoreB} {game.teamB}
                    </span>
                    <span className={lbStyles.payoutRound}>{ROUND_LABELS[game.round]}</span>
                    {payout > 0 && <span className={lbStyles.payoutAmount}>${payout}</span>}
                  </div>
                )) : (
                  <div className={lbStyles.noWins}>No games on this square yet</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showRegister && (
        <RegisterModal
          onClose={() => { setShowRegister(false); setPendingClaim(null) }}
          onRegistered={handleRegistered}
        />
      )}
    </div>
  )
}
