import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Grid } from '../components/Grid'
import { Leaderboard } from '../components/Leaderboard'
import styles from './Home.module.css'

export function HomePage() {
  const { currentUser } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')

  if (!currentUser) {
    return (
      <div className={styles.loginPrompt}>
        <span className={styles.loginIcon}>🏀</span>
        <h1 className={styles.loginTitle}>March Madness Squares</h1>
        <p className={styles.loginSubtext}>
          Enter the access code your admin sent you to get started.
        </p>
      </div>
    )
  }

  return (
    <div className={styles.homePage}>
      <div className={styles.searchBar}>
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search player..."
          className={styles.searchInput}
        />
        {searchQuery && (
          <button
            className={styles.clearSearch}
            onClick={() => setSearchQuery('')}
          >
            ✕
          </button>
        )}
      </div>

      <div className={styles.layout}>
        <div className={styles.gridArea}>
          <Grid searchQuery={searchQuery} />
        </div>
        <aside className={styles.sidebarArea}>
          <Leaderboard />
        </aside>
      </div>
    </div>
  )
}
