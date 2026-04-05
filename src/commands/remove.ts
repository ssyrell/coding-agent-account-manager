import readline from 'readline/promises'
import { loadConfig, removeAccount, accountExists, clearDefault } from '../core/config.js'
import { getDriver } from '../agents/index.js'
import * as log from '../utils/log.js'

/**
 * cam remove <name> — delete an account and its profile directory
 */
export async function remove(accountName: string, opts: { force?: boolean }): Promise<void> {
  const config = await loadConfig()

  if (!accountExists(config, accountName)) {
    log.error(`Account '${accountName}' does not exist.`)
    process.exit(1)
  }

  if (!opts.force) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    try {
      const answer = await rl.question(
        `Remove account '${accountName}' and delete its profile directory? [y/N] `
      )
      if (answer.trim().toLowerCase() !== 'y') {
        log.info('Aborted.')
        return
      }
    } finally {
      rl.close()
    }
  }

  const account = config.accounts[accountName]!
  const driver = getDriver(account.agent)
  if (driver) {
    log.info(`Removing profile directory...`)
    await driver.teardownProfile(accountName)
  }

  if (config.default === accountName) {
    await clearDefault()
    log.warn(`Cleared default account (was '${accountName}').`)
  }

  await removeAccount(accountName)
  log.success(`Account '${accountName}' removed.`)
}
