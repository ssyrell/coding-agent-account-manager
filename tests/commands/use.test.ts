import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockLaunch = vi.fn()
const mockDriver = { launch: mockLaunch }

vi.mock('../../src/core/config.js', () => ({
  getAccount: vi.fn(),
}))

vi.mock('../../src/agents/index.js', () => ({
  getDriver: vi.fn(),
}))

vi.mock('../../src/core/camrc.js', () => ({
  writeCamrc: vi.fn(),
}))

vi.mock('../../src/utils/fs.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/utils/fs.js')>()
  return { ...original, expandHome: (p: string) => p }
})

const { getAccount } = await import('../../src/core/config.js')
const { getDriver } = await import('../../src/agents/index.js')
const { writeCamrc } = await import('../../src/core/camrc.js')
const { use } = await import('../../src/commands/use.js')

const workAccount = { profileDir: '/home/u/.cam/claude/work', createdAt: '2026-01-01T00:00:00Z' }

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('process.exit') }) as never)
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.mocked(getDriver).mockReturnValue(mockDriver as never)
  vi.mocked(getAccount).mockResolvedValue(workAccount)
  vi.mocked(writeCamrc).mockResolvedValue('/cwd/.camrc')
})

describe('use', () => {
  it('launches the agent with the resolved profile dir', async () => {
    await use('claude', 'work', [])
    expect(mockLaunch).toHaveBeenCalledWith('/home/u/.cam/claude/work', [])
  })

  it('forwards extra args after prepending saved launchParams', async () => {
    vi.mocked(getAccount).mockResolvedValue({ ...workAccount, launchParams: ['--saved'] })
    await use('claude', 'work', ['--extra'])
    expect(mockLaunch).toHaveBeenCalledWith('/home/u/.cam/claude/work', ['--saved', '--extra'])
  })

  it('writes a .camrc when --always is set', async () => {
    await use('claude', 'work', [], { always: true })
    expect(writeCamrc).toHaveBeenCalledWith(process.cwd(), 'claude', 'work')
    expect(mockLaunch).toHaveBeenCalled()
  })

  it('does not write a .camrc when --always is omitted', async () => {
    await use('claude', 'work', [])
    expect(writeCamrc).not.toHaveBeenCalled()
  })

  it('exits when the account does not exist', async () => {
    vi.mocked(getAccount).mockResolvedValue(null)
    await expect(use('claude', 'missing', [])).rejects.toThrow('process.exit')
    expect(mockLaunch).not.toHaveBeenCalled()
  })

  it('exits when the agent driver is unknown', async () => {
    vi.mocked(getDriver).mockReturnValue(null)
    await expect(use('cursor', 'work', [])).rejects.toThrow('process.exit')
    expect(mockLaunch).not.toHaveBeenCalled()
  })
})
