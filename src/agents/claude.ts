import path from 'path'
import spawn from 'cross-spawn'
import { camConfigDir, homeDir } from '../utils/fs.js'
import { createProfile, removeProfile } from '../core/profile-manager.js'
import type { AgentDriver } from './base.js'

/**
 * Files/dirs inside ~/.claude/ that are shared across profiles via symlinks.
 * Auth state is intentionally excluded — it stays profile-specific.
 */
const SHARED_ENTRIES = [
  'settings.json',
  'hooks',
  'agents',
  'skills',
  'plugins',
  'keybindings.json',
]

function defaultClaudeConfigDir(): string {
  return path.join(homeDir(), '.claude')
}

export class ClaudeDriver implements AgentDriver {
  readonly name = 'claude'
  readonly binaryName = 'claude'

  getProfileDir(accountName: string): string {
    return path.join(camConfigDir(), 'claude', accountName)
  }

  async setupProfile(accountName: string): Promise<void> {
    const profileDir = this.getProfileDir(accountName)
    await createProfile(profileDir, defaultClaudeConfigDir(), SHARED_ENTRIES)
  }

  async teardownProfile(accountName: string): Promise<void> {
    const profileDir = this.getProfileDir(accountName)
    await removeProfile(profileDir)
  }

  async launch(profileDir: string, args: string[]): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(this.binaryName, args, {
        stdio: 'inherit',
        env: {
          ...process.env,
          CLAUDE_CONFIG_DIR: profileDir,
        },
      })

      child.on('close', (code) => {
        if (code === 0 || code === null) {
          resolve()
        } else {
          // Propagate non-zero exit code by exiting the cam process with the same code
          process.exit(code)
        }
      })

      child.on('error', (err) => {
        reject(err)
      })
    })
  }
}
