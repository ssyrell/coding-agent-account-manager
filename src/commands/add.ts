import readline from 'readline/promises'
import { loadConfig, addAccount, accountExists } from '../core/config.js'
import { writeCamrc } from '../core/camrc.js'
import { getDriver, listDrivers } from '../agents/index.js'
import * as log from '../utils/log.js'

export interface AddOptions {
  isolated?: boolean
}

/**
 * cam add <agent> <name> [params...] — create a new account and set up its
 * profile directory. Extra arguments after the name are saved as launch
 * parameters. With --isolated, the profile is created without symlinks to
 * the agent's default config directory (e.g. ~/.claude or ~/.copilot), so
 * settings, hooks, agents, skills, etc. start empty and are not shared.
 * At the end, prompts the user to drop a .camrc file in the current working
 * directory.
 */
export async function add(
  agent: string,
  name: string,
  launchParams: string[] = [],
  opts: AddOptions = {}
): Promise<void> {
  const driver = getDriver(agent)
  if (!driver) {
    log.error(`Unknown agent '${agent}'. Available: ${listDrivers().join(', ')}`)
    process.exit(1)
  }

  const config = await loadConfig()
  if (accountExists(config, agent, name)) {
    log.error(`Account '${agent} ${name}' already exists.`)
    log.info(`Use 'cam list' to see all accounts.`)
    process.exit(1)
  }

  const profileDir = driver.getProfileDir(name)

  log.info(
    `Creating ${opts.isolated ? 'isolated profile' : 'profile'} directory ${log.dim(profileDir)}...`
  )
  await driver.setupProfile(name, { isolated: opts.isolated })

  await addAccount(agent, name, {
    profileDir,
    createdAt: new Date().toISOString(),
    ...(launchParams.length > 0 ? { launchParams } : {}),
  })

  log.success(`Account '${log.bold(`${agent} ${name}`)}' created.`)
  console.log()
  console.log(`Next: authenticate inside the profile`)
  console.log(`  ${log.bold(`cam use ${agent} ${name}`)}  (then run: ${agent} auth login)`)
  console.log()

  await maybeCreateCamrc(agent, name)
}

async function maybeCreateCamrc(agent: string, name: string): Promise<void> {
  const cwd = process.cwd()
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  try {
    const answer = await rl.question(`Create .camrc for '${agent} ${name}' in ${cwd}? [y/N] `)
    if (answer.trim().toLowerCase() !== 'y') return
    const filePath = await writeCamrc(cwd, agent, name)
    log.success(`Wrote ${filePath}`)
  } finally {
    rl.close()
  }
}
