import fs from 'fs/promises'
import path from 'path'
import { camConfigDir, ensureDir, expandHome, fileExists, legacyCamConfigDir } from '../utils/fs.js'
import { getDriver } from '../agents/index.js'
import type { CamConfig } from './config.js'

const CURRENT_VERSION = 2

interface V1Account {
  agent: string
  profileDir: string
  createdAt: string
  launchParams?: string[]
}

interface V1Config {
  version: 1
  accounts: Record<string, V1Account>
  default?: string
}

function newAccountsFile(): string {
  return path.join(camConfigDir(), 'accounts.json')
}

function legacyAccountsFile(): string {
  return path.join(legacyCamConfigDir(), 'accounts.json')
}

async function readJson<T>(filePath: string): Promise<T | null> {
  if (!(await fileExists(filePath))) return null
  const raw = await fs.readFile(filePath, 'utf8')
  return JSON.parse(raw) as T
}

/**
 * Migrate cam data from the v1 layout — XDG accounts.json with a flat
 * `accounts: Record<name, { agent, profileDir, ... }>` shape and per-agent
 * profile dirs at the home root (`~/.<agent>-<name>/`) — to the v2 layout:
 * `~/.cam/accounts.json` with `accounts: Record<agent, Record<name, ...>>`
 * and profile dirs nested under `~/.cam/<agent>/<name>/`.
 *
 * Safe to call on every cam invocation: the fast path is a single existence
 * check + small read when already on v2, and the no-op path returns early when
 * nothing on disk needs touching.
 */
export async function migrateIfNeeded(): Promise<void> {
  const newFile = newAccountsFile()
  const legacyFile = legacyAccountsFile()

  const newConfig = await readJson<{ version: number }>(newFile)
  if (newConfig && newConfig.version >= CURRENT_VERSION) return

  const v1 = await readJson<V1Config>(legacyFile)
  if (!v1) return

  // Pre-flight: detect problems without mutating anything.
  const collisions: string[] = []
  const unknownAgents: string[] = []
  const plan: Array<{
    name: string
    agent: string
    oldDir: string
    newDir: string
    sourceExists: boolean
    account: V1Account
  }> = []

  for (const [name, account] of Object.entries(v1.accounts)) {
    const driver = getDriver(account.agent)
    if (!driver) {
      unknownAgents.push(`${name} (agent: ${account.agent})`)
      continue
    }
    const oldDir = expandHome(account.profileDir)
    const newDir = driver.getProfileDir(name)
    const sourceExists = await fileExists(oldDir)
    if (sourceExists && oldDir !== newDir && (await fileExists(newDir))) {
      collisions.push(`${name}: cannot move ${oldDir} → ${newDir} (destination already exists)`)
    }
    plan.push({ name, agent: account.agent, oldDir, newDir, sourceExists, account })
  }

  if (unknownAgents.length > 0 || collisions.length > 0) {
    const lines = ['cam migration aborted:']
    if (unknownAgents.length > 0) {
      lines.push('  Unknown agent types:')
      for (const u of unknownAgents) lines.push(`    - ${u}`)
    }
    if (collisions.length > 0) {
      lines.push('  Profile directory collisions:')
      for (const c of collisions) lines.push(`    - ${c}`)
    }
    throw new Error(lines.join('\n'))
  }

  // Mutation pass.
  const migrated: CamConfig = { version: CURRENT_VERSION, accounts: {} }

  for (const { name, agent, oldDir, newDir, sourceExists, account } of plan) {
    if (sourceExists && oldDir !== newDir) {
      await ensureDir(path.dirname(newDir))
      try {
        await fs.rename(oldDir, newDir)
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'EXDEV') {
          await fs.cp(oldDir, newDir, { recursive: true })
          await fs.rm(oldDir, { recursive: true, force: true })
        } else {
          throw err
        }
      }
    } else if (!sourceExists) {
      console.warn(
        `cam migration: profile directory for "${name}" not found at ${oldDir} — skipping move, updating path only.`
      )
    }
    if (!migrated.accounts[agent]) migrated.accounts[agent] = {}
    migrated.accounts[agent][name] = {
      profileDir: newDir,
      createdAt: account.createdAt,
      ...(account.launchParams?.length ? { launchParams: account.launchParams } : {}),
    }
  }

  if (v1.default) {
    const defaultEntry = plan.find((p) => p.name === v1.default)
    if (defaultEntry) {
      migrated.default = { agent: defaultEntry.agent, name: defaultEntry.name }
    }
  }

  await ensureDir(camConfigDir())
  await fs.writeFile(newFile, JSON.stringify(migrated, null, 2) + '\n', 'utf8')

  // Best-effort cleanup of the legacy location.
  if (await fileExists(legacyFile)) {
    await fs.rm(legacyFile, { force: true })
    try {
      await fs.rmdir(legacyCamConfigDir())
    } catch {
      // ENOTEMPTY or similar — leave the dir alone if it has other contents.
    }
  }
}
