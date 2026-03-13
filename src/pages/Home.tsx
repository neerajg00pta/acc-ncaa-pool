import { useState } from 'react'
import { Grid } from '../components/Grid'
import { Leaderboard } from '../components/Leaderboard'
import styles from './Home.module.css'

export function HomePage() {
  const [searchQuery, setSearchQuery] = useState('')

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
          <Leaderboard searchQuery={searchQuery} />
        </aside>
      </div>
    </div>
  )
}
