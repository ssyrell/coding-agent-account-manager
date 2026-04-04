import { findCamrc } from '../core/camrc.js'
import { getAccount } from '../core/config.js'
import * as log from '../utils/log.js'

/**
 * cam whoami — show which account resolves for the current directory
 */
export async function whoami(): Promise<void> {
  const result = await findCamrc(process.cwd())

  if (!result) {
    log.warn('No .camrc found in this directory or any parent directory.')
    process.exit(1)
  }

  const { accountName, foundAt } = result
  const account = await getAccount(accountName)

  console.log(accountName)

  if (!account) {
    log.warn(`Account '${accountName}' is referenced in ${foundAt} but not configured.`)
    log.info(`Add it with: cam add ${accountName}`)
  } else {
    console.log(log.dim(`  agent:   ${account.agent}`))
    console.log(log.dim(`  profile: ${account.profileDir}`))
    console.log(log.dim(`  .camrc:  ${foundAt}`))
  }
}
