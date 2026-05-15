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
  const pathMod = await import('path')
  const homeDir = vi.fn()
  return {
    ...original,
    homeDir,
    camConfigDir: () => pathMod.join(homeDir(), '.cam'),
  }
})

const spawn = (await import('cross-spawn')).default
const { homeDir } = await import('../../src/utils/fs.js')
const { CopilotDriver } = await import('../../src/agents/copilot.js')

class FakeChild extends EventEmitter {}

let tmpHome: string

beforeEach(async () => {
  tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'cam-copilot-test-'))
  vi.mocked(homeDir).mockReturnValue(tmpHome)
  vi.mocked(spawn).mockReset()
})

afterEach(async () => {
  await fs.rm(tmpHome, { recursive: true, force: true })
})

describe('CopilotDriver', () => {
  describe('getProfileDir', () => {
    it('returns ~/.cam/copilot/<name>', () => {
      const driver = new CopilotDriver()
      expect(driver.getProfileDir('work')).toBe(path.join(tmpHome, '.cam', 'copilot', 'work'))
    })
  })

  describe('setupProfile', () => {
    it('creates the profile directory', async () => {
      const driver = new CopilotDriver()
      await driver.setupProfile('work')
      const stat = await fs.stat(path.join(tmpHome, '.cam/copilot/work'))
      expect(stat.isDirectory()).toBe(true)
    })

    it('is idempotent when called twice', async () => {
      const driver = new CopilotDriver()
      await driver.setupProfile('work')
      await expect(driver.setupProfile('work')).resolves.not.toThrow()
    })

    it('symlinks hooks, agents, and skills from ~/.copilot when they exist', async () => {
      const sourceDir = path.join(tmpHome, '.copilot')
      await fs.mkdir(path.join(sourceDir, 'hooks'), { recursive: true })
      await fs.mkdir(path.join(sourceDir, 'agents'), { recursive: true })
      await fs.mkdir(path.join(sourceDir, 'skills'), { recursive: true })

      const driver = new CopilotDriver()
      await driver.setupProfile('work')

      const profileDir = path.join(tmpHome, '.cam/copilot/work')
      for (const entry of ['hooks', 'agents', 'skills']) {
        const linkPath = path.join(profileDir, entry)
        const stat = await fs.lstat(linkPath)
        expect(stat.isSymbolicLink()).toBe(true)
        expect(await fs.readlink(linkPath)).toBe(path.join(sourceDir, entry))
      }
    })

    it('skips symlinks when isolated is true, even if shared entries exist in ~/.copilot', async () => {
      const sourceDir = path.join(tmpHome, '.copilot')
      await fs.mkdir(path.join(sourceDir, 'hooks'), { recursive: true })
      await fs.mkdir(path.join(sourceDir, 'agents'), { recursive: true })
      await fs.mkdir(path.join(sourceDir, 'skills'), { recursive: true })

      const driver = new CopilotDriver()
      await driver.setupProfile('sandbox', { isolated: true })

      const profileDir = path.join(tmpHome, '.cam/copilot/sandbox')
      const stat = await fs.stat(profileDir)
      expect(stat.isDirectory()).toBe(true)
      for (const entry of ['hooks', 'agents', 'skills']) {
        const exists = await fs
          .lstat(path.join(profileDir, entry))
          .then(() => true)
          .catch(() => false)
        expect(exists).toBe(false)
      }
    })

    it('skips symlinks for shared entries that do not exist in ~/.copilot', async () => {
      const driver = new CopilotDriver()
      await driver.setupProfile('work')

      const profileDir = path.join(tmpHome, '.cam/copilot/work')
      const hooksExists = await fs
        .lstat(path.join(profileDir, 'hooks'))
        .then(() => true)
        .catch(() => false)
      expect(hooksExists).toBe(false)
    })
  })

  describe('teardownProfile', () => {
    it('removes an existing profile directory', async () => {
      const driver = new CopilotDriver()
      await driver.setupProfile('work')
      await driver.teardownProfile('work')
      const exists = await fs
        .stat(path.join(tmpHome, '.cam/copilot/work'))
        .then(() => true)
        .catch(() => false)
      expect(exists).toBe(false)
    })

    it('does not throw when the profile does not exist', async () => {
      const driver = new CopilotDriver()
      await expect(driver.teardownProfile('never-created')).resolves.not.toThrow()
    })
  })

  describe('launch', () => {
    it('spawns the copilot binary with args and COPILOT_HOME env var', async () => {
      const child = new FakeChild()
      vi.mocked(spawn).mockReturnValue(child as never)

      const driver = new CopilotDriver()
      const profileDir = path.join(tmpHome, '.cam/copilot/work')
      const launchPromise = driver.launch(profileDir, ['--foo', 'bar'])
      child.emit('close', 0)
      await launchPromise

      expect(spawn).toHaveBeenCalledTimes(1)
      const [binary, args, options] = vi.mocked(spawn).mock.calls[0]!
      expect(binary).toBe('copilot')
      expect(args).toEqual(['--foo', 'bar'])
      expect(options).toMatchObject({ stdio: 'inherit' })
      const env = (options as { env: NodeJS.ProcessEnv }).env
      expect(env.COPILOT_HOME).toBe(profileDir)
    })

    it('does not set COPILOT_HOME in the parent process environment', async () => {
      const child = new FakeChild()
      vi.mocked(spawn).mockReturnValue(child as never)
      const before = process.env.COPILOT_HOME

      const driver = new CopilotDriver()
      const launchPromise = driver.launch('/some/profile', [])
      child.emit('close', 0)
      await launchPromise

      expect(process.env.COPILOT_HOME).toBe(before)
    })

    it('does not pass --config-dir as a CLI flag', async () => {
      const child = new FakeChild()
      vi.mocked(spawn).mockReturnValue(child as never)

      const driver = new CopilotDriver()
      const launchPromise = driver.launch('/some/profile', ['--resume'])
      child.emit('close', 0)
      await launchPromise

      const args = vi.mocked(spawn).mock.calls[0]![1] as string[]
      expect(args).not.toContain('--config-dir')
    })

    it('resolves cleanly on exit code 0', async () => {
      const child = new FakeChild()
      vi.mocked(spawn).mockReturnValue(child as never)

      const driver = new CopilotDriver()
      const launchPromise = driver.launch('/some/profile', [])
      child.emit('close', 0)
      await expect(launchPromise).resolves.toBeUndefined()
    })

    it('calls process.exit with the child exit code on non-zero close', async () => {
      const child = new FakeChild()
      vi.mocked(spawn).mockReturnValue(child as never)
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never)

      const driver = new CopilotDriver()
      void driver.launch('/some/profile', [])
      child.emit('close', 2)

      expect(exitSpy).toHaveBeenCalledWith(2)
      exitSpy.mockRestore()
    })

    it('rejects when spawn emits an error', async () => {
      const child = new FakeChild()
      vi.mocked(spawn).mockReturnValue(child as never)

      const driver = new CopilotDriver()
      const launchPromise = driver.launch('/some/profile', [])
      child.emit('error', new Error('ENOENT'))
      await expect(launchPromise).rejects.toThrow('ENOENT')
    })
  })
})
