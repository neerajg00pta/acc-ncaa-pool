# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

March Madness Squares Pool — a web app for running a 10x10 squares pool across all 63 NCAA tournament games. Deployed to GitHub Pages at `neerajg00pta.github.io/acc-ncaa-pool/`. See `functional-spec.md` for the complete specification.

## Commands

```bash
npm run dev      # Start dev server (Vite)
npm run build    # TypeScript check + Vite build (output: dist/)
npm run lint     # ESLint
npm run preview  # Preview production build locally
```

## Architecture

### Stack
- **Frontend:** React 19 + TypeScript, Vite 8, React Router
- **Hosting:** GitHub Pages (static files only)
- **Data:** "Git as DB" — JSON files in `data/` committed to the repo, read/written via GitHub Contents API (`@octokit/rest`)

### Git-as-DB Pattern

All persistent state lives in JSON files under `data/`:
- `data/config.json` — board lock status, max squares per person, row/column number assignments
- `data/users.json` — user accounts (name, access code, admin flag, paid flag)
- `data/squares.json` — square ownership (row-col ID, owner user ID, claimed timestamp)
- `data/games.json` — tournament games (teams, round, scores, status)

**Reads:** Fetch raw JSON from `https://raw.githubusercontent.com/neerajg00pta/acc-ncaa-pool/main/data/...` (no auth needed, public repo). Cache-bust with `?t=timestamp` for polling.

**Writes (admin only):** Use GitHub Contents API to read-then-update JSON files. Requires a GitHub Personal Access Token (PAT) stored in the admin's browser localStorage. Writes go through `@octokit/rest` which handles the SHA-based optimistic concurrency.

**Polling:** The grid and leaderboard re-fetch data every 10 seconds from raw GitHub content.

### Authentication

No passwords. Admin creates users with access codes (e.g., `john123`). Players enter their code on the home page. The app fetches `users.json`, checks the code, and stores the session in localStorage (30-day expiry). Admin users get redirected to `/admin`.

URL parameter `?token=xxx` auto-submits the code on load for one-click links.

### Routing

- `/` — Login (if no session) or Grid + Leaderboard (if logged in)
- `/admin` — Admin panel (board controls, user management)
- `/admin/games` — Game management (create games, enter scores)

### GitHub Pages Deployment

- Vite `base` is set to `/acc-ncaa-pool/` to match the repo name
- GitHub Actions workflow in `.github/workflows/deploy.yml` builds and deploys on push to `main`
- React Router must use `HashRouter` (not `BrowserRouter`) since GitHub Pages doesn't support SPA fallback routing

### Score-to-Square Mapping

Winner's last digit → column, Loser's last digit → row. The row/column numbers on the axes are randomized by the admin (Fisher-Yates shuffle). The mapping uses the *assigned* axis numbers, not the grid indices.

### Payout Calculation

Payouts by round: R64=$50, R32=$100, S16=$200, E8=$400, F4=$800, Championship=$1600. Total pool: $6,300. If a game lands on an unclaimed square, no payout (house keeps it).
