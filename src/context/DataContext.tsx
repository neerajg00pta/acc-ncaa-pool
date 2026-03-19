import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { Config, User, Square, Game } from '../lib/types'
import { fetchAllData } from '../lib/github-data-service'
import { POLL_INTERVAL_MS } from '../lib/config'

interface DataState {
  config: Config
  users: User[]
  squares: Square[]
  games: Game[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const DataContext = createContext<DataState | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<Config>({ boardLocked: false, maxSquaresPerPerson: 10, rowNumbers: null, colNumbers: null, liveScoring: false })
  const [users, setUsers] = useState<User[]>([])
  const [squares, setSquares] = useState<Square[]>([])
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const data = await fetchAllData()
      setConfig(data.config)
      setUsers(data.users)
      setSquares(data.squares)
      setGames(data.games)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [refresh])

  return (
    <DataContext.Provider value={{ config, users, squares, games, loading, error, refresh }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
