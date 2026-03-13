import styles from './Rules.module.css'

export function RulesPage() {
  return (
    <div className={styles.rules}>
      <div className={styles.intro}>
        <p>Fellow ACC members, while you prepare to be disappointed by the inevitable bracket buster upset in your traditional, boring brackets, I invite you try something different…</p>
        <h1 className={styles.welcome}>Welcome to March Madness Squares!</h1>
      </div>

      <section className={styles.section}>
        <h2>Entry and Payouts</h2>
        <ul>
          <li>Squares are <strong>$100 each</strong>. Obviously not the cheapest pool in the world, but again you have 63 chances to win (and check out the payouts below!). With 100 total squares, the odds are in your favor you will hit at least a game.</li>
          <li>You may purchase as many squares as you want.</li>
          <li>Payment methods: cash (Alcedo locker), Venmo: <strong>@Marc-Alcedo</strong></li>
          <li>Payment must be received within 3 days of choosing your square(s), or <strong>March 20th</strong>, whichever is earlier. If payment is not received in this timeframe, your square(s) will revert to OPEN status, and will be available to other players. Please submit payment promptly to avoid this scenario.</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>How It Works</h2>
        <p>When the board is full, a random drawing will be held to assign numbers 0–9 to the columns (winning team), and another drawing to assign 0–9 to the rows (losing team). This will be done with witnesses in the Penick Room and will be videoed for authenticity.</p>
        <p className={styles.note}>If a board is not filled by March 20th, all payments received will be refunded and the contest will be cancelled.</p>
      </section>

      <section className={styles.section}>
        <h2>Payout Schedule</h2>
        <div className={styles.payoutTable}>
          <div className={styles.payoutRow}>
            <span className={styles.payoutRound}>Round of 64</span>
            <span className={styles.payoutDetail}>32 games · March 20–21</span>
            <span className={styles.payoutAmount}>$50/game</span>
          </div>
          <div className={styles.payoutRow}>
            <span className={styles.payoutRound}>Round of 32</span>
            <span className={styles.payoutDetail}>16 games · March 22–23</span>
            <span className={styles.payoutAmount}>$100/game</span>
          </div>
          <div className={styles.payoutRow}>
            <span className={styles.payoutRound}>Sweet Sixteen</span>
            <span className={styles.payoutDetail}>8 games · March 27–28</span>
            <span className={styles.payoutAmount}>$200/game</span>
          </div>
          <div className={styles.payoutRow}>
            <span className={styles.payoutRound}>Elite Eight</span>
            <span className={styles.payoutDetail}>4 games · March 29–30</span>
            <span className={styles.payoutAmount}>$400/game</span>
          </div>
          <div className={styles.payoutRow}>
            <span className={styles.payoutRound}>Final Four</span>
            <span className={styles.payoutDetail}>2 games · April 5</span>
            <span className={styles.payoutAmount}>$800/game</span>
          </div>
          <div className={`${styles.payoutRow} ${styles.payoutChamp}`}>
            <span className={styles.payoutRound}>Championship</span>
            <span className={styles.payoutDetail}>1 game · April 7</span>
            <span className={styles.payoutAmount}>$1,600</span>
          </div>
        </div>
        <p className={styles.note}>*The "First Four" or "Play-in Games" on March 18–19 will not count in this contest.</p>
      </section>

      <section className={styles.section}>
        <p>Last year we gave the remaining funds to the Penick Room staff. This year, we're elevating that and are giving one square each to the Penick Room staff, the golf shop staff, the outside service team, and to the locker room team. At the end of the tourney, I will send out a recap of all winnings. All payouts will be distributed the day after the championship game.</p>
      </section>

      <section className={styles.closing}>
        <p>Call or email with questions. Lastly, this is intended to be fun and inspire camaraderie and fellowship among ACC members, please feel free to forward to your ACC group, spouses, dependents, etc. If you find this as an offensive solicitation, please accept my most sincere and humble apologies.</p>
        <p className={styles.signoff}>Let's go,</p>
        <p className={styles.name}>Marc Alcedo</p>
        <p className={styles.contact}>512-426-7661</p>
      </section>
    </div>
  )
}
