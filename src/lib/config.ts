export const GITHUB_OWNER = 'neerajg00pta'
export const GITHUB_REPO = 'acc-ncaa-pool'
export const GITHUB_BRANCH = 'main'
export const GITHUB_PAT = import.meta.env.VITE_GITHUB_PAT as string

export const RAW_BASE = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}`

export const POLL_INTERVAL_MS = 10_000
export const SESSION_COOKIE_NAME = 'acc_pool_session'
export const SESSION_EXPIRY_DAYS = 30
