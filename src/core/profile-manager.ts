import fs from 'fs/promises'
import path from 'path'
import { ensureDir, fileExists, homeDir, symlinkIfMissing } from '../utils/fs.js'

/**
 * Files/dirs inside ~/.claude/ that are shared across profiles via symlinks.
 * Auth state is intentionally excluded — it stays profile-specific.
 */
const SHARED_ENTRIES = [
  'settings.json',
  'hooks',
  'agents',
  'skills',
  'plugins',
  'keybindings.json',
]

/**
 * Create a profile directory at `profileDir` with symlinks pointing back to
 * the source Claude config dir for shared entries.
 */
export async function createProfile(profileDir: string, sourceConfigDir: string): Promise<void> {
  await ensureDir(profileDir)

  for (const entry of SHARED_ENTRIES) {
    const target = path.join(sourceConfigDir, entry)
    const link = path.join(profileDir, entry)

    if (await fileExists(target)) {
      await symlinkIfMissing(target, link)
    }
  }
}

/**
 * Remove a profile directory entirely.
 */
export async function removeProfile(profileDir: string): Promise<void> {
  if (await fileExists(profileDir)) {
    await fs.rm(profileDir, { recursive: true, force: true })
  }
}

/**
 * Return the default source Claude config directory (~/.claude).
 */
export function defaultClaudeConfigDir(): string {
  return path.join(homeDir(), '.claude')
}
