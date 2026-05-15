import { getAccount } from '../core/config.js'
import { getDriver } from '../agents/index.js'
import { writeCamrc } from '../core/camrc.js'
import { expandHome } from '../utils/fs.js'
import * as log from '../utils/log.js'

export interface UseOptions {
  always?: boolean
}

/**
 * cam use <agent> <name> [--always] [args...] — launch with a specific
 * account, bypassing .camrc. With --always, also writes a .camrc file
 * in the current directory so future `cam` invocations pick this account.
 */
export async function use(
  agent: string,
  name: string,
  extraArgs: string[],
  opts: UseOptions = {}
): Promise<void> {
  const account = await getAccount(agent, name)

  if (!account) {
    log.error(`Account '${agent} ${name}' is not configured.`)
    log.info(`Add it with: cam add ${agent} ${name}`)
    process.exit(1)
  }

  const driver = getDriver(agent)
  if (!driver) {
    log.error(`Unknown agent '${agent}' for account '${name}'.`)
    process.exit(1)
  }

  if (opts.always) {
    const filePath = await writeCamrc(process.cwd(), agent, name)
    log.success(`Wrote ${filePath}`)
  }

  const profileDir = expandHome(account.profileDir)
  const args = [...(account.launchParams ?? []), ...extraArgs]
  await driver.launch(profileDir, args)
}
