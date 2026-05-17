import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { EventEmitter } from 'events'

vi.mock('cross-spawn', () => ({
  default: vi.fn(),
}))

vi.mock('../../src/utils/fs.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/utils/fs.js')>()
  return { ...original, camConfigDir: vi.fn() }
})

const spawn = (await import('cross-spawn')).default
const { camConfigDir } = await import('../../src/utils/fs.js')
const { config } = await import('../../src/commands/config.js')

class FakeChild extends EventEmitter {}

let tmpDir: string
let originalVisual: string | undefined
let originalEditor: string | undefined

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cam-config-test-'))
  vi.mocked(camConfigDir).mockReturnValue(tmpDir)
  vi.mocked(spawn).mockReset()
  originalVisual = process.env.VISUAL
  originalEditor = process.env.EDITOR
  delete process.env.VISUAL
  delete process.env.EDITOR
})

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
  if (originalVisual !== undefined) process.env.VISUAL = originalVisual
  else delete process.env.VISUAL
  if (originalEditor !== undefined) process.env.EDITOR = originalEditor
  else delete process.env.EDITOR
})

function mockSpawnSuccess(): void {
  vi.mocked(spawn).mockImplementation(() => {
    const child = new FakeChild()
    process.nextTick(() => child.emit('close', 0))
    return child as never
  })
}

function mockSpawnExit(code: number): void {
  vi.mocked(spawn).mockImplementation(() => {
    const child = new FakeChild()
    process.nextTick(() => child.emit('close', code))
    return child as never
  })
}

function mockSpawnError(err: Error): void {
  vi.mocked(spawn).mockImplementation(() => {
    const child = new FakeChild()
    process.nextTick(() => child.emit('error', err))
    return child as never
  })
}

describe('config command', () => {
  it('opens the accounts.json file in $VISUAL when set', async () => {
    process.env.VISUAL = 'my-visual-editor'
    process.env.EDITOR = 'my-fallback-editor'
    mockSpawnSuccess()

    await config()

    const [binary, args] = vi.mocked(spawn).mock.calls[0]!
    expect(binary).toBe('my-visual-editor')
    expect(args).toEqual([path.join(tmpDir, 'accounts.json')])
  })

  it('falls back to $EDITOR when $VISUAL is unset', async () => {
    process.env.EDITOR = 'my-editor'
    mockSpawnSuccess()

    await config()

    expect(vi.mocked(spawn).mock.calls[0]![0]).toBe('my-editor')
  })

  it('splits $VISUAL into command and args (e.g. "code --wait")', async () => {
    process.env.VISUAL = 'code --wait'
    mockSpawnSuccess()

    await config()

    const [binary, args] = vi.mocked(spawn).mock.calls[0]!
    expect(binary).toBe('code')
    expect(args).toEqual(['--wait', path.join(tmpDir, 'accounts.json')])
  })

  describe('platform fallbacks (no $VISUAL or $EDITOR)', () => {
    let platformSpy: ReturnType<typeof vi.spyOn>

    afterEach(() => platformSpy.mockRestore())

    it('uses "open" on macOS', async () => {
      platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin')
      mockSpawnSuccess()

      await config()

      const [binary, args] = vi.mocked(spawn).mock.calls[0]!
      expect(binary).toBe('open')
      expect(args).toEqual([path.join(tmpDir, 'accounts.json')])
    })

    it('uses "xdg-open" on Linux', async () => {
      platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('linux')
      mockSpawnSuccess()

      await config()

      const [binary, args] = vi.mocked(spawn).mock.calls[0]!
      expect(binary).toBe('xdg-open')
      expect(args).toEqual([path.join(tmpDir, 'accounts.json')])
    })

    it('uses "cmd /c start" on Windows', async () => {
      platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
      mockSpawnSuccess()

      await config()

      const [binary, args] = vi.mocked(spawn).mock.calls[0]!
      expect(binary).toBe('cmd')
      expect(args).toEqual(['/c', 'start', '', path.join(tmpDir, 'accounts.json')])
    })
  })

  it('creates the cam config directory if it does not exist', async () => {
    const nestedDir = path.join(tmpDir, 'nested', 'cam')
    vi.mocked(camConfigDir).mockReturnValue(nestedDir)
    mockSpawnSuccess()

    await config()

    const stat = await fs.stat(nestedDir)
    expect(stat.isDirectory()).toBe(true)
  })

  it('calls process.exit with the editor exit code on non-zero close', async () => {
    const child = new FakeChild()
    vi.mocked(spawn).mockReturnValue(child as never)
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never)
    vi.spyOn(console, 'error').mockImplementation(() => {})

    void config()
    while (vi.mocked(spawn).mock.calls.length === 0) {
      await new Promise((r) => setImmediate(r))
    }
    child.emit('close', 3)

    expect(exitSpy).toHaveBeenCalledWith(3)
    exitSpy.mockRestore()
  })

  it('rejects when the editor process errors', async () => {
    mockSpawnError(new Error('boom'))

    await expect(config()).rejects.toThrow('boom')
  })
})
