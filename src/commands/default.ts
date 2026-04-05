import { loadConfig, accountExists, setDefault, getDefault } from '../core/config.js'
import * as log from '../utils/log.js'

/**
 * cam default [name] — set or show the default account.
 * The default is used when no .camrc is found in the directory tree.
 */
export async function setDefaultAccount(accountName: string | undefined): Promise<void> {
  if (!accountName) {
    const current = await getDefault()
    if (current) {
      console.log(current)
      console.log(log.dim(`  Use 'cam default <name>' to change it.`))
    } else {
      log.info('No default account set.')
      console.log(log.dim(`  Use 'cam default <name>' to set one.`))
    }
    return
  }

  const config = await loadConfig()

  if (!accountExists(config, accountName)) {
    log.error(`Account '${accountName}' does not exist.`)
    log.info(`Add it with: cam add ${accountName}`)
    process.exit(1)
  }

  await setDefault(accountName)
  log.success(`Default account set to '${log.bold(accountName)}'.`)
}
