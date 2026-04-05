import { getAccount } from '../core/config.js'
import { getDriver } from '../agents/index.js'
import { expandHome } from '../utils/fs.js'
import * as log from '../utils/log.js'

/**
 * cam use <name> [args...] — launch with a specific account, bypassing .camrc
 */
export async function use(accountName: string, extraArgs: string[]): Promise<void> {
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
  const args = [...(account.launchParams ?? []), ...extraArgs]
  await driver.launch(profileDir, args)
}
