import fs from 'fs/promises'
import path from 'path'
import { camConfigDir, ensureDir, expandHome, fileExists, legacyCamConfigDir } from '../utils/fs.js'
import { getDriver } from '../agents/index.js'
import type { CamConfig } from './config.js'

const CURRENT_VERSION = 2

function newAccountsFile(): string {
  return path.join(camConfigDir(), 'accounts.json')
}

function legacyAccountsFile(): string {
  return path.join(legacyCamConfigDir(), 'accounts.json')
}

async function readConfigFile(filePath: string): Promise<CamConfig | null> {
  if (!(await fileExists(filePath))) return null
  const raw = await fs.readFile(filePath, 'utf8')
  return JSON.parse(raw) as CamConfig
}

/**
 * Migrate cam data from the v1 layout (XDG accounts.json + ~/.<agent>-<name>
 * profile dirs at home root) to the v2 layout (~/.cam/accounts.json +
 * ~/.cam/<agent>/<name>/ profile dirs).
 *
 * Safe to call on every cam invocation: the fast path is a single existence
 * check + small read when already on v2, and the no-op path returns early when
 * nothing on disk needs touching.
 */
export async function migrateIfNeeded(): Promise<void> {
  const newFile = newAccountsFile()
  const legacyFile = legacyAccountsFile()

  const newConfig = await readConfigFile(newFile)
  if (newConfig && newConfig.version >= CURRENT_VERSION) return

  const sourceConfig = newConfig ?? (await readConfigFile(legacyFile))
  if (!sourceConfig) return

  // Pre-flight: detect problems without mutating anything.
  const collisions: string[] = []
  const unknownAgents: string[] = []
  const plan: Array<{ name: string; oldDir: string; newDir: string; sourceExists: boolean }> = []

  for (const [name, account] of Object.entries(sourceConfig.accounts)) {
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
    plan.push({ name, oldDir, newDir, sourceExists })
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
  const migrated: CamConfig = { ...sourceConfig, accounts: { ...sourceConfig.accounts } }
  for (const { name, oldDir, newDir, sourceExists } of plan) {
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
    migrated.accounts[name] = { ...migrated.accounts[name]!, profileDir: newDir }
  }

  migrated.version = CURRENT_VERSION
  await ensureDir(camConfigDir())
  await fs.writeFile(newFile, JSON.stringify(migrated, null, 2) + '\n', 'utf8')

  // Best-effort cleanup of the legacy location. Only touch it if it was the
  // source — don't blow away a legacy file the user kept around for some reason
  // if they'd already partially migrated to the new location.
  if (!newConfig && (await fileExists(legacyFile))) {
    await fs.rm(legacyFile, { force: true })
    try {
      await fs.rmdir(legacyCamConfigDir())
    } catch {
      // ENOTEMPTY or similar — leave the dir alone if it has other contents.
    }
  }
}
