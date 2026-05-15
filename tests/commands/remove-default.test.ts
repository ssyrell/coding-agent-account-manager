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

const baseAccount = { profileDir: '~/.cam/claude/work', createdAt: '2026-01-01T00:00:00Z' }
const personalAccount = { profileDir: '~/.cam/claude/personal', createdAt: '2026-01-01T00:00:00Z' }
const twoAccounts = {
  claude: {
    work: baseAccount,
    personal: personalAccount,
  },
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
      version: 2,
      accounts: twoAccounts,
      default: { agent: 'claude', name: 'work' },
    })

    await remove('claude', 'work', { force: true })

    expect(clearDefault).toHaveBeenCalled()
    expect(removeAccount).toHaveBeenCalledWith('claude', 'work')
  })

  it('does not clear the default when a non-default account is removed', async () => {
    vi.mocked(loadConfig).mockResolvedValue({
      version: 2,
      accounts: twoAccounts,
      default: { agent: 'claude', name: 'personal' },
    })

    await remove('claude', 'work', { force: true })

    expect(clearDefault).not.toHaveBeenCalled()
    expect(removeAccount).toHaveBeenCalledWith('claude', 'work')
  })

  it('does not clear the default when no default is set', async () => {
    vi.mocked(loadConfig).mockResolvedValue({
      version: 2,
      accounts: twoAccounts,
    })

    await remove('claude', 'work', { force: true })

    expect(clearDefault).not.toHaveBeenCalled()
  })

  it('does not clear when the default has the same name under a different agent', async () => {
    vi.mocked(loadConfig).mockResolvedValue({
      version: 2,
      accounts: {
        claude: { work: baseAccount },
        copilot: { work: baseAccount },
      },
      default: { agent: 'copilot', name: 'work' },
    })

    await remove('claude', 'work', { force: true })

    expect(clearDefault).not.toHaveBeenCalled()
    expect(removeAccount).toHaveBeenCalledWith('claude', 'work')
  })

  it('exits with error when account does not exist', async () => {
    vi.mocked(loadConfig).mockResolvedValue({
      version: 2,
      accounts: { claude: { work: baseAccount } },
      default: { agent: 'claude', name: 'work' },
    })

    await expect(remove('claude', 'missing', { force: true })).rejects.toThrow('process.exit')
    expect(clearDefault).not.toHaveBeenCalled()
    expect(removeAccount).not.toHaveBeenCalled()
  })
})
