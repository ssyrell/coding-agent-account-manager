import { findCamrc } from '../core/camrc.js'
import { getAccount, getDefault } from '../core/config.js'
import * as log from '../utils/log.js'

/**
 * cam whoami — show which account resolves for the current directory
 */
export async function whoami(): Promise<void> {
  const result = await findCamrc(process.cwd())

  if (!result) {
    const def = await getDefault()
    if (def) {
      console.log(`${def.agent} ${def.name}`)
      const account = await getAccount(def.agent, def.name)
      if (!account) {
        log.warn(
          `Default account '${def.agent} ${def.name}' is configured as default but not found.`
        )
        log.info(`Add it with: cam add ${def.agent} ${def.name}`)
      } else {
        console.log(log.dim(`  profile: ${account.profileDir}`))
        console.log(log.dim(`  source:  default`))
      }
    } else {
      log.warn('No .camrc found and no default account set.')
      log.info('Set a default with: cam default <agent> <name>')
      process.exit(1)
    }
    return
  }

  const { agent, name, foundAt, isLegacyFormat } = result
  const account = await getAccount(agent, name)

  console.log(`${agent} ${name}`)

  if (!account) {
    log.warn(`Account '${agent} ${name}' is referenced in ${foundAt} but not configured.`)
    log.info(`Add it with: cam add ${agent} ${name}`)
  } else {
    console.log(log.dim(`  profile: ${account.profileDir}`))
    console.log(log.dim(`  .camrc:  ${foundAt}${isLegacyFormat ? ' (legacy format)' : ''}`))
  }
}
