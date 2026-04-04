import readline from 'readline/promises'
import { loadConfig, addAccount, accountExists } from '../core/config.js'
import { getDriver, listDrivers } from '../agents/index.js'
import * as log from '../utils/log.js'

/**
 * cam add <name> — create a new account and set up its profile directory
 */
export async function add(accountName: string): Promise<void> {
  const config = await loadConfig()

  if (accountExists(config, accountName)) {
    log.error(`Account '${accountName}' already exists.`)
    log.info(`Use 'cam list' to see all accounts.`)
    process.exit(1)
  }

  const availableAgents = listDrivers()
  let agentName = 'claude'

  if (availableAgents.length > 1) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    try {
      const answer = await rl.question(
        `Agent [${availableAgents.join('/')}] (default: claude): `
      )
      agentName = answer.trim() || 'claude'
    } finally {
      rl.close()
    }
  }

  const driver = getDriver(agentName)
  if (!driver) {
    log.error(`Unknown agent '${agentName}'. Available: ${availableAgents.join(', ')}`)
    process.exit(1)
  }

  const profileDir = driver.getProfileDir(accountName)

  log.info(`Creating profile directory ${log.dim(profileDir)}...`)
  await driver.setupProfile(accountName)

  await addAccount(accountName, {
    agent: agentName,
    profileDir: profileDir,
    createdAt: new Date().toISOString(),
  })

  log.success(`Account '${log.bold(accountName)}' created.`)
  console.log()
  console.log(`Next: authenticate inside the profile`)
  console.log(`  ${log.bold(`cam use ${accountName}`)}  (then run: ${agentName} auth login)`)
  console.log()
  console.log(`Or add a .camrc file:  echo "${accountName}" > .camrc`)
}
