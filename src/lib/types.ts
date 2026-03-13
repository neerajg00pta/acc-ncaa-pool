// === Data model types ===

export interface User {
  id: string
  name: string
  email: string
  fullName?: string
  admin: boolean
  paid: boolean
  createdAt: string
}

export interface Square {
  row: number
  col: number
  userId: string
  claimedAt: string
}

export interface Game {
  id: number
  round: Round
  teamA: string
  teamB: string
  scoreA: number | null
  scoreB: number | null
}

export interface Config {
  boardLocked: boolean
  maxSquaresPerPerson: number
  rowNumbers: number[] | null
  colNumbers: number[] | null
}

export type Round = 'R64' | 'R32' | 'S16' | 'E8' | 'F4' | 'CHAMP'

export type GameStatus = 'scheduled' | 'active' | 'final'

// === Derived types ===

export interface Payout {
  gameId: number
  squareRow: number
  squareCol: number
  userId: string
  amount: number
  round: Round
  teamA: string
  teamB: string
  scoreA: number
  scoreB: number
}

export interface LeaderboardEntry {
  userId: string
  userName: string
  totalWinnings: number
  payouts: Payout[]
}

// === Constants ===

export const ROUND_LABELS: Record<Round, string> = {
  R64: 'Round of 64',
  R32: 'Round of 32',
  S16: 'Sweet 16',
  E8: 'Elite 8',
  F4: 'Final Four',
  CHAMP: 'Championship',
}

export const ROUND_PAYOUTS: Record<Round, number> = {
  R64: 50,
  R32: 100,
  S16: 200,
  E8: 400,
  F4: 800,
  CHAMP: 1600,
}

export const ROUND_GAME_COUNTS: Record<Round, number> = {
  R64: 32,
  R32: 16,
  S16: 8,
  E8: 4,
  F4: 2,
  CHAMP: 1,
}

export const ROUNDS_IN_ORDER: Round[] = ['R64', 'R32', 'S16', 'E8', 'F4', 'CHAMP']

// 10 distinct colors for player squares
export const OWNER_COLORS = [
  '#e06c75', // red
  '#61afef', // blue
  '#98c379', // green
  '#c678dd', // purple
  '#e5c07b', // yellow
  '#56b6c2', // cyan
  '#be5046', // dark red
  '#d19a66', // orange
  '#7ec8e3', // light blue
  '#c3e88d', // lime
]

export function getGameStatus(game: Game): GameStatus {
  if (game.scoreA === null && game.scoreB === null) return 'scheduled'
  if (game.scoreA !== null && game.scoreB !== null) return 'final'
  return 'active'
}

export function getGameWinner(game: Game): 'A' | 'B' | null {
  if (game.scoreA === null || game.scoreB === null) return null
  return game.scoreA >= game.scoreB ? 'A' : 'B'
}

/** Map a final game to its grid square using assigned axis numbers */
export function gameToSquare(
  game: Game,
  rowNumbers: number[],
  colNumbers: number[]
): { row: number; col: number } | null {
  if (game.scoreA === null || game.scoreB === null) return null
  const winner = getGameWinner(game)
  if (!winner) return null

  const winScore = winner === 'A' ? game.scoreA : game.scoreB
  const loseScore = winner === 'A' ? game.scoreB : game.scoreA

  const winLastDigit = winScore % 10
  const loseLastDigit = loseScore % 10

  // Winner's last digit → column, Loser's last digit → row
  const col = colNumbers.indexOf(winLastDigit)
  const row = rowNumbers.indexOf(loseLastDigit)

  if (col === -1 || row === -1) return null
  return { row, col }
}

/** Deterministic color for a user based on their ID */
export function ownerColor(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0
  }
  return OWNER_COLORS[Math.abs(hash) % OWNER_COLORS.length]
}

/** Generate the initial 63 games */
export function generateInitialGames(): Game[] {
  const games: Game[] = []
  let id = 1
  for (const round of ROUNDS_IN_ORDER) {
    for (let i = 0; i < ROUND_GAME_COUNTS[round]; i++) {
      games.push({ id: id++, round, teamA: '', teamB: '', scoreA: null, scoreB: null })
    }
  }
  return games
}
