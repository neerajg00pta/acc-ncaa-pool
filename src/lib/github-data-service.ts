import { supabase } from './supabase'
import type { Config, User, Square, Game } from './types'

// === Reads ===

export async function getConfig(): Promise<Config> {
  const { data, error } = await supabase
    .from('config')
    .select('*')
    .eq('id', 1)
    .single()
  if (error) throw error
  return {
    boardLocked: data.board_locked,
    maxSquaresPerPerson: data.max_squares_per_person,
    rowNumbers: data.row_numbers,
    colNumbers: data.col_numbers,
  }
}

export async function getUsers(): Promise<User[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at')
  if (error) throw error
  return (data ?? []).map(u => ({
    id: u.id,
    name: u.name,
    code: u.code,
    admin: u.admin,
    paid: u.paid,
    createdAt: u.created_at,
  }))
}

export async function getSquares(): Promise<Square[]> {
  const { data, error } = await supabase
    .from('squares')
    .select('*')
  if (error) throw error
  return (data ?? []).map(s => ({
    row: s.row,
    col: s.col,
    userId: s.user_id,
    claimedAt: s.claimed_at,
  }))
}

export async function getGames(): Promise<Game[]> {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .order('id')
  if (error) throw error
  return (data ?? []).map(g => ({
    id: g.id,
    round: g.round,
    teamA: g.team_a,
    teamB: g.team_b,
    scoreA: g.score_a,
    scoreB: g.score_b,
  }))
}

export async function fetchAllData() {
  const [config, users, squares, games] = await Promise.all([
    getConfig(),
    getUsers(),
    getSquares(),
    getGames(),
  ])
  return { config, users, squares, games }
}

// === Config writes ===

export async function updateConfig(updater: (c: Config) => Config): Promise<Config> {
  const current = await getConfig()
  const updated = updater(current)
  const { error } = await supabase
    .from('config')
    .update({
      board_locked: updated.boardLocked,
      max_squares_per_person: updated.maxSquaresPerPerson,
      row_numbers: updated.rowNumbers,
      col_numbers: updated.colNumbers,
    })
    .eq('id', 1)
  if (error) throw error
  return updated
}

// === User writes ===

export async function saveUsers(updater: (users: User[]) => User[]): Promise<User[]> {
  const current = await getUsers()
  const updated = updater(current)

  // Diff: find added, removed, changed
  const currentIds = new Set(current.map(u => u.id))
  const updatedIds = new Set(updated.map(u => u.id))

  // Deleted
  const deletedIds = [...currentIds].filter(id => !updatedIds.has(id))
  if (deletedIds.length > 0) {
    const { error } = await supabase.from('users').delete().in('id', deletedIds)
    if (error) throw error
  }

  // Upsert all remaining
  if (updated.length > 0) {
    const { error } = await supabase.from('users').upsert(
      updated.map(u => ({
        id: u.id,
        name: u.name,
        code: u.code,
        admin: u.admin,
        paid: u.paid,
        created_at: u.createdAt,
      }))
    )
    if (error) throw error
  }

  return updated
}

// === Square writes ===

export async function saveSquares(updater: (squares: Square[]) => Square[]): Promise<Square[]> {
  const current = await getSquares()
  const updated = updater(current)

  const toKey = (s: { row: number; col: number }) => `${s.row}-${s.col}`
  const currentKeys = new Set(current.map(toKey))
  const updatedKeys = new Set(updated.map(toKey))

  // Deleted squares
  const deleted = current.filter(s => !updatedKeys.has(toKey(s)))
  for (const s of deleted) {
    const { error } = await supabase.from('squares').delete().eq('row', s.row).eq('col', s.col)
    if (error) throw error
  }

  // Added squares
  const added = updated.filter(s => !currentKeys.has(toKey(s)))
  if (added.length > 0) {
    const { error } = await supabase.from('squares').insert(
      added.map(s => ({
        row: s.row,
        col: s.col,
        user_id: s.userId,
        claimed_at: s.claimedAt,
      }))
    )
    if (error) throw error
  }

  return updated
}

// === Game writes ===

export async function saveGames(updater: (games: Game[]) => Game[]): Promise<Game[]> {
  const current = await getGames()
  const updated = updater(current)

  if (updated.length > 0) {
    const { error } = await supabase.from('games').upsert(
      updated.map(g => ({
        id: g.id,
        round: g.round,
        team_a: g.teamA,
        team_b: g.teamB,
        score_a: g.scoreA,
        score_b: g.scoreB,
      }))
    )
    if (error) throw error
  }

  return updated
}
