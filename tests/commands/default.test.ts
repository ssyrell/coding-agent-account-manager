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

const { loadConfig, getDefault, setDefault } = await import('../../src/core/config.js')
const { setDefaultAccount } = await import('../../src/commands/default.js')

const baseAccount = { profileDir: '~/.cam/claude/work', createdAt: '2026-01-01T00:00:00Z' }

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('process.exit') }) as never)
})

describe('setDefaultAccount', () => {
  describe('no arguments — show current default', () => {
    it('reports no default when none is set', async () => {
      vi.mocked(getDefault).mockResolvedValue(null)
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
      try {
        await setDefaultAccount(undefined, undefined)
      } finally {
        spy.mockRestore()
      }
      expect(setDefault).not.toHaveBeenCalled()
    })

    it('prints the current default as "<agent> <name>" when one is set', async () => {
      vi.mocked(getDefault).mockResolvedValue({ agent: 'claude', name: 'work' })
      const output: string[] = []
      const spy = vi.spyOn(console, 'log').mockImplementation((msg: string) => output.push(msg))
      try {
        await setDefaultAccount(undefined, undefined)
      } finally {
        spy.mockRestore()
      }
      expect(output[0]).toBe('claude work')
    })
  })

  describe('with both arguments — set default', () => {
    it('sets the default when the account exists', async () => {
      vi.mocked(loadConfig).mockResolvedValue({
        version: 2,
        accounts: { claude: { work: baseAccount } },
      })
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
      try {
        await setDefaultAccount('claude', 'work')
      } finally {
        spy.mockRestore()
      }
      expect(setDefault).toHaveBeenCalledWith('claude', 'work')
    })

    it('exits with error when the account does not exist', async () => {
      vi.mocked(loadConfig).mockResolvedValue({ version: 2, accounts: {} })
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const infoSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      try {
        await expect(setDefaultAccount('claude', 'missing')).rejects.toThrow('process.exit')
      } finally {
        errSpy.mockRestore()
        infoSpy.mockRestore()
      }
      expect(setDefault).not.toHaveBeenCalled()
    })

    it('exits when only the agent is supplied', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const infoSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      try {
        await expect(setDefaultAccount('claude', undefined)).rejects.toThrow('process.exit')
      } finally {
        errSpy.mockRestore()
        infoSpy.mockRestore()
      }
      expect(setDefault).not.toHaveBeenCalled()
    })
  })
})
