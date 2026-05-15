import fs from 'fs/promises'
import path from 'path'
import { ensureDir, fileExists, symlinkIfMissing } from '../utils/fs.js'

/**
 * Create a profile directory at `profileDir`. For each entry in `sharedEntries`
 * that exists under `sourceConfigDir`, a symlink is created in the profile dir
 * pointing back to the source. Entries not present in the source are skipped.
 */
export async function createProfile(
  profileDir: string,
  sourceConfigDir: string,
  sharedEntries: string[]
): Promise<void> {
  await ensureDir(profileDir)

  for (const entry of sharedEntries) {
    const target = path.join(sourceConfigDir, entry)
    const link = path.join(profileDir, entry)

    if (await fileExists(target)) {
      await symlinkIfMissing(target, link)
    }
  }
}

export async function removeProfile(profileDir: string): Promise<void> {
  if (await fileExists(profileDir)) {
    await fs.rm(profileDir, { recursive: true, force: true })
  }
}
