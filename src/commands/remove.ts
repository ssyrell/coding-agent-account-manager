import readline from 'readline/promises'
import { loadConfig, removeAccount, accountExists, clearDefault } from '../core/config.js'
import { getDriver } from '../agents/index.js'
import * as log from '../utils/log.js'

/**
 * cam remove <agent> <name> — delete an account and its profile directory.
 */
export async function remove(
  agent: string,
  name: string,
  opts: { force?: boolean }
): Promise<void> {
  const config = await loadConfig()

  if (!accountExists(config, agent, name)) {
    log.error(`Account '${agent} ${name}' does not exist.`)
    process.exit(1)
  }

  if (!opts.force) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    try {
      const answer = await rl.question(
        `Remove account '${agent} ${name}' and delete its profile directory? [y/N] `
      )
      if (answer.trim().toLowerCase() !== 'y') {
        log.info('Aborted.')
        return
      }
    } finally {
      rl.close()
    }
  }

  const driver = getDriver(agent)
  if (driver) {
    log.info(`Removing profile directory...`)
    await driver.teardownProfile(name)
  }

  if (config.default?.agent === agent && config.default?.name === name) {
    await clearDefault()
    log.warn(`Cleared default account (was '${agent} ${name}').`)
  }

  await removeAccount(agent, name)
  log.success(`Account '${agent} ${name}' removed.`)
}
