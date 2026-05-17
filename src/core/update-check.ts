import fs from 'fs/promises'
import path from 'path'
import { camConfigDir, ensureDir, fileExists } from '../utils/fs.js'
import * as log from '../utils/log.js'

const REPO = 'ssyrell/coding-agent-account-manager'
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000
const FETCH_TIMEOUT_MS = 3000

interface UpdateCheckState {
  lastCheckedAt: string
  latestVersion?: string
}

function stateFilePath(): string {
  return path.join(camConfigDir(), 'update-check.json')
}

async function readState(): Promise<UpdateCheckState | null> {
  const fp = stateFilePath()
  if (!(await fileExists(fp))) return null
  try {
    const raw = await fs.readFile(fp, 'utf8')
    return JSON.parse(raw) as UpdateCheckState
  } catch {
    return null
  }
}

async function writeState(state: UpdateCheckState): Promise<void> {
  try {
    await ensureDir(camConfigDir())
    await fs.writeFile(stateFilePath(), JSON.stringify(state, null, 2) + '\n', 'utf8')
  } catch {
    // Never block on state-write failures.
  }
}

async function fetchLatestVersion(): Promise<string | null> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    const controller = new AbortController()
    timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    timeout.unref()
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'cam-cli',
      },
      signal: controller.signal,
    })
    if (!res.ok) return null
    const data = (await res.json()) as { tag_name?: string; name?: string }
    const tag = data.tag_name ?? data.name
    if (!tag) return null
    return tag.replace(/^v/, '').trim()
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Compare two semver-like strings. Returns >0 if a>b, <0 if a<b, 0 if equal.
 * Handles a trailing pre-release suffix (e.g. "1.2.3-beta.1") by treating
 * pre-release versions as older than their corresponding release version.
 */
export function compareSemver(a: string, b: string): number {
  const split = (v: string): { nums: number[]; pre: string | null } => {
    const [core, ...preParts] = v.split('-')
    const nums = core.split('.').map((n) => parseInt(n, 10) || 0)
    while (nums.length < 3) nums.push(0)
    return { nums, pre: preParts.length > 0 ? preParts.join('-') : null }
  }
  const av = split(a)
  const bv = split(b)
  for (let i = 0; i < 3; i++) {
    if (av.nums[i] !== bv.nums[i]) return av.nums[i] - bv.nums[i]
  }
  if (av.pre === bv.pre) return 0
  if (av.pre === null) return 1
  if (bv.pre === null) return -1
  return av.pre < bv.pre ? -1 : 1
}

/**
 * Returns the latest release tag if a newer version is available, or null
 * otherwise (including when the check is skipped due to the 24h throttle
 * or when the network/API call fails). Always records the check timestamp
 * so we don't hammer the GitHub API on repeated invocations.
 */
export async function checkForUpdate(
  currentVersion: string,
  now: number = Date.now()
): Promise<string | null> {
  const state = await readState()
  if (state) {
    const last = Date.parse(state.lastCheckedAt)
    if (!Number.isNaN(last) && now - last < CHECK_INTERVAL_MS) {
      return null
    }
  }

  const latest = await fetchLatestVersion()
  await writeState({
    lastCheckedAt: new Date(now).toISOString(),
    ...(latest ? { latestVersion: latest } : state?.latestVersion ? { latestVersion: state.latestVersion } : {}),
  })

  if (!latest) return null
  return compareSemver(latest, currentVersion) > 0 ? latest : null
}

/**
 * Wait for a single keypress on stdin. Resolves immediately if stdin is
 * not a TTY (e.g. piped input), so non-interactive callers don't hang.
 */
async function waitForKeypress(): Promise<void> {
  const stdin = process.stdin
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') return
  return new Promise((resolve) => {
    const wasRaw = stdin.isRaw
    stdin.setRawMode(true)
    stdin.resume()
    const onData = () => {
      stdin.off('data', onData)
      stdin.setRawMode(wasRaw)
      stdin.pause()
      resolve()
    }
    stdin.once('data', onData)
  })
}

/**
 * Display an update-available banner and block on a keypress so the message
 * isn't immediately wiped by an agent that clears the screen on launch.
 * In non-interactive contexts (no TTY) the banner is shown but the wait is
 * skipped.
 */
export async function notifyUpdateAvailable(
  currentVersion: string,
  latestVersion: string
): Promise<void> {
  console.log()
  log.warn(
    `A new version of cam is available: ${log.bold(latestVersion)} (current: ${currentVersion})`
  )
  log.info(`Update with: ${log.bold('npm install -g coding-agent-account-manager')}`)
  console.log()
  if (process.stdin.isTTY) {
    process.stdout.write('  Press any key to continue...')
    await waitForKeypress()
    process.stdout.write('\n\n')
  }
}

/**
 * Convenience wrapper that checks for an update and shows the notification
 * if one is available. Swallows all errors so update-check failures never
 * prevent a cam command from running.
 */
export async function runUpdateCheck(currentVersion: string): Promise<void> {
  try {
    const newer = await checkForUpdate(currentVersion)
    if (newer) await notifyUpdateAvailable(currentVersion, newer)
  } catch {
    // Never block command execution on update-check errors.
  }
}
