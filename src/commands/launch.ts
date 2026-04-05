import readline from 'readline/promises'
import { findCamrc } from '../core/camrc.js'
import { loadConfig, getAccount, accountExists, setDefault } from '../core/config.js'
import { getDriver } from '../agents/index.js'
import { expandHome } from '../utils/fs.js'
import * as log from '../utils/log.js'

/**
 * Default command: find .camrc, resolve account, launch the agent.
 * Falls back to the configured default account if no .camrc is found.
 * If no default is set either, prompts the user to pick an account.
 * Extra args are forwarded to the agent binary.
 */
export async function launch(extraArgs: string[]): Promise<void> {
  const camrc = await findCamrc(process.cwd())
  const accountName = camrc ? camrc.accountName : await resolveWithoutCamrc()

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

/**
 * Called when no .camrc was found. Returns the account name to use,
 * either from the configured default or by prompting the user.
 */
async function resolveWithoutCamrc(): Promise<string> {
  const config = await loadConfig()

  if (config.default) {
    if (accountExists(config, config.default)) {
      return config.default
    }
    // Default points to a deleted account — fall through to prompt
    log.warn(`Default account '${config.default}' no longer exists.`)
  }

  const accounts = Object.keys(config.accounts)

  if (accounts.length === 0) {
    log.error('No accounts configured and no .camrc found.')
    log.info('Add an account with: cam add <name>')
    process.exit(1)
  }

  return promptForAccount(accounts)
}

async function promptForAccount(accounts: string[]): Promise<string> {
  console.log()
  log.info('No .camrc found. Which account would you like to use?')
  console.log()
  accounts.forEach((name, i) => {
    console.log(`  ${log.dim(`${i + 1})`)} ${name}`)
  })
  console.log()

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  try {
    let chosen: string | undefined
    while (!chosen) {
      const answer = await rl.question(`  Account [1]: `)
      const trimmed = answer.trim()

      if (trimmed === '') {
        chosen = accounts[0]
      } else if (/^\d+$/.test(trimmed)) {
        const idx = parseInt(trimmed, 10) - 1
        if (idx >= 0 && idx < accounts.length) {
          chosen = accounts[idx]
        } else {
          console.log(`  Please enter a number between 1 and ${accounts.length}.`)
        }
      } else if (accounts.includes(trimmed)) {
        chosen = trimmed
      } else {
        console.log(`  Unknown account '${trimmed}'. Enter a number or account name.`)
      }
    }

    console.log()
    const setAsDefault = await rl.question(
      `  Set '${log.bold(chosen)}' as the default account? [y/N] `
    )
    if (setAsDefault.trim().toLowerCase() === 'y') {
      await setDefault(chosen)
      log.success(`Default account set to '${log.bold(chosen)}'.`)
      log.info(`You can change it later with: cam default <name>`)
      console.log()
    }

    return chosen
  } finally {
    rl.close()
  }
}
