import { allAccounts, loadConfig } from '../core/config.js'
import { findCamrc } from '../core/camrc.js'
import chalk from 'chalk'
import * as log from '../utils/log.js'

/**
 * cam list — show all configured accounts
 */
export async function list(): Promise<void> {
  const config = await loadConfig()
  const accounts = allAccounts(config)

  if (accounts.length === 0) {
    log.info('No accounts configured yet.')
    console.log(`Add one with: ${log.bold('cam add <agent> <name>')}`)
    return
  }

  const current = await findCamrc(process.cwd())
  const def = config.default

  console.log()
  for (const { agent, name, account } of accounts) {
    const isActive = current?.agent === agent && current?.name === name
    const isDefault = def?.agent === agent && def?.name === name
    const marker = isActive ? chalk.green('●') : chalk.dim('○')
    const label = isActive ? chalk.bold(`${agent} ${name}`) : `${agent} ${name}`
    const tags = [isDefault ? chalk.yellow('default') : ''].filter(Boolean).join(' ')
    console.log(
      `  ${marker}  ${label}  ${log.dim(account.profileDir)}` + (tags ? `  ${tags}` : '')
    )
  }
  console.log()

  if (current) {
    console.log(log.dim(`Active in this directory: ${current.agent} ${current.name}`))
  } else if (def) {
    console.log(log.dim(`Default account: ${def.agent} ${def.name}`))
  }
}
