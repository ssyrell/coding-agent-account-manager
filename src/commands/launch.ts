import readline from 'readline/promises'
import { findCamrc } from '../core/camrc.js'
import {
  allAccounts,
  loadConfig,
  getAccount,
  accountExists,
  setDefault,
  type AccountRef,
  type CamConfig,
} from '../core/config.js'
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
  const ref: AccountRef = camrc
    ? { agent: camrc.agent, name: camrc.name }
    : await resolveWithoutCamrc()

  const account = await getAccount(ref.agent, ref.name)

  if (!account) {
    log.error(`Account '${ref.agent} ${ref.name}' is not configured.`)
    log.info(`Add it with: cam add ${ref.agent} ${ref.name}`)
    process.exit(1)
  }

  const driver = getDriver(ref.agent)
  if (!driver) {
    log.error(`Unknown agent '${ref.agent}' for account '${ref.name}'.`)
    process.exit(1)
  }

  const profileDir = expandHome(account.profileDir)
  const args = [...(account.launchParams ?? []), ...extraArgs]
  await driver.launch(profileDir, args)
}

/**
 * Called when no .camrc was found. Returns the resolved account ref,
 * either from the configured default or by prompting the user.
 */
async function resolveWithoutCamrc(): Promise<AccountRef> {
  const config = await loadConfig()

  if (config.default) {
    if (accountExists(config, config.default.agent, config.default.name)) {
      return config.default
    }
    log.warn(
      `Default account '${config.default.agent} ${config.default.name}' no longer exists.`
    )
  }

  const accounts = allAccounts(config)

  if (accounts.length === 0) {
    log.error('No accounts configured and no .camrc found.')
    log.info('Add an account with: cam add <agent> <name>')
    process.exit(1)
  }

  return promptForAccount(config)
}

async function promptForAccount(config: CamConfig): Promise<AccountRef> {
  const accounts = allAccounts(config).map(({ agent, name }) => ({ agent, name }))

  console.log()
  log.info('No .camrc found. Which account would you like to use?')
  console.log()
  accounts.forEach(({ agent, name }, i) => {
    console.log(`  ${log.dim(`${i + 1})`)} ${agent} ${name}`)
  })
  console.log()

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  try {
    let chosen: AccountRef | undefined
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
      } else {
        // Accept "agent name" or just "name" (resolves uniquely or falls back to claude).
        const tokens = trimmed.split(/\s+/)
        if (tokens.length >= 2) {
          const match = accounts.find((a) => a.agent === tokens[0] && a.name === tokens[1])
          if (match) {
            chosen = match
          } else {
            console.log(`  Unknown account '${tokens[0]} ${tokens[1]}'.`)
          }
        } else {
          const nameMatches = accounts.filter((a) => a.name === tokens[0])
          if (nameMatches.length === 1) {
            chosen = nameMatches[0]
          } else if (nameMatches.length > 1) {
            console.log(`  '${tokens[0]}' is ambiguous. Enter '<agent> <name>'.`)
          } else {
            console.log(`  Unknown account '${tokens[0]}'. Enter a number or '<agent> <name>'.`)
          }
        }
      }
    }

    console.log()
    const setAsDefault = await rl.question(
      `  Set '${log.bold(`${chosen.agent} ${chosen.name}`)}' as the default account? [y/N] `
    )
    if (setAsDefault.trim().toLowerCase() === 'y') {
      await setDefault(chosen.agent, chosen.name)
      log.success(`Default account set to '${log.bold(`${chosen.agent} ${chosen.name}`)}'.`)
      log.info(`You can change it later with: cam default <agent> <name>`)
      console.log()
    }

    return chosen
  } finally {
    rl.close()
  }
}
