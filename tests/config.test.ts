import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

let tmpDir: string

vi.mock('../src/utils/fs.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/utils/fs.js')>()
  return {
    ...original,
    camConfigDir: () => path.join(tmpDir, 'cam'),
    legacyCamConfigDir: () => path.join(tmpDir, 'legacy-cam'),
  }
})

const { loadConfig, saveConfig, addAccount, removeAccount, getAccount, accountExists, getDefault, setDefault, clearDefault, allAccounts } =
  await import('../src/core/config.js')

const ts = '2026-01-01T00:00:00Z'

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
    expect(config.version).toBe(2)
    expect(config.accounts).toEqual({})
  })

  it('saves and loads config round-trip', async () => {
    const config = {
      version: 2 as const,
      accounts: {
        claude: { work: { profileDir: '~/.cam/claude/work', createdAt: ts } },
      },
    }
    await saveConfig(config)
    const loaded = await loadConfig()
    expect(loaded.accounts['claude']!['work']).toEqual(config.accounts.claude.work)
  })

  it('addAccount persists a new account under its agent', async () => {
    await addAccount('claude', 'personal', { profileDir: '~/.cam/claude/personal', createdAt: ts })
    const account = await getAccount('claude', 'personal')
    expect(account).not.toBeNull()
    expect(account!.profileDir).toBe('~/.cam/claude/personal')
  })

  it('allows the same name under different agents', async () => {
    await addAccount('claude', 'work', { profileDir: '~/.cam/claude/work', createdAt: ts })
    await addAccount('copilot', 'work', { profileDir: '~/.cam/copilot/work', createdAt: ts })
    expect(await getAccount('claude', 'work')).not.toBeNull()
    expect(await getAccount('copilot', 'work')).not.toBeNull()
  })

  it('removeAccount deletes the account', async () => {
    await addAccount('claude', 'work', { profileDir: '~/.cam/claude/work', createdAt: ts })
    await removeAccount('claude', 'work')
    expect(await getAccount('claude', 'work')).toBeNull()
  })

  it('removeAccount cleans up an empty agent bucket', async () => {
    await addAccount('claude', 'work', { profileDir: '~/.cam/claude/work', createdAt: ts })
    await removeAccount('claude', 'work')
    const config = await loadConfig()
    expect(config.accounts['claude']).toBeUndefined()
  })

  it('accountExists returns true for known accounts', async () => {
    const config = {
      version: 2 as const,
      accounts: { claude: { work: { profileDir: '~/.cam/claude/work', createdAt: ts } } },
    }
    expect(accountExists(config, 'claude', 'work')).toBe(true)
    expect(accountExists(config, 'claude', 'missing')).toBe(false)
    expect(accountExists(config, 'copilot', 'work')).toBe(false)
  })

  it('getDefault returns null when no default is set', async () => {
    expect(await getDefault()).toBeNull()
  })

  it('setDefault persists the (agent, name) ref', async () => {
    await addAccount('claude', 'work', { profileDir: '~/.cam/claude/work', createdAt: ts })
    await setDefault('claude', 'work')
    expect(await getDefault()).toEqual({ agent: 'claude', name: 'work' })
  })

  it('setDefault overwrites a previously set default', async () => {
    await setDefault('claude', 'work')
    await setDefault('copilot', 'personal')
    expect(await getDefault()).toEqual({ agent: 'copilot', name: 'personal' })
  })

  it('clearDefault removes the default', async () => {
    await setDefault('claude', 'work')
    await clearDefault()
    expect(await getDefault()).toBeNull()
  })

  it('allAccounts flattens to a tuple list', async () => {
    await addAccount('claude', 'work', { profileDir: '/c/work', createdAt: ts })
    await addAccount('copilot', 'work', { profileDir: '/p/work', createdAt: ts })
    const config = await loadConfig()
    const flat = allAccounts(config)
    expect(flat).toHaveLength(2)
    expect(flat).toContainEqual({ agent: 'claude', name: 'work', account: { profileDir: '/c/work', createdAt: ts } })
    expect(flat).toContainEqual({ agent: 'copilot', name: 'work', account: { profileDir: '/p/work', createdAt: ts } })
  })
})
