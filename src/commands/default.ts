import { loadConfig, accountExists, setDefault, getDefault } from '../core/config.js'
import * as log from '../utils/log.js'

/**
 * cam default               — show the current default account
 * cam default <agent> <name> — set the default account
 *
 * The default is used when no .camrc is found in the directory tree.
 */
export async function setDefaultAccount(
  agent: string | undefined,
  name: string | undefined
): Promise<void> {
  if (!agent && !name) {
    const current = await getDefault()
    if (current) {
      console.log(`${current.agent} ${current.name}`)
      console.log(log.dim(`  Use 'cam default <agent> <name>' to change it.`))
    } else {
      log.info('No default account set.')
      console.log(log.dim(`  Use 'cam default <agent> <name>' to set one.`))
    }
    return
  }

  if (!agent || !name) {
    log.error(`Both agent and name are required.`)
    log.info(`Usage: cam default <agent> <name>`)
    process.exit(1)
  }

  const config = await loadConfig()

  if (!accountExists(config, agent, name)) {
    log.error(`Account '${agent} ${name}' does not exist.`)
    log.info(`Add it with: cam add ${agent} ${name}`)
    process.exit(1)
  }

  await setDefault(agent, name)
  log.success(`Default account set to '${log.bold(`${agent} ${name}`)}'.`)
}
