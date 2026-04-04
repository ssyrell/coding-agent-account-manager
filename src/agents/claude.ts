import path from 'path'
import spawn from 'cross-spawn'
import { homeDir } from '../utils/fs.js'
import { createProfile, removeProfile, defaultClaudeConfigDir } from '../core/profile-manager.js'
import type { AgentDriver } from './base.js'

export class ClaudeDriver implements AgentDriver {
  readonly name = 'claude'
  readonly binaryName = 'claude'

  getProfileDir(accountName: string): string {
    return path.join(homeDir(), `.claude-${accountName}`)
  }

  async setupProfile(accountName: string): Promise<void> {
    const profileDir = this.getProfileDir(accountName)
    const sourceDir = defaultClaudeConfigDir()
    await createProfile(profileDir, sourceDir)
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
          CLAUDE_HOME: profileDir,
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
