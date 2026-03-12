import { Octokit } from '@octokit/rest'
import { GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH, GITHUB_PAT, RAW_BASE } from './config'
import type { Config, User, Square, Game } from './types'

const octokit = new Octokit({ auth: GITHUB_PAT })

// === Reads (raw.githubusercontent.com, no auth needed) ===

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${RAW_BASE}/data/${path}?t=${Date.now()}`)
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`)
  return res.json()
}

export async function getConfig(): Promise<Config> {
  return fetchJson<Config>('config.json')
}

export async function getUsers(): Promise<User[]> {
  return fetchJson<User[]>('users.json')
}

export async function getSquares(): Promise<Square[]> {
  return fetchJson<Square[]>('squares.json')
}

export async function getGames(): Promise<Game[]> {
  return fetchJson<Game[]>('games.json')
}

export async function fetchAllData() {
  const [config, users, squares, games] = await Promise.all([
    getConfig(),
    getUsers(),
    getSquares(),
    getGames(),
  ])
  return { config, users, squares, games }
}

// === Writes (GitHub Contents API via Octokit) ===

interface FileInfo {
  sha: string
  content: string
}

async function getFile(path: string): Promise<FileInfo> {
  const { data } = await octokit.repos.getContent({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    path: `data/${path}`,
    ref: GITHUB_BRANCH,
  })
  if (Array.isArray(data) || data.type !== 'file') {
    throw new Error(`${path} is not a file`)
  }
  return {
    sha: data.sha,
    content: atob(data.content.replace(/\n/g, '')),
  }
}

async function writeFile(path: string, content: string, sha: string, message: string): Promise<void> {
  // Use TextEncoder for safe base64 encoding (handles unicode)
  const bytes = new TextEncoder().encode(content)
  const binStr = Array.from(bytes, b => String.fromCharCode(b)).join('')
  const b64 = btoa(binStr)

  await octokit.repos.createOrUpdateFileContents({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    path: `data/${path}`,
    message,
    content: b64,
    sha,
    branch: GITHUB_BRANCH,
  })
}

/** Read-modify-write with automatic retry on SHA conflict (up to 5 attempts) */
async function updateJsonFile<T>(
  path: string,
  updater: (current: T) => T,
  message: string
): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const file = await getFile(path)
      const current = JSON.parse(file.content) as T
      const updated = updater(current)
      await writeFile(path, JSON.stringify(updated, null, 2) + '\n', file.sha, message)
      return updated
    } catch (err: unknown) {
      const status = err && typeof err === 'object' && 'status' in err
        ? (err as { status: number }).status
        : 0
      // 409 = conflict, 422 = SHA mismatch — both mean stale SHA, retry
      if ((status === 409 || status === 422) && attempt < 4) {
        console.warn(`SHA conflict on ${path}, retrying (attempt ${attempt + 1})...`)
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
        continue
      }
      throw err
    }
  }
  throw new Error('Failed after 5 attempts')
}

// === Config writes ===

export async function updateConfig(updater: (c: Config) => Config): Promise<Config> {
  return updateJsonFile<Config>('config.json', updater, 'Update board config')
}

// === User writes ===

export async function saveUsers(updater: (users: User[]) => User[]): Promise<User[]> {
  return updateJsonFile<User[]>('users.json', updater, 'Update users')
}

// === Square writes ===

export async function saveSquares(updater: (squares: Square[]) => Square[]): Promise<Square[]> {
  return updateJsonFile<Square[]>('squares.json', updater, 'Update squares')
}

// === Game writes ===

export async function saveGames(updater: (games: Game[]) => Game[]): Promise<Game[]> {
  return updateJsonFile<Game[]>('games.json', updater, 'Update games')
}
