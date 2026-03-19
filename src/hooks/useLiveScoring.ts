import { useEffect, useRef, useState, useCallback } from 'react'
import type { Game } from '../lib/types'
import { fetchESPNScoreboard, matchGames, type ESPNGame, type MatchResult } from '../lib/espn'
import { saveGames } from '../lib/github-data-service'

const POLL_INTERVAL_MS = 30_000 // 30 seconds

export interface LiveScoringState {
  espnGames: ESPNGame[]
  matches: MatchResult[]
  lastPoll: Date | null
  polling: boolean
  error: string | null
}

/**
 * Hook that polls ESPN for live scores and writes updates to Supabase.
 * Only active when `enabled` is true (admin has live scoring ON).
 * Pauses when the browser tab is hidden.
 */
export function useLiveScoring(
  enabled: boolean,
  games: Game[],
  onRefresh: () => Promise<void>,
): LiveScoringState {
  const [espnGames, setEspnGames] = useState<ESPNGame[]>([])
  const [matches, setMatches] = useState<MatchResult[]>([])
  const [lastPoll, setLastPoll] = useState<Date | null>(null)
  const [polling, setPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null)
  const gamesRef = useRef(games)
  gamesRef.current = games

  const poll = useCallback(async () => {
    if (document.hidden) return // skip when tab is backgrounded
    setPolling(true)
    try {
      // Fetch current tournament games from ESPN (no date = all active days)
      const espn = await fetchESPNScoreboard()
      setEspnGames(espn)

      // Match ESPN games to pool games
      const currentGames = gamesRef.current
      const matched = matchGames(espn, currentGames)
      setMatches(matched)

      // Build updates for matched games
      const updates: Game[] = []
      for (const match of matched) {
        const pool = currentGames.find(g => g.id === match.poolGameId)
        if (!pool) continue
        if (pool.scoreLocked) continue // skip locked games

        const espnGame = match.espnGame

        // Resolve team names based on mapping
        const teamAData = match.teamAMapping === 'home' ? espnGame.teams.home : espnGame.teams.away
        const teamBData = match.teamAMapping === 'home' ? espnGame.teams.away : espnGame.teams.home

        // For scheduled ESPN games, still populate team names but no scores
        const scoreA = espnGame.status === 'scheduled' ? null : teamAData.score
        const scoreB = espnGame.status === 'scheduled' ? null : teamBData.score
        const newStatus = espnGame.status === 'scheduled' ? 'scheduled' as const : espnGame.status

        // Check what changed
        const teamChanged = pool.teamA !== teamAData.name || pool.teamB !== teamBData.name
        const statusChanged = pool.status !== newStatus
        const scoreChanged = pool.scoreA !== scoreA || pool.scoreB !== scoreB
        const needsEspnId = !pool.espnId

        if (teamChanged || statusChanged || scoreChanged || needsEspnId) {
          updates.push({
            ...pool,
            teamA: teamAData.name,
            teamB: teamBData.name,
            scoreA,
            scoreB,
            status: newStatus,
            espnId: espnGame.id,
          })
        }
      }

      // Write updates to Supabase
      if (updates.length > 0) {
        const updateMap = new Map(updates.map(u => [u.id, u]))
        await saveGames(prev =>
          prev.map(g => updateMap.get(g.id) ?? g)
        )
        await onRefresh()
      }

      setError(null)
      setLastPoll(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ESPN fetch failed')
    } finally {
      setPolling(false)
    }
  }, [onRefresh])

  useEffect(() => {
    if (!enabled) {
      // Clean up when disabled
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = null
      setEspnGames([])
      setMatches([])
      setLastPoll(null)
      setError(null)
      return
    }

    // Initial poll
    poll()

    // Start interval
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [enabled, poll])

  return { espnGames, matches, lastPoll, polling, error }
}
