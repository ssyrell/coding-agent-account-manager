import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../../src/core/config.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/core/config.js')>()
  return {
    ...original,
    loadConfig: vi.fn(),
    getDefault: vi.fn(),
    setDefault: vi.fn(),
  }
})

const { loadConfig, getDefault, setDefault, accountExists } =
  await import('../../src/core/config.js')
const { setDefaultAccount } = await import('../../src/commands/default.js')

const baseAccount = { agent: 'claude', profileDir: '~/.claude-work', createdAt: '2026-01-01T00:00:00Z' }

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('process.exit') }) as never)
})

describe('setDefaultAccount', () => {
  describe('no name argument — show current default', () => {
    it('reports no default when none is set', async () => {
      vi.mocked(getDefault).mockResolvedValue(null)
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
      try {
        await setDefaultAccount(undefined)
      } finally {
        spy.mockRestore()
      }
      expect(setDefault).not.toHaveBeenCalled()
    })

    it('prints the current default when one is set', async () => {
      vi.mocked(getDefault).mockResolvedValue('work')
      const output: string[] = []
      const spy = vi.spyOn(console, 'log').mockImplementation((msg: string) => output.push(msg))
      try {
        await setDefaultAccount(undefined)
      } finally {
        spy.mockRestore()
      }
      expect(output[0]).toBe('work')
    })
  })

  describe('with a name argument — set default', () => {
    it('sets the default when the account exists', async () => {
      vi.mocked(loadConfig).mockResolvedValue({ version: 1, accounts: { work: baseAccount } })
      await setDefaultAccount('work')
      expect(setDefault).toHaveBeenCalledWith('work')
    })

    it('exits with error when the account does not exist', async () => {
      vi.mocked(loadConfig).mockResolvedValue({ version: 1, accounts: {} })
      await expect(setDefaultAccount('missing')).rejects.toThrow('process.exit')
      expect(setDefault).not.toHaveBeenCalled()
    })

    it('does not call setDefault for an unknown account', async () => {
      vi.mocked(loadConfig).mockResolvedValue({ version: 1, accounts: { work: baseAccount } })
      await expect(setDefaultAccount('personal')).rejects.toThrow('process.exit')
      expect(setDefault).not.toHaveBeenCalled()
    })
  })
})
