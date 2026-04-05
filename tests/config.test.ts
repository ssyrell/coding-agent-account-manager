import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

// We need to override camConfigDir to use a temp directory for tests
let tmpDir: string

vi.mock('../src/utils/fs.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/utils/fs.js')>()
  return {
    ...original,
    camConfigDir: () => path.join(tmpDir, 'cam'),
  }
})

// Import after mock is set up
const { loadConfig, saveConfig, addAccount, removeAccount, getAccount, accountExists, getDefault, setDefault, clearDefault } =
  await import('../src/core/config.js')

describe('config', () => {
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cam-config-test-'))
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
    vi.clearAllMocks()
  })

  it('returns empty config when no file exists', async () => {
    const config = await loadConfig()
    expect(config.version).toBe(1)
    expect(config.accounts).toEqual({})
  })

  it('saves and loads config round-trip', async () => {
    const config = { version: 1 as const, accounts: { work: { agent: 'claude', profileDir: '~/.claude-work', createdAt: '2026-01-01T00:00:00Z' } } }
    await saveConfig(config)
    const loaded = await loadConfig()
    expect(loaded.accounts['work']).toEqual(config.accounts['work'])
  })

  it('addAccount persists a new account', async () => {
    await addAccount('personal', { agent: 'claude', profileDir: '~/.claude-personal', createdAt: '2026-01-01T00:00:00Z' })
    const account = await getAccount('personal')
    expect(account).not.toBeNull()
    expect(account!.agent).toBe('claude')
  })

  it('removeAccount deletes the account', async () => {
    await addAccount('work', { agent: 'claude', profileDir: '~/.claude-work', createdAt: '2026-01-01T00:00:00Z' })
    await removeAccount('work')
    const account = await getAccount('work')
    expect(account).toBeNull()
  })

  it('accountExists returns true for known accounts', async () => {
    const config = { version: 1 as const, accounts: { work: { agent: 'claude', profileDir: '~/.claude-work', createdAt: '2026-01-01T00:00:00Z' } } }
    expect(accountExists(config, 'work')).toBe(true)
    expect(accountExists(config, 'missing')).toBe(false)
  })

  it('getDefault returns null when no default is set', async () => {
    expect(await getDefault()).toBeNull()
  })

  it('setDefault persists the default account name', async () => {
    await addAccount('work', { agent: 'claude', profileDir: '~/.claude-work', createdAt: '2026-01-01T00:00:00Z' })
    await setDefault('work')
    expect(await getDefault()).toBe('work')
  })

  it('setDefault overwrites a previously set default', async () => {
    await setDefault('work')
    await setDefault('personal')
    expect(await getDefault()).toBe('personal')
  })

  it('clearDefault removes the default', async () => {
    await setDefault('work')
    await clearDefault()
    expect(await getDefault()).toBeNull()
  })

  it('clearDefault is a no-op when no default is set', async () => {
    await expect(clearDefault()).resolves.not.toThrow()
    expect(await getDefault()).toBeNull()
  })
})
