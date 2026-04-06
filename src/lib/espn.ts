import type { Game, Round } from './types'
import { ROUNDS_IN_ORDER } from './types'

/** Numeric order of rounds for progression checks */
const ROUND_ORDER: Record<Round, number> = Object.fromEntries(
  ROUNDS_IN_ORDER.map((r, i) => [r, i])
) as Record<Round, number>

// === ESPN API Types ===

export interface ESPNGame {
  id: string
  teams: {
    home: { name: string; abbreviation: string; score: number }
    away: { name: string; abbreviation: string; score: number }
  }
  status: 'scheduled' | 'live' | 'final'
  detail: string   // e.g. "15:22 - 1st Half", "Final", "3/20 - 12:15 PM ET"
  round: Round | null  // mapped from ESPN notes
}

const ESPN_SCOREBOARD =
  'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard'

// === Fetch ESPN tournament games for a given date ===

export async function fetchESPNScoreboard(date?: string): Promise<ESPNGame[]> {
  const params = new URLSearchParams({ groups: '100', limit: '200' })
  if (date) params.set('dates', date)

  const resp = await fetch(`${ESPN_SCOREBOARD}?${params}`)
  if (!resp.ok) throw new Error(`ESPN API error: ${resp.status}`)
  const data = await resp.json()

  const events: ESPNGame[] = []
  for (const event of data.events ?? []) {
    const comp = event.competitions?.[0]
    if (!comp) continue

    // Only include NCAA tournament games (tournamentId = 22)
    if (comp.tournamentId !== 22) continue

    const home = comp.competitors?.find((c: any) => c.homeAway === 'home')
    const away = comp.competitors?.find((c: any) => c.homeAway === 'away')
    if (!home || !away) continue

    const stateStr: string = comp.status?.type?.state ?? 'pre'
    let status: ESPNGame['status'] = 'scheduled'
    if (stateStr === 'in') status = 'live'
    else if (stateStr === 'post') status = 'final'

    // Extract round from notes
    const noteHeadline: string = comp.notes?.[0]?.headline ?? ''
    const round = parseRound(noteHeadline)

    events.push({
      id: String(event.id),
      teams: {
        home: {
          name: home.team?.shortDisplayName ?? home.team?.displayName ?? '',
          abbreviation: home.team?.abbreviation ?? '',
          score: parseInt(home.score ?? '0', 10) || 0,
        },
        away: {
          name: away.team?.shortDisplayName ?? away.team?.displayName ?? '',
          abbreviation: away.team?.abbreviation ?? '',
          score: parseInt(away.score ?? '0', 10) || 0,
        },
      },
      status,
      detail: comp.status?.type?.shortDetail ?? comp.status?.type?.detail ?? '',
      round,
    })
  }

  return events
}

// === Round parsing ===

/** Map ESPN note headlines to pool round codes */
function parseRound(headline: string): Round | null {
  const h = headline.toLowerCase()
  // Primary patterns (most common ESPN format)
  if (h.includes('1st round')) return 'R64'
  if (h.includes('2nd round')) return 'R32'
  if (h.includes('sweet 16') || h.includes('sweet sixteen')) return 'S16'
  if (h.includes('elite 8') || h.includes('elite eight')) return 'E8'
  if (h.includes('final four') || h.includes('semifinal')) return 'F4'
  if (h.includes('championship') || h.includes('national championship')) return 'CHAMP'
  // Fallback patterns (alternate ESPN/NCAA naming)
  if (h.includes('regional semifinal')) return 'S16'
  if (h.includes('regional final')) return 'E8'
  if (h.includes('national semifinal')) return 'F4'
  if (h.includes('3rd round')) return 'S16'
  if (h.includes('4th round')) return 'E8'
  return null
}

// === Match ESPN games to pool games ===

/** Normalize a team name for matching: lowercase, trim, strip common suffixes */
function normalize(name: string): string {
  return name.toLowerCase().trim()
    .replace(/\s*(university|state|college|st\.)?\s*$/i, '')
    .trim()
}

/** Check if two team names likely refer to the same team */
function teamsMatch(poolName: string, espnName: string, espnAbbrev: string): boolean {
  if (!poolName) return false
  const p = normalize(poolName)
  const e = normalize(espnName)
  const abbr = espnAbbrev.toLowerCase().trim()

  // Exact match
  if (p === e) return true
  // Pool name matches abbreviation
  if (p === abbr) return true
  // Substring: pool name contained in ESPN name or vice versa
  if (e.includes(p) || p.includes(e)) return true
  // Abbreviation match (pool might use "UNC", ESPN has "North Carolina")
  if (p.length <= 5 && p === abbr) return true

  return false
}

export interface MatchResult {
  poolGameId: number
  espnGame: ESPNGame
  /** Which ESPN team maps to pool teamA: 'home' | 'away' */
  teamAMapping: 'home' | 'away'
}

/**
 * Match ESPN games to pool games using 3-pass strategy:
 * 1. By stored espnId (reliable, persisted from previous polls)
 * 2. By team name (fuzzy match for manually-entered teams)
 * 3. Auto-assign: unmatched ESPN games → empty pool slots in the same round
 *
 * Pass 3 is how games get populated initially. Once an ESPN game is assigned,
 * its espnId is stored, so subsequent polls always match via Pass 1.
 * This handles day-to-day and round-to-round transitions naturally.
 */
export function matchGames(espnGames: ESPNGame[], poolGames: Game[]): MatchResult[] {
  const results: MatchResult[] = []
  const usedEspnIds = new Set<string>()
  const usedPoolIds = new Set<number>()

  // Pass 1: match by stored espnId (most reliable — persisted from previous polls)
  for (const pool of poolGames) {
    if (!pool.espnId) continue
    const espn = espnGames.find(e => e.id === pool.espnId)
    if (!espn) continue
    // Warn if ESPN now reports a different round than the pool slot
    if (espn.round && pool.round !== espn.round) {
      console.warn(`[LiveScoring] Round mismatch: game #${pool.id} is ${pool.round} but ESPN says ${espn.round}`)
    }
    usedEspnIds.add(espn.id)
    usedPoolIds.add(pool.id)
    const teamAMapping = resolveTeamAMapping(pool, espn)
    results.push({ poolGameId: pool.id, espnGame: espn, teamAMapping })
  }

  // Pass 2: match by team name for games without espnId but with team names.
  // Only match within the same round to prevent cross-round collisions
  // (e.g., "Michigan" in S16 matching "Michigan" in Championship).
  for (const pool of poolGames) {
    if (usedPoolIds.has(pool.id)) continue
    if (!pool.teamA && !pool.teamB) continue

    for (const espn of espnGames) {
      if (usedEspnIds.has(espn.id)) continue
      // Round must match to prevent cross-round fuzzy collisions
      if (espn.round && espn.round !== pool.round) continue

      const aMatchesHome = teamsMatch(pool.teamA, espn.teams.home.name, espn.teams.home.abbreviation)
      const aMatchesAway = teamsMatch(pool.teamA, espn.teams.away.name, espn.teams.away.abbreviation)
      const bMatchesHome = teamsMatch(pool.teamB, espn.teams.home.name, espn.teams.home.abbreviation)
      const bMatchesAway = teamsMatch(pool.teamB, espn.teams.away.name, espn.teams.away.abbreviation)

      if ((aMatchesHome && bMatchesAway) || (aMatchesAway && bMatchesHome)) {
        usedEspnIds.add(espn.id)
        usedPoolIds.add(pool.id)
        const teamAMapping: 'home' | 'away' = aMatchesHome ? 'home' : 'away'
        results.push({ poolGameId: pool.id, espnGame: espn, teamAMapping })
        break
      }
    }
  }

  // Pass 3: auto-assign unmatched ESPN games to empty pool slots in the same round.
  // This is how games first get populated. Empty = no teamA and no teamB and no espnId.
  //
  // Round progression guard: don't auto-assign to rounds earlier than the latest
  // round that already has live/final games. This prevents a Sweet 16 game from
  // landing in an R64 slot when R32 games have already been played.
  const latestActiveRound = poolGames
    .filter(g => g.status !== 'scheduled')
    .reduce((max, g) => Math.max(max, ROUND_ORDER[g.round] ?? -1), -1)

  for (const espn of espnGames) {
    if (usedEspnIds.has(espn.id)) continue
    if (!espn.round) continue // can't assign without knowing the round

    // Find first empty pool game in this round
    const emptySlot = poolGames.find(
      p => !usedPoolIds.has(p.id) && p.round === espn.round && !p.teamA && !p.teamB && !p.espnId
    )
    if (!emptySlot) continue

    // Don't assign to rounds that are behind the tournament's current progress
    if (ROUND_ORDER[emptySlot.round] < latestActiveRound) {
      console.warn(`[LiveScoring] Skipping auto-assign to game #${emptySlot.id} (${emptySlot.round}) — tournament has progressed past this round`)
      continue
    }

    usedEspnIds.add(espn.id)
    usedPoolIds.add(emptySlot.id)
    // For auto-assigned games, teamA = away team, teamB = home team (arbitrary but consistent)
    results.push({
      poolGameId: emptySlot.id,
      espnGame: espn,
      teamAMapping: 'away', // teamA gets the away team
    })
  }

  return results
}

/** Determine which ESPN side (home/away) corresponds to pool teamA */
function resolveTeamAMapping(pool: Game, espn: ESPNGame): 'home' | 'away' {
  const aHome = teamsMatch(pool.teamA, espn.teams.home.name, espn.teams.home.abbreviation)
  return aHome ? 'home' : 'away'
}
