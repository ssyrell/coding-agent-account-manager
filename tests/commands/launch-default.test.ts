import { describe, it, expect, beforeEach, vi } from 'vitest'
import type readline from 'readline/promises'

const mockDriverLaunch = vi.fn()
const mockDriver = { launch: mockDriverLaunch }

vi.mock('readline/promises', () => ({
  default: { createInterface: vi.fn() },
}))

vi.mock('../../src/core/camrc.js', () => ({
  findCamrc: vi.fn(),
}))

vi.mock('../../src/core/config.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/core/config.js')>()
  return {
    ...original,
    loadConfig: vi.fn(),
    getAccount: vi.fn(),
    setDefault: vi.fn(),
  }
})

vi.mock('../../src/agents/index.js', () => ({
  getDriver: vi.fn(),
}))

vi.mock('../../src/utils/fs.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/utils/fs.js')>()
  return { ...original, expandHome: (p: string) => p }
})

const rl = await import('readline/promises')
const { findCamrc } = await import('../../src/core/camrc.js')
const { loadConfig, getAccount, setDefault } = await import('../../src/core/config.js')
const { getDriver } = await import('../../src/agents/index.js')
const { launch } = await import('../../src/commands/launch.js')

const baseAccount = { agent: 'claude', profileDir: '~/.claude-work', createdAt: '2026-01-01T00:00:00Z' }

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
})

describe('launch — default account fallback', () => {
  it('uses the configured default when no .camrc is found', async () => {
    vi.mocked(findCamrc).mockResolvedValue(null)
    vi.mocked(loadConfig).mockResolvedValue({
      version: 1,
      accounts: { work: baseAccount },
      default: 'work',
    })
    vi.mocked(getAccount).mockResolvedValue(baseAccount)

    await launch([])

    expect(mockDriverLaunch).toHaveBeenCalledWith('~/.claude-work', [])
    expect(rl.default.createInterface).not.toHaveBeenCalled()
  })

  it('forwards extra args to the driver when using the default', async () => {
    vi.mocked(findCamrc).mockResolvedValue(null)
    vi.mocked(loadConfig).mockResolvedValue({
      version: 1,
      accounts: { work: baseAccount },
      default: 'work',
    })
    vi.mocked(getAccount).mockResolvedValue(baseAccount)

    await launch(['--dangerously-skip-permissions'])

    expect(mockDriverLaunch).toHaveBeenCalledWith('~/.claude-work', ['--dangerously-skip-permissions'])
  })

  it('falls through to prompt when default points to a deleted account', async () => {
    vi.mocked(findCamrc).mockResolvedValue(null)
    vi.mocked(loadConfig).mockResolvedValue({
      version: 1,
      // 'old' is the stale default — it's gone from accounts
      accounts: { work: baseAccount },
      default: 'old',
    })
    vi.mocked(getAccount).mockResolvedValue(baseAccount)
    const mockRl = makeRl(['1', 'n'])
    vi.mocked(rl.default.createInterface).mockReturnValue(mockRl as never)

    await launch([])

    // Prompt was shown because default was stale
    expect(rl.default.createInterface).toHaveBeenCalled()
    expect(mockDriverLaunch).toHaveBeenCalledWith('~/.claude-work', [])
  })

  it('exits with error when no default and no accounts configured', async () => {
    vi.mocked(findCamrc).mockResolvedValue(null)
    vi.mocked(loadConfig).mockResolvedValue({ version: 1, accounts: {} })

    await expect(launch([])).rejects.toThrow('process.exit')
    expect(mockDriverLaunch).not.toHaveBeenCalled()
  })

  describe('interactive prompt — no default set', () => {
    beforeEach(() => {
      vi.mocked(findCamrc).mockResolvedValue(null)
      vi.mocked(loadConfig).mockResolvedValue({
        version: 1,
        accounts: {
          personal: { agent: 'claude', profileDir: '~/.claude-personal', createdAt: '2026-01-01T00:00:00Z' },
          work: baseAccount,
        },
      })
    })

    it('launches the selected account when user picks by number', async () => {
      vi.mocked(getAccount).mockResolvedValue(baseAccount)
      const mockRl = makeRl(['2', 'n'])
      vi.mocked(rl.default.createInterface).mockReturnValue(mockRl as never)

      await launch([])

      expect(mockDriverLaunch).toHaveBeenCalledWith('~/.claude-work', [])
    })

    it('defaults to the first account when user presses enter', async () => {
      const personalAccount = { agent: 'claude', profileDir: '~/.claude-personal', createdAt: '2026-01-01T00:00:00Z' }
      vi.mocked(getAccount).mockResolvedValue(personalAccount)
      const mockRl = makeRl(['', 'n'])
      vi.mocked(rl.default.createInterface).mockReturnValue(mockRl as never)

      await launch([])

      expect(mockDriverLaunch).toHaveBeenCalledWith('~/.claude-personal', [])
    })

    it('launches the selected account when user types a name directly', async () => {
      vi.mocked(getAccount).mockResolvedValue(baseAccount)
      const mockRl = makeRl(['work', 'n'])
      vi.mocked(rl.default.createInterface).mockReturnValue(mockRl as never)

      await launch([])

      expect(mockDriverLaunch).toHaveBeenCalledWith('~/.claude-work', [])
    })

    it('saves the default when user answers yes', async () => {
      vi.mocked(getAccount).mockResolvedValue(baseAccount)
      const mockRl = makeRl(['2', 'y'])
      vi.mocked(rl.default.createInterface).mockReturnValue(mockRl as never)

      await launch([])

      expect(setDefault).toHaveBeenCalledWith('work')
    })

    it('does not save the default when user answers no', async () => {
      vi.mocked(getAccount).mockResolvedValue(baseAccount)
      const mockRl = makeRl(['2', 'n'])
      vi.mocked(rl.default.createInterface).mockReturnValue(mockRl as never)

      await launch([])

      expect(setDefault).not.toHaveBeenCalled()
    })

    it('re-prompts on an invalid number', async () => {
      vi.mocked(getAccount).mockResolvedValue(baseAccount)
      // First answer is out of range, second is valid
      const mockRl = makeRl(['99', '2', 'n'])
      vi.mocked(rl.default.createInterface).mockReturnValue(mockRl as never)

      await launch([])

      expect(mockRl.question).toHaveBeenCalledTimes(3)
      expect(mockDriverLaunch).toHaveBeenCalledWith('~/.claude-work', [])
    })
  })
})
