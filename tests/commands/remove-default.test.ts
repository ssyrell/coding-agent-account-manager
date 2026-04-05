import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockTeardownProfile = vi.fn()

vi.mock('../../src/core/config.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/core/config.js')>()
  return {
    ...original,
    loadConfig: vi.fn(),
    removeAccount: vi.fn(),
    clearDefault: vi.fn(),
  }
})

vi.mock('../../src/agents/index.js', () => ({
  getDriver: vi.fn(),
}))

const { loadConfig, removeAccount, clearDefault } = await import('../../src/core/config.js')
const { getDriver } = await import('../../src/agents/index.js')
const { remove } = await import('../../src/commands/remove.js')

const baseAccount = { agent: 'claude', profileDir: '~/.claude-work', createdAt: '2026-01-01T00:00:00Z' }
const twoAccounts = {
  work: baseAccount,
  personal: { agent: 'claude', profileDir: '~/.claude-personal', createdAt: '2026-01-01T00:00:00Z' },
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.mocked(getDriver).mockReturnValue({ teardownProfile: mockTeardownProfile } as never)
  vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('process.exit') }) as never)
})

describe('remove — default account handling', () => {
  it('clears the default when the default account is removed', async () => {
    vi.mocked(loadConfig).mockResolvedValue({
      version: 1,
      accounts: twoAccounts,
      default: 'work',
    })

    await remove('work', { force: true })

    expect(clearDefault).toHaveBeenCalled()
    expect(removeAccount).toHaveBeenCalledWith('work')
  })

  it('does not clear the default when a non-default account is removed', async () => {
    vi.mocked(loadConfig).mockResolvedValue({
      version: 1,
      accounts: twoAccounts,
      default: 'personal',
    })

    await remove('work', { force: true })

    expect(clearDefault).not.toHaveBeenCalled()
    expect(removeAccount).toHaveBeenCalledWith('work')
  })

  it('does not clear the default when no default is set', async () => {
    vi.mocked(loadConfig).mockResolvedValue({
      version: 1,
      accounts: twoAccounts,
    })

    await remove('work', { force: true })

    expect(clearDefault).not.toHaveBeenCalled()
  })

  it('exits with error when account does not exist', async () => {
    vi.mocked(loadConfig).mockResolvedValue({
      version: 1,
      accounts: { work: baseAccount },
      default: 'work',
    })

    await expect(remove('missing', { force: true })).rejects.toThrow('process.exit')
    expect(clearDefault).not.toHaveBeenCalled()
    expect(removeAccount).not.toHaveBeenCalled()
  })
})
