import path from 'path'
import spawn from 'cross-spawn'
import { homeDir, ensureDir } from '../utils/fs.js'
import { removeProfile } from '../core/profile-manager.js'
import type { AgentDriver } from './base.js'

export class CopilotDriver implements AgentDriver {
  readonly name = 'copilot'
  readonly binaryName = 'copilot'

  getProfileDir(accountName: string): string {
    return path.join(homeDir(), `.copilot-${accountName}`)
  }

  async setupProfile(accountName: string): Promise<void> {
    await ensureDir(this.getProfileDir(accountName))
  }

  async teardownProfile(accountName: string): Promise<void> {
    await removeProfile(this.getProfileDir(accountName))
  }

  async launch(profileDir: string, args: string[]): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(this.binaryName, args, {
        stdio: 'inherit',
        env: {
          ...process.env,
          COPILOT_HOME: profileDir,
        },
      })

      child.on('close', (code) => {
        if (code === 0 || code === null) {
          resolve()
        } else {
          process.exit(code)
        }
      })

      child.on('error', (err) => reject(err))
    })
  }
}
