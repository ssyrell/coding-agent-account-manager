import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

let tmpHome: string

vi.mock('../../src/utils/fs.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/utils/fs.js')>()
  const pathMod = await import('path')
  return {
    ...original,
    homeDir: () => tmpHome,
    expandHome: (p: string) => {
      if (p.startsWith('~/') || p === '~') return pathMod.join(tmpHome, p.slice(2))
      return p
    },
    camConfigDir: () => pathMod.join(tmpHome, '.cam'),
    legacyCamConfigDir: () => pathMod.join(tmpHome, '.config', 'cam'),
  }
})

const { migrateIfNeeded } = await import('../../src/core/migrate.js')

const NEW = (...p: string[]) => path.join(tmpHome, '.cam', ...p)
const LEGACY = (...p: string[]) => path.join(tmpHome, '.config', 'cam', ...p)
const OLD_PROFILE = (filename: string) => path.join(tmpHome, filename)

async function readJson(p: string): Promise<unknown> {
  return JSON.parse(await fs.readFile(p, 'utf8'))
}

async function writeJson(p: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(p), { recursive: true })
  await fs.writeFile(p, JSON.stringify(value, null, 2) + '\n', 'utf8')
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

beforeEach(async () => {
  tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'cam-migrate-test-'))
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(async () => {
  await fs.rm(tmpHome, { recursive: true, force: true })
  vi.restoreAllMocks()
})

describe('migrateIfNeeded', () => {
  it('is a no-op when no config exists (fresh install)', async () => {
    await migrateIfNeeded()
    expect(await pathExists(NEW('accounts.json'))).toBe(false)
    expect(await pathExists(LEGACY('accounts.json'))).toBe(false)
  })

  it('is a no-op when ~/.cam/accounts.json is already at version 2', async () => {
    const existing = {
      version: 2,
      accounts: { work: { agent: 'claude', profileDir: NEW('claude', 'work'), createdAt: '2026-01-01T00:00:00Z' } },
    }
    await writeJson(NEW('accounts.json'), existing)
    await fs.mkdir(LEGACY(), { recursive: true })
    await writeJson(LEGACY('accounts.json'), { version: 1, accounts: { ghost: { agent: 'claude', profileDir: '~/.claude-ghost', createdAt: '2026-01-01T00:00:00Z' } } })

    await migrateIfNeeded()

    expect(await readJson(NEW('accounts.json'))).toEqual(existing)
    // Legacy file is left untouched when new file is already up to date.
    expect(await pathExists(LEGACY('accounts.json'))).toBe(true)
  })

  it('migrates v1 legacy config: moves profile dirs, rewrites paths, bumps version, cleans up legacy', async () => {
    await fs.mkdir(OLD_PROFILE('.claude-work'), { recursive: true })
    await fs.writeFile(path.join(OLD_PROFILE('.claude-work'), 'sentinel.txt'), 'work-data')
    await fs.mkdir(OLD_PROFILE('.copilot-personal'), { recursive: true })
    await fs.writeFile(path.join(OLD_PROFILE('.copilot-personal'), 'sentinel.txt'), 'personal-data')

    await writeJson(LEGACY('accounts.json'), {
      version: 1,
      default: 'work',
      accounts: {
        work: { agent: 'claude', profileDir: OLD_PROFILE('.claude-work'), createdAt: '2026-01-01T00:00:00Z' },
        personal: { agent: 'copilot', profileDir: OLD_PROFILE('.copilot-personal'), createdAt: '2026-01-02T00:00:00Z' },
      },
    })

    await migrateIfNeeded()

    const migrated = (await readJson(NEW('accounts.json'))) as {
      version: number
      default: string
      accounts: Record<string, { agent: string; profileDir: string; createdAt: string }>
    }
    expect(migrated.version).toBe(2)
    expect(migrated.default).toBe('work')
    expect(migrated.accounts['work']!.profileDir).toBe(NEW('claude', 'work'))
    expect(migrated.accounts['personal']!.profileDir).toBe(NEW('copilot', 'personal'))

    expect(await fs.readFile(NEW('claude', 'work', 'sentinel.txt'), 'utf8')).toBe('work-data')
    expect(await fs.readFile(NEW('copilot', 'personal', 'sentinel.txt'), 'utf8')).toBe('personal-data')

    expect(await pathExists(OLD_PROFILE('.claude-work'))).toBe(false)
    expect(await pathExists(OLD_PROFILE('.copilot-personal'))).toBe(false)
    expect(await pathExists(LEGACY('accounts.json'))).toBe(false)
  })

  it('handles profileDir paths with ~ prefix', async () => {
    await fs.mkdir(OLD_PROFILE('.claude-work'), { recursive: true })
    await fs.writeFile(path.join(OLD_PROFILE('.claude-work'), 'sentinel.txt'), 'data')

    await writeJson(LEGACY('accounts.json'), {
      version: 1,
      accounts: {
        work: { agent: 'claude', profileDir: '~/.claude-work', createdAt: '2026-01-01T00:00:00Z' },
      },
    })

    await migrateIfNeeded()

    expect(await fs.readFile(NEW('claude', 'work', 'sentinel.txt'), 'utf8')).toBe('data')
    expect(await pathExists(OLD_PROFILE('.claude-work'))).toBe(false)
  })

  it('warns and updates path when an account profile dir is missing on disk', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await writeJson(LEGACY('accounts.json'), {
      version: 1,
      accounts: {
        ghost: { agent: 'claude', profileDir: OLD_PROFILE('.claude-ghost'), createdAt: '2026-01-01T00:00:00Z' },
      },
    })

    await migrateIfNeeded()

    const migrated = (await readJson(NEW('accounts.json'))) as {
      accounts: Record<string, { profileDir: string }>
    }
    expect(migrated.accounts['ghost']!.profileDir).toBe(NEW('claude', 'ghost'))
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ghost'))
  })

  it('aborts before any moves when a destination already exists', async () => {
    await fs.mkdir(OLD_PROFILE('.claude-work'), { recursive: true })
    await fs.writeFile(path.join(OLD_PROFILE('.claude-work'), 'src.txt'), 'src')
    await fs.mkdir(NEW('claude', 'work'), { recursive: true })
    await fs.writeFile(path.join(NEW('claude', 'work'), 'preexisting.txt'), 'dest')

    const legacy = {
      version: 1,
      accounts: {
        work: { agent: 'claude', profileDir: OLD_PROFILE('.claude-work'), createdAt: '2026-01-01T00:00:00Z' },
      },
    }
    await writeJson(LEGACY('accounts.json'), legacy)

    await expect(migrateIfNeeded()).rejects.toThrow(/cam migration aborted/i)

    // Nothing should have moved or been overwritten.
    expect(await pathExists(OLD_PROFILE('.claude-work'))).toBe(true)
    expect(await fs.readFile(path.join(NEW('claude', 'work'), 'preexisting.txt'), 'utf8')).toBe('dest')
    expect(await readJson(LEGACY('accounts.json'))).toEqual(legacy)
    expect(await pathExists(NEW('accounts.json'))).toBe(false)
  })

  it('aborts when an account references an unknown agent', async () => {
    await writeJson(LEGACY('accounts.json'), {
      version: 1,
      accounts: {
        weird: { agent: 'cursor', profileDir: OLD_PROFILE('.cursor-weird'), createdAt: '2026-01-01T00:00:00Z' },
      },
    })

    await expect(migrateIfNeeded()).rejects.toThrow(/cam migration aborted/i)
    expect(await pathExists(NEW('accounts.json'))).toBe(false)
  })

  it('is safe to re-run after a partial migration (idempotent)', async () => {
    // Simulate: one profile already moved, but version field hasn't been bumped
    // and legacy accounts.json still exists. The first migration crashed before
    // writing the new accounts.json.
    await fs.mkdir(NEW('claude', 'work'), { recursive: true })
    await fs.writeFile(path.join(NEW('claude', 'work'), 'sentinel.txt'), 'work-data')
    await fs.mkdir(OLD_PROFILE('.copilot-personal'), { recursive: true })
    await fs.writeFile(path.join(OLD_PROFILE('.copilot-personal'), 'sentinel.txt'), 'personal-data')

    await writeJson(LEGACY('accounts.json'), {
      version: 1,
      accounts: {
        work: { agent: 'claude', profileDir: OLD_PROFILE('.claude-work'), createdAt: '2026-01-01T00:00:00Z' },
        personal: { agent: 'copilot', profileDir: OLD_PROFILE('.copilot-personal'), createdAt: '2026-01-02T00:00:00Z' },
      },
    })

    await migrateIfNeeded()

    const migrated = (await readJson(NEW('accounts.json'))) as {
      version: number
      accounts: Record<string, { profileDir: string }>
    }
    expect(migrated.version).toBe(2)
    expect(migrated.accounts['work']!.profileDir).toBe(NEW('claude', 'work'))
    expect(migrated.accounts['personal']!.profileDir).toBe(NEW('copilot', 'personal'))
    expect(await fs.readFile(NEW('claude', 'work', 'sentinel.txt'), 'utf8')).toBe('work-data')
    expect(await fs.readFile(NEW('copilot', 'personal', 'sentinel.txt'), 'utf8')).toBe('personal-data')
    expect(await pathExists(LEGACY('accounts.json'))).toBe(false)
  })
})
