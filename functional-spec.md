# March Madness Squares Pool — Functional Specification

**Version:** 1.0
**Date:** 2026-03-12
**Status:** Built, deployed at acc-ncaa-pool.vercel.app

---

## 1. Overview

A web app for running a March Madness squares pool across all 63 NCAA tournament games. One 10x10 grid. 100 squares. 63 games. Each game maps to a square based on the last digit of each team's final score. The square's owner wins the payout for that game. Payouts escalate each round.

**Players:** ~50-100 people in a private group
**Entry fee:** $100 per person (collected offline)
**Total prize pool:** $6,300

---

## 2. How the Game Works

### The Grid

A standard 10x10 grid with 100 squares. The columns are labeled 0–9 across the top. The rows are labeled 0–9 down the left side. Each square sits at the intersection of one row number and one column number.

Before the tournament starts, players claim squares. Each square belongs to one person. After all squares are claimed, the admin locks the board and randomizes which digits (0–9) go on which row and which column. This randomization is the key — nobody knows which numbers their square will get until the admin assigns them.

### Score-to-Square Mapping

When a game finishes with a final score (e.g., Duke 72 – UNC 68):

1. **Winning team's last digit → column.** Duke won, last digit of 72 = **2**, so column **2**.
2. **Losing team's last digit → row.** UNC lost, last digit of 68 = **8**, so row **8**.
3. The square at row 8, column 2 wins the payout for that game.

This applies to all 63 games in the tournament, from the first round through the championship.

**Overtime rule:** Use the final score as-is. No special handling — overtime points count.

### Payout Structure

| Round | Games | Payout Per Game | Round Total |
|-------|-------|----------------|-------------|
| Round of 64 | 32 | $50 | $1,600 |
| Round of 32 | 16 | $100 | $1,600 |
| Sweet 16 | 8 | $200 | $1,600 |
| Elite 8 | 4 | $400 | $1,600 |
| Final Four | 2 | $800 | $1,600 |
| Championship | 1 | $1,600 | $1,600 |
| **Total** | **63** | | **$6,300** |

Note: A single square can win multiple times across different games. Some squares will never be hit. That's the gamble.

**Unclaimed squares:** If a game lands on a square that nobody claimed, there is no payout for that game. The house keeps it.

### Multiple Games Per Square

Because 63 games map onto only 100 possible squares (10 × 10), many squares will have multiple games land on them across the tournament. A square at a popular digit combination (like 7-2) might collect payouts from 3 or 4 different games. Other squares might collect zero. The grid shows all games that have landed on each square.

---

## 3. User Roles

### Players

- See the 10x10 grid with all squares, owners, and game results
- Claim and unclaim squares (before the board is locked)
- See their own squares highlighted
- Search for other players to see their squares
- View the leaderboard showing cumulative winnings
- Drill into any leaderboard entry to see per-square payout breakdowns

### Admin

Everything players can do, plus:

- Create and delete user accounts
- Assign access codes to users
- Grant or revoke admin privileges on any user
- Lock and unlock the board
- Trigger random number assignment for rows and columns
- Manually override individual row/column number assignments
- Set the maximum number of squares any one person can claim
- Create tournament games (team names, round designation)
- Enter and update game scores
- Mark players as paid or unpaid for the $100 entry fee

---

## 4. Authentication

There is no registration flow. No usernames. No passwords.

The admin creates each user account and assigns them an **access code** — a short string like `john123` or `neeraj2025`. The admin distributes these codes to players however they want (text, email, in person).

### Logging In

The app's home page shows a single text input: "Enter the access code your admin sent you." The player types their code and hits Enter. If valid, the app remembers them (persists across browser refresh for 30 days). If invalid, it shows an error.

### Direct Links

The app supports `?token=xxx` in the URL. Visiting `acc-ncaa-pool.vercel.app/?token=john123` auto-submits the code on page load. Useful for the admin to send players a one-click link.

### Admin Access

Admin codes work the same way — type the code, hit Enter. If the account has admin privileges, the user is redirected to the admin panel. Admin-only API routes reject non-admin requests with a 403.

### Logging Out

A "Log out" button in the header clears the session. The user returns to the code input screen.

---

## 5. The Grid (Player View)

### Layout

The main screen after login is dominated by the 10x10 grid. It's the centerpiece of the app.

- **Axis labels:** Row numbers (0–9) down the left side, column numbers (0–9) across the top. Before number assignment, axes show "?" placeholders.
- **Cell contents:** Each cell shows the owner's name (or is empty if unclaimed).
- **Color coding by owner:** Each owner gets a deterministic color from a 10-color palette. Your own squares get a distinct highlight ring.

### Mobile (iPhone 390px+)

- The grid is horizontally scrollable if needed
- Minimum tap target: 44px per cell
- Search filters the grid to show only matching squares (non-matches are hidden)
- Leaderboard stacks below the grid

### Desktop (1280px+)

- Grid and leaderboard are side-by-side
- Grid takes the majority of the width, leaderboard is a fixed-width panel on the right
- Search highlights matching squares with a ring; non-matches are dimmed but still visible

### Claiming Squares

Before the board is locked:

- **Claim:** Click an empty square. It immediately shows your name (optimistic UI). If the server confirms, it stays. If someone else claimed it first, it reverts and you see an error toast.
- **Unclaim:** Click your own square. It becomes empty again.
- **Limits:** The admin sets a maximum squares-per-person limit (default: 10). If you've hit the limit, clicking another empty square shows an error.
- **Other people's squares:** Clicking someone else's square does nothing.

After the board is locked:

- All squares are frozen. Clicking any square shows a "Board is locked" message. No claims or unclaims are possible.

### Board State Banners

- **"Board is locked"** — amber banner shown when the admin has locked the board
- **"Numbers not yet assigned"** — shown when row/column numbers haven't been randomized yet

### Game Chips on Squares

As tournament games are scored, they appear as small chips inside their mapped square:

- **Active games** (score entered but game not final): green pulsing chip showing abbreviated team names and current score
- **Final games** (game complete): dark static chip showing abbreviated team names and final score
- A single square can have multiple game chips stacked vertically

### Heat Map

Once games start paying out, the grid is color-coded by cumulative payout:

- **Red** = hot squares (highest cumulative payouts)
- **Blue** = cold squares (lowest or zero payouts)
- 10-level gradient across all 100 squares
- Updates as new games complete

### Real-Time Updates

The grid polls for new data every 10 seconds. When the admin enters a new score, updates a game, or a player claims a square, the change appears on everyone's grid within ~10 seconds without anyone refreshing the page.

---

## 6. Search

A search bar sits above the grid. Typing a player's name:

- **Desktop:** Highlights matching player's squares with an amber ring. Non-matching squares are dimmed (30% opacity). Grid structure stays intact.
- **Mobile:** Hides all non-matching squares entirely, showing only the searched player's squares. This makes it easy to see "where are my friend's squares?" on a small screen.

Search is case-insensitive and uses simple substring matching. Clearing the search restores the full grid.

---

## 7. Leaderboard

Below (mobile) or beside (desktop) the grid, a ranked list of all players by cumulative winnings.

### Display

- Ranked by total winnings (descending), then alphabetically for ties
- Each row shows: rank, player name, total winnings
- The logged-in user's row is pinned to the top with a distinct highlight, regardless of their actual rank
- Players with $0 winnings still appear

### Drill-Down

Clicking/tapping the expand chevron on any leaderboard row reveals a per-square breakdown:

- Which square(s) earned money
- For each square: which game(s) landed there, the round, and the payout amount
- Square subtotal

### Polling

Leaderboard data refreshes every 10 seconds, same as the grid.

---

## 8. Admin Panel

Accessible at `/admin` for admin-role users only.

### User Management

- **Create user:** Name + access code. Optionally grant admin privileges.
- **Edit user:** Change name, access code, admin flag.
- **Delete user:** Remove a user account.
- **Payment tracking:** Mark each user as paid or unpaid for the $100 entry fee. This is a simple flag — no payment processing. The admin collects money offline and updates the flag.

### Board Controls

- **Lock / Unlock:** Toggle the board between frozen and open states. When locked, no player can claim or unclaim squares.
- **Randomize Numbers:** Trigger a Fisher-Yates shuffle to randomly assign digits 0–9 to each row and each column. This is the moment of truth — the grid's "personality" is set.
- **Manual Override:** After randomization (or before), the admin can manually set any individual row or column number. Useful for correcting mistakes or running a specific configuration.
- **Max Squares Per Person:** Set the limit (1–100, default 10) on how many squares any one player can claim.

### Game Management

- **Create game:** Enter two team names and the round (R64, R32, S16, E8, F4, Championship).
- **Enter/update score:** For each game, enter Team A's score and Team B's score. The system determines the winner, computes the square mapping, and calculates the payout automatically.
- **Score states:**
  - No scores entered → game is "scheduled" (doesn't appear on grid)
  - One score entered → game is "active" (appears on grid with partial info)
  - Both scores entered → game is "final" (payout computed and awarded)
- **Re-scoring:** Admin can update a final game's score. The payout is recalculated — the old payout is removed and the new one is applied.
- **Delete game:** Remove a game entirely.

### Admin Navigation

The admin panel has links to:
- Board controls (main admin page)
- Game management (`/admin/games`)

---

## 9. Notifications and Feedback

### Toast Notifications

When a player claims or unclaims a square, a toast notification briefly appears:

- **Success:** "Claimed!" or "Released!"
- **Error:** "Board is locked", "Square already taken", "Max squares reached", etc.

Toasts auto-dismiss after 3.5 seconds. Up to 3 can stack simultaneously.

### Cell Flash

When you click a square (claim or unclaim), the cell briefly flashes to acknowledge the interaction.

---

## 10. Data Model (Conceptual)

Four data collections:

### Squares
- 100 squares, each identified by row-column (e.g., "3-7")
- Owner (user ID + name), or null if unclaimed
- Claimed timestamp
- Board locked flag (global)
- Max squares per person (global)
- Row numbers array (0–9 assignment, or null if not yet assigned)
- Column numbers array (0–9 assignment, or null if not yet assigned)

### Games
- Game ID
- Team A name, Team B name
- Round (R64, R32, S16, E8, F4, Championship)
- Score A, Score B (null until entered)
- Status: scheduled → active → final
- Winner (computed)
- Square ID (computed from scores)

### Users
- User ID
- Display name
- Access code (the token they type to log in)
- Admin flag
- Paid flag
- Created timestamp

### Payouts
- Game ID
- Square ID
- User ID (the winner)
- Amount
- Round

---

## 11. Edge Cases and Rules

| Scenario | Behavior |
|----------|----------|
| Game lands on unclaimed square | No payout. House keeps it. |
| Two games land on same square | Both pay out to the square owner. |
| Score is updated after game is final | Old payout removed, new payout computed and awarded. |
| Overtime game | Use final score including OT points. No special handling. |
| Player tries to claim when at max limit | Error: "You've reached the maximum of X squares." |
| Player tries to claim after board lock | Error: "Board is locked." |
| Player tries to unclaim someone else's square | Silently ignored (no error shown). |
| Admin enters only one team's score | Game status becomes "active." Appears on grid. No payout yet. |
| Numbers not yet assigned | Axes show "?" marks. Games can still be scored but won't map to visual positions until numbers are assigned. |
| Player opens app on new device | Enter access code again. Session is per-device. |

---

## 12. Tournament Timeline

Typical admin workflow for a tournament:

1. **Days before tournament:** Create user accounts, distribute access codes. Open the board for claiming.
2. **Before first game:** Lock the board. Randomize numbers. Verify the grid looks right.
3. **During each game:** Enter/update scores as the game progresses (or after it ends). The grid updates in real-time for all players.
4. **After tournament:** The leaderboard shows final standings. Admin settles payouts offline.

---

## 13. Out of Scope (v1)

- Real-time WebSocket updates (polling is sufficient for this scale)
- Payment processing (money handled offline)
- User self-registration (admin creates all accounts)
- Bracket predictions (this is squares only)
- Multiple simultaneous pools (one pool per deployment)
- OAuth / social login (access codes only)
- Persistent database (JSON blob storage is sufficient)

---

## 14. Future Considerations (v2)

- Live score feed from ESPN/CBS/NCAA API (auto-update scores without admin entry)
- Shareable links to specific squares or leaderboard positions
- Push notifications when a game lands on your square
- Admin audit trail
- Bulk user import from CSV
- Auto-populate all 63 games from the official bracket
