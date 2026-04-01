# Squares Pool Platform — Architecture & Infrastructure Spec

**Purpose:** Reusable blueprint for building a squares-pool game app. Covers the full stack, data model patterns, admin workflows, live scoring, and deployment. Game-specific rules (grid dimensions, payout structure, score mapping, sport API) are injected per-project.

---

## 1. Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Frontend** | React 19 + TypeScript, Vite 8 | Single-page app, modular CSS |
| **Routing** | React Router v7, HashRouter | HashRouter required for GitHub Pages (no server-side fallback) |
| **Database** | Supabase (PostgreSQL) | Free tier sufficient for pool-sized groups |
| **Hosting** | GitHub Pages | Static files only, deployed via GitHub Actions |
| **Live Scores** | Sport-specific API (ESPN, PGA, etc.) | Polled from the client, admin-controlled |
| **Auth** | Email-based access codes | No passwords, no OAuth |

---

## 2. Data Architecture: "Supabase as DB"

All persistent state lives in Supabase PostgreSQL tables. The frontend reads and writes directly via the `supabase-js` client using the public anon key (row-level security optional for private pools).

### Core Tables (game-agnostic)

#### `config` (single row)
Global pool settings. Always exactly 1 row.

| Column | Type | Description |
|--------|------|-------------|
| `board_locked` | boolean | When true, no claiming/unclaiming allowed |
| `max_squares_per_person` | integer | Limit on squares any one player can claim |
| `axis_assignments` | jsonb | Randomized number-to-position mapping for each axis (null until assigned) |
| `live_scoring` | boolean | Whether external score API polling is active |
| *game-specific fields* | varies | e.g., round structure, payout table, axis labels |

#### `users`
Player accounts.

| Column | Type | Description |
|--------|------|-------------|
| `id` | text (PK) | Format: `u{timestamp}` |
| `name` | text | Short display name (8-char max, shown on grid) |
| `full_name` | text | Real name (optional) |
| `email` | text (unique) | Login credential — the "access code" |
| `admin` | boolean | Admin privileges |
| `paid` | boolean | Entry fee collected (tracked manually) |
| `created_at` | timestamptz | Account creation time |

#### `squares`
Square ownership. Composite primary key: the axes that define the square (e.g., `row + col` for a 10x10 grid).

| Column | Type | Description |
|--------|------|-------------|
| axis keys | integer (composite PK) | Position on each axis (e.g., `row`, `col`) |
| `user_id` | text (FK → users.id) | Owner |
| `claimed_at` | timestamptz | When claimed |

#### `games`
Sporting events that map onto the grid.

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer (PK) | Sequential game number |
| `round` | text | Game-specific round/stage identifier |
| *competitor fields* | text | Team/player names (game-specific: 2 teams, 4 golfers, etc.) |
| *score fields* | integer/null | Scores per competitor (null until entered) |
| `status` | text | `scheduled` → `live` → `final` |
| `score_locked` | boolean | If true, live scoring won't overwrite |
| `external_id` | text/null | ID from external score API for matching |

---

## 3. Frontend Architecture

### Context Providers (4 providers, wrap the app)

```
<ToastProvider>
  <AuthProvider>
    <DataProvider>
      <LiveScoringProvider>
        <RouterProvider />
      </LiveScoringProvider>
    </DataProvider>
  </AuthProvider>
</ToastProvider>
```

#### AuthContext
- Stores `currentUser` in memory + cookie (30-day expiry)
- `login(email)` — matches email against users table
- `logout()` — clears cookie and state
- `activateAdmin()` — flips admin mode (requires `user.admin === true`)
- URL param `?token=email` auto-logs in on page load

#### DataContext
- Central state: `config`, `users`, `squares`, `games`
- **Polls Supabase every 10 seconds** — fetches all 4 tables in parallel
- Exposes `refresh()` for immediate re-fetch after writes
- Increments a `tick` counter on each poll to force subscriber re-renders

#### LiveScoringContext
- Only active when `config.liveScoring === true`
- Polls external sport API every 30 seconds
- Pauses when browser tab is hidden (`document.hidden`)
- Skips games where `score_locked === true`
- Matching algorithm: external ID → fuzzy name match → auto-assign empty slots
- Writes updates to Supabase, then calls `refresh()`

#### ToastContext
- Queue of toast messages (success, error, info)
- Auto-dismiss after 3.5 seconds
- Max 3 visible simultaneously

### Routes

| Path | Component | Access |
|------|-----------|--------|
| `/` | Home (Login or Grid+Leaderboard) | All |
| `/rules` | Game rules page | All |
| `/admin` | Admin panel (board controls, user management) | Admin only |
| `/admin/games` | Game management (scores, live scoring) | Admin only |

### Key Components

#### Grid
- Renders the N×M grid of squares
- **Board open:** click empty square to claim, click yours to unclaim
- **Board locked:** click any square to see detail popover (owner, games, payouts)
- Axis headers show assigned numbers (or "?" if not yet assigned)
- Admin can inline-edit axis numbers by clicking headers
- Search: filter/highlight squares by player name
- Color coding: deterministic color per owner (hash-based), highlight ring for current user
- Heat map overlay: color intensity by cumulative payout

#### Leaderboard
- Ranked list of all players by cumulative winnings
- Current user pinned to top
- Expandable rows show per-game payout breakdown
- "LIVE" badge on rows with active-game payouts
- Polls alongside the grid (same DataContext)

#### Admin Panel
- **Board controls:** lock/unlock, randomize axis numbers, clear numbers, max-squares slider, live scoring toggle
- **User management:** inline table with add/edit/delete, admin toggle, paid toggle, invite link copy
- **Bulk actions:** copy all emails, email all (mailto: with BCC)

#### Admin Games
- Table of all games organized by round
- Inline editing: competitor names + scores (debounced 800ms save)
- Status auto-computed from score presence
- Live scoring indicators: lock/unlock per game, ESPN match status icons
- CSV export of results
- "Initialize all games" button to create empty game slots

---

## 4. Authentication Model

**No passwords. No registration flow. No OAuth.**

1. Admin creates user accounts with an email address (serves as the access code)
2. Admin distributes links: `https://yourapp.github.io/pool/?token=user@email.com`
3. Player clicks link → auto-logged in. Or manually types email on login screen.
4. Session stored in cookie (`pool_session`), 30-day expiry, per-device
5. Admin users see an "Activate Admin" button on the home page to enter admin mode (separate cookie)

---

## 5. Data Flow Patterns

### Read Path (all users)
```
Browser → Supabase (anon key) → SELECT from tables
         ↑ every 10 seconds (polling)
```

### Write Path (claiming squares)
```
User clicks square
  → Optimistic UI update (show claimed immediately)
  → Supabase INSERT into squares table
  → On success: call refresh(), toast "Claimed!"
  → On conflict (race condition): revert UI, toast "Already taken"
```

### Write Path (admin actions)
```
Admin edits score / creates user / locks board
  → Supabase UPDATE/INSERT/DELETE
  → Call refresh()
  → All connected clients see change within 10 seconds
```

### Live Scoring Flow
```
External API (polled every 30s by admin's browser)
  → Match external games to pool games (3-pass algorithm)
  → Detect changes (scores, status, names)
  → Write updates to Supabase (skip locked games)
  → Call refresh()
  → All clients see updated scores within 10s
```

### 3-Pass Matching Algorithm (for live scoring)
1. **By stored external ID** — most reliable, handles rescheduled events
2. **By competitor name** — fuzzy match (normalize, strip suffixes, substring check)
3. **Auto-assign empty slots** — unmatched external games fill empty pool game slots in the same round

---

## 6. Grid Mechanics (game-agnostic patterns)

### Axis Assignment
- Each axis gets a shuffled array of digits (Fisher-Yates shuffle)
- Admin triggers randomization; can also manually override individual positions
- Until assigned, axes show "?" placeholders
- Games can be scored before assignment, but won't visually map until numbers are set

### Score-to-Square Mapping
Game-specific logic, but the general pattern:
1. Extract relevant digits/values from the game result
2. Map each value to an axis position using the axis assignment arrays
3. The intersection identifies the winning square
4. Look up the square owner → award the round's payout

### Payout Calculation
- Each round has a fixed payout amount (defined in game config)
- A square can win multiple times across different games
- Unclaimed squares: no payout (house keeps it)
- Re-scoring: old payout removed, new payout computed

---

## 7. Styling System

### Theme (CSS custom properties)
Dark mode by default. All colors defined as CSS variables for easy theming.

```css
/* Surface colors */
--bg-primary:    #0d1117;   /* Page background */
--bg-surface:    #161b22;   /* Cards, panels */
--bg-elevated:   #1c2129;   /* Modals, popovers */

/* Text */
--text-primary:  #f0f6fc;
--text-secondary: #8b949e;

/* Accents (game-specific — swap these per project) */
--accent-axis-a: #f0a500;   /* e.g., Winner axis / Column headers */
--accent-axis-b: #58a6ff;   /* e.g., Loser axis / Row headers */
--accent-action: #2ea043;   /* CTAs, success states */

/* Heat map */
--heat-cold:     #1a3a5c;
--heat-hot:      #da3633;
```

### Component Styling
- **CSS Modules** (`.module.css`) per component — no global class collisions
- BEM-like naming: `.cell`, `.cellClaimed`, `.cellMine`, `.cellDimmed`
- Animations: `pulse-green` (board lock indicator), `cell-flash` (claim feedback)

### Responsive Breakpoints
- **Mobile (390px+):** grid horizontally scrollable, 48px cells, leaderboard stacks below
- **Desktop (1280px+):** grid + leaderboard side-by-side, 76px cells

### Player Colors
- 10-color palette, assigned deterministically by hashing user ID
- Current user gets a distinct highlight ring (e.g., gold border)

---

## 8. Deployment

### GitHub Pages + GitHub Actions

```yaml
# .github/workflows/deploy.yml
on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
      - uses: actions/deploy-pages@v4
```

### Vite Config
```typescript
export default defineConfig({
  base: '/<repo-name>/',  // Must match GitHub repo name
  // ...
})
```

### Environment Variables
| Variable | Where | Description |
|----------|-------|-------------|
| `VITE_SUPABASE_URL` | GitHub Secrets + local `.env` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | GitHub Secrets + local `.env` | Public anon key (safe to expose) |

---

## 9. Project Scaffold Checklist

When starting a new game, create the project with this structure:

```
src/
├── main.tsx                     # React entry, mounts App
├── App.tsx                      # Provider stack + router
├── index.css                    # Global theme (swap accent colors)
├── pages/
│   ├── Home.tsx                 # Grid + Leaderboard (or login if no session)
│   ├── Rules.tsx                # Game-specific rules
│   ├── Admin.tsx                # Board controls + user management
│   └── AdminGames.tsx           # Game/event management + live scoring
├── components/
│   ├── Grid.tsx                 # The grid (dimensions, mapping logic = game-specific)
│   ├── Leaderboard.tsx          # Rankings + drill-down
│   ├── Layout.tsx               # Header, nav, footer
│   ├── RegisterModal.tsx        # New player signup
│   └── Toasts.tsx               # Toast notification display
├── context/
│   ├── AuthContext.tsx           # Session management
│   ├── DataContext.tsx           # Polling + global state
│   ├── LiveScoringContext.tsx    # External API integration
│   └── ToastContext.tsx          # Toast queue
├── hooks/
│   └── useLiveScoring.ts        # Sport-specific API polling + matching
├── lib/
│   ├── types.ts                 # Data models + game constants
│   ├── config.ts                # Environment variables
│   └── supabase.ts              # Supabase client init
└── data/                        # Sample/seed JSON (optional)
```

---

## 10. What Each New Game Must Define

These are the **game-specific** pieces that change per project:

| Decision | Example (March Madness) | Example (Golf) |
|----------|------------------------|-----------------|
| **Grid dimensions** | 10×10 (digits 0-9 per axis) | TBD |
| **Axis semantics** | Winner last digit / Loser last digit | TBD |
| **Number of events** | 63 games | TBD |
| **Round/stage structure** | R64, R32, S16, E8, F4, Champ | TBD |
| **Payout per round** | $50 → $1,600 escalating | TBD |
| **Score-to-square mapping** | Winner last digit → col, Loser last digit → row | TBD |
| **External score API** | ESPN college basketball | TBD (ESPN Golf, PGA Tour API, etc.) |
| **Accent colors** | Gold (winner) / Blue (loser) | TBD |
| **Entry fee** | $100 | TBD |
| **Pool size** | $6,300 | TBD |
| **Competitor fields per game** | 2 teams (teamA, teamB) | TBD (field of players, individual golfer, etc.) |

---

## 11. Proven Patterns & Lessons Learned

These patterns were validated in production with real users:

1. **10-second polling is plenty.** No need for WebSockets at pool-sized scale (~50-100 users). Simple, reliable, zero infrastructure.

2. **Optimistic UI for claiming.** Show the claim immediately, revert on conflict. Users feel instant responsiveness.

3. **Debounced admin inputs (800ms).** Admin typing scores/names shouldn't fire a write on every keystroke. Debounce saves API calls and prevents flicker.

4. **Score locking is essential.** When live scoring is on and admin manually edits a score, auto-lock that game to prevent the API from overwriting the manual entry.

5. **3-pass matching for live scores.** External IDs are most reliable, but fuzzy name matching catches games that weren't pre-linked. Auto-assign fills in games the admin hasn't manually created yet.

6. **HashRouter, not BrowserRouter.** GitHub Pages doesn't support SPA fallback routing. Hash routing works everywhere with zero config.

7. **Single-row config table.** Global settings in one row avoids the complexity of a key-value store. Just add columns as needed.

8. **Cookie-based sessions, not localStorage.** Cookies survive across tabs and can have expiry. 30-day window means players don't re-auth constantly.

9. **Deterministic player colors by ID hash.** No need to store color preferences. Hash the user ID into a palette index. Consistent across all views.

10. **Invite links with `?token=` parameter.** One-click login for non-technical users. Admin texts/emails the link, player taps it, done.

---

## 12. Out of Scope (by design)

These are intentionally excluded to keep the platform simple:

- Real-time WebSocket updates
- Payment processing (money handled offline)
- User self-registration (admin creates all accounts)
- Multiple simultaneous pools (one pool per deployment)
- OAuth / social login
- Server-side rendering
- Native mobile app
- Persistent backend server (it's all static + Supabase)
