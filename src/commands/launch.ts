import { findCamrc } from '../core/camrc.js'
import { getAccount } from '../core/config.js'
import { getDriver } from '../agents/index.js'
import { expandHome } from '../utils/fs.js'
import * as log from '../utils/log.js'

/**
 * Default command: find .camrc, resolve account, launch the agent.
 * Extra args are forwarded to the agent binary.
 */
export async function launch(extraArgs: string[]): Promise<void> {
  const result = await findCamrc(process.cwd())

  if (!result) {
    log.error('No .camrc found in this directory or any parent directory.')
    log.info('Create one with: echo "account-name" > .camrc')
    process.exit(1)
  }

  const { accountName, foundAt } = result
  const account = await getAccount(accountName)

  if (!account) {
    log.error(`Account '${accountName}' is not configured.`)
    log.info(`Add it with: cam add ${accountName}`)
    process.exit(1)
  }

  const driver = getDriver(account.agent)
  if (!driver) {
    log.error(`Unknown agent '${account.agent}' for account '${accountName}'.`)
    process.exit(1)
  }

  const profileDir = expandHome(account.profileDir)
  await driver.launch(profileDir, extraArgs)
}
