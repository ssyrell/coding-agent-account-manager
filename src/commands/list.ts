import { loadConfig } from '../core/config.js'
import { findCamrc } from '../core/camrc.js'
import chalk from 'chalk'
import * as log from '../utils/log.js'

/**
 * cam list — show all configured accounts
 */
export async function list(): Promise<void> {
  const config = await loadConfig()
  const accounts = Object.entries(config.accounts)

  if (accounts.length === 0) {
    log.info('No accounts configured yet.')
    console.log(`Add one with: ${log.bold('cam add <name>')}`)
    return
  }

  const current = await findCamrc(process.cwd())

  console.log()
  for (const [name, account] of accounts) {
    const isActive = current?.accountName === name
    const marker = isActive ? chalk.green('●') : chalk.dim('○')
    const label = isActive ? chalk.bold(name) : name
    console.log(`  ${marker}  ${label}  ${log.dim(`[${account.agent}]  ${account.profileDir}`)}`)
  }
  console.log()

  if (current) {
    console.log(log.dim(`Active in this directory: ${current.accountName}`))
  }
}
