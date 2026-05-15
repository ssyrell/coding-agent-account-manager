import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { createProfile, removeProfile } from '../src/core/profile-manager.js'

async function mkdtemp(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix))
}

describe('createProfile', () => {
  let profileDir: string
  let sourceDir: string

  beforeEach(async () => {
    profileDir = await mkdtemp('cam-profile-')
    sourceDir = await mkdtemp('cam-source-')
    await fs.rm(profileDir, { recursive: true, force: true })
  })

  afterEach(async () => {
    await fs.rm(profileDir, { recursive: true, force: true })
    await fs.rm(sourceDir, { recursive: true, force: true })
  })

  it('creates the profile directory', async () => {
    await createProfile(profileDir, sourceDir, [])
    const stat = await fs.stat(profileDir)
    expect(stat.isDirectory()).toBe(true)
  })

  it('creates symlinks for existing shared entries', async () => {
    await fs.writeFile(path.join(sourceDir, 'settings.json'), '{}')

    await createProfile(profileDir, sourceDir, ['settings.json'])

    const linkPath = path.join(profileDir, 'settings.json')
    const stat = await fs.lstat(linkPath)
    expect(stat.isSymbolicLink()).toBe(true)

    const target = await fs.readlink(linkPath)
    expect(target).toBe(path.join(sourceDir, 'settings.json'))
  })

  it('skips symlinks for entries that do not exist in source', async () => {
    await createProfile(profileDir, sourceDir, ['settings.json'])

    // settings.json was not created in sourceDir, so no symlink should exist
    const linkPath = path.join(profileDir, 'settings.json')
    try {
      await fs.lstat(linkPath)
      expect.fail('Should not exist')
    } catch (err: unknown) {
      expect((err as NodeJS.ErrnoException).code).toBe('ENOENT')
    }
  })

  it('does not overwrite existing symlinks on second call', async () => {
    await fs.writeFile(path.join(sourceDir, 'settings.json'), '{}')
    await createProfile(profileDir, sourceDir, ['settings.json'])
    // Should not throw
    await createProfile(profileDir, sourceDir, ['settings.json'])
  })

  it('only symlinks entries listed by the caller', async () => {
    await fs.writeFile(path.join(sourceDir, 'settings.json'), '{}')
    await fs.writeFile(path.join(sourceDir, 'other.json'), '{}')

    await createProfile(profileDir, sourceDir, ['settings.json'])

    expect((await fs.lstat(path.join(profileDir, 'settings.json'))).isSymbolicLink()).toBe(true)
    const otherExists = await fs
      .lstat(path.join(profileDir, 'other.json'))
      .then(() => true)
      .catch(() => false)
    expect(otherExists).toBe(false)
  })
})

describe('removeProfile', () => {
  it('removes an existing profile directory', async () => {
    const dir = await mkdtemp('cam-remove-')
    await removeProfile(dir)
    try {
      await fs.stat(dir)
      expect.fail('Should not exist')
    } catch (err: unknown) {
      expect((err as NodeJS.ErrnoException).code).toBe('ENOENT')
    }
  })

  it('does not throw when directory does not exist', async () => {
    await expect(removeProfile('/tmp/cam-nonexistent-xyz')).resolves.not.toThrow()
  })
})
