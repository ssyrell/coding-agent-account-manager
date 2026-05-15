import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockSetupProfile = vi.fn()
const mockGetProfileDir = vi.fn()
const mockDriver = { setupProfile: mockSetupProfile, getProfileDir: mockGetProfileDir }

vi.mock('readline/promises', () => ({
  default: { createInterface: vi.fn() },
}))

vi.mock('../../src/core/config.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/core/config.js')>()
  return {
    ...original,
    loadConfig: vi.fn(),
    addAccount: vi.fn(),
  }
})

vi.mock('../../src/agents/index.js', () => ({
  getDriver: vi.fn(),
  listDrivers: vi.fn(() => ['claude', 'copilot']),
}))

vi.mock('../../src/core/camrc.js', () => ({
  writeCamrc: vi.fn(),
}))

const rl = await import('readline/promises')
const { loadConfig, addAccount } = await import('../../src/core/config.js')
const { getDriver } = await import('../../src/agents/index.js')
const { writeCamrc } = await import('../../src/core/camrc.js')
const { add } = await import('../../src/commands/add.js')

function makeRl(answers: string[]) {
  const question = vi.fn()
  answers.forEach((a) => question.mockResolvedValueOnce(a))
  return { question, close: vi.fn() }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('process.exit') }) as never)
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.mocked(getDriver).mockReturnValue(mockDriver as never)
  vi.mocked(loadConfig).mockResolvedValue({ version: 2, accounts: {} })
  mockGetProfileDir.mockReturnValue('/home/u/.cam/claude/work')
  vi.mocked(writeCamrc).mockResolvedValue('/cwd/.camrc')
})

describe('add', () => {
  it('creates the profile and persists the account', async () => {
    const mockRl = makeRl(['n'])
    vi.mocked(rl.default.createInterface).mockReturnValue(mockRl as never)

    await add('claude', 'work')

    expect(mockSetupProfile).toHaveBeenCalledWith('work')
    expect(addAccount).toHaveBeenCalledWith('claude', 'work', expect.objectContaining({
      profileDir: '/home/u/.cam/claude/work',
    }))
  })

  it('exits when the agent is unknown', async () => {
    vi.mocked(getDriver).mockReturnValue(null)
    await expect(add('cursor', 'work')).rejects.toThrow('process.exit')
    expect(mockSetupProfile).not.toHaveBeenCalled()
    expect(addAccount).not.toHaveBeenCalled()
  })

  it('exits when an account with the same (agent, name) already exists', async () => {
    vi.mocked(loadConfig).mockResolvedValue({
      version: 2,
      accounts: {
        claude: { work: { profileDir: '/x', createdAt: 'x' } },
      },
    })
    await expect(add('claude', 'work')).rejects.toThrow('process.exit')
    expect(mockSetupProfile).not.toHaveBeenCalled()
  })

  it('allows the same name under a different agent', async () => {
    vi.mocked(loadConfig).mockResolvedValue({
      version: 2,
      accounts: {
        claude: { work: { profileDir: '/x', createdAt: 'x' } },
      },
    })
    const mockRl = makeRl(['n'])
    vi.mocked(rl.default.createInterface).mockReturnValue(mockRl as never)

    await add('copilot', 'work')

    expect(mockSetupProfile).toHaveBeenCalledWith('work')
    expect(addAccount).toHaveBeenCalledWith('copilot', 'work', expect.anything())
  })

  it('saves launchParams when provided', async () => {
    const mockRl = makeRl(['n'])
    vi.mocked(rl.default.createInterface).mockReturnValue(mockRl as never)

    await add('claude', 'work', ['--foo', '--bar'])

    expect(addAccount).toHaveBeenCalledWith('claude', 'work', expect.objectContaining({
      launchParams: ['--foo', '--bar'],
    }))
  })

  it('prompts to create a .camrc and writes it when user answers yes', async () => {
    const mockRl = makeRl(['y'])
    vi.mocked(rl.default.createInterface).mockReturnValue(mockRl as never)

    await add('claude', 'work')

    expect(writeCamrc).toHaveBeenCalledWith(process.cwd(), 'claude', 'work')
  })

  it('does not write a .camrc when the user declines', async () => {
    const mockRl = makeRl(['n'])
    vi.mocked(rl.default.createInterface).mockReturnValue(mockRl as never)

    await add('claude', 'work')

    expect(writeCamrc).not.toHaveBeenCalled()
  })
})
