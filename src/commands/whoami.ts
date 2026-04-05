import { findCamrc } from '../core/camrc.js'
import { getAccount, getDefault } from '../core/config.js'
import * as log from '../utils/log.js'

/**
 * cam whoami — show which account resolves for the current directory
 */
export async function whoami(): Promise<void> {
  const result = await findCamrc(process.cwd())

  if (!result) {
    const defaultAccount = await getDefault()
    if (defaultAccount) {
      console.log(defaultAccount)
      const account = await getAccount(defaultAccount)
      if (!account) {
        log.warn(`Default account '${defaultAccount}' is configured as default but not found.`)
        log.info(`Add it with: cam add ${defaultAccount}`)
      } else {
        console.log(log.dim(`  agent:   ${account.agent}`))
        console.log(log.dim(`  profile: ${account.profileDir}`))
        console.log(log.dim(`  source:  default`))
      }
    } else {
      log.warn('No .camrc found and no default account set.')
      log.info('Set a default with: cam default <name>')
      process.exit(1)
    }
    return
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
