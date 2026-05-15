import path from 'path'
import spawn from 'cross-spawn'
import { camConfigDir, homeDir } from '../utils/fs.js'
import { createProfile, removeProfile } from '../core/profile-manager.js'
import type { AgentDriver, SetupProfileOptions } from './base.js'

const SHARED_ENTRIES = ['hooks', 'agents', 'skills']

function defaultCopilotConfigDir(): string {
  return path.join(homeDir(), '.copilot')
}

export class CopilotDriver implements AgentDriver {
  readonly name = 'copilot'
  readonly binaryName = 'copilot'

  getProfileDir(accountName: string): string {
    return path.join(camConfigDir(), 'copilot', accountName)
  }

  async setupProfile(accountName: string, options: SetupProfileOptions = {}): Promise<void> {
    const sharedEntries = options.isolated ? [] : SHARED_ENTRIES
    await createProfile(this.getProfileDir(accountName), defaultCopilotConfigDir(), sharedEntries)
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
