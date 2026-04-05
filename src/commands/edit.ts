import readline from 'readline/promises'
import { getAccount, updateAccount } from '../core/config.js'
import { parseArgs, formatArgs } from '../utils/args.js'
import * as log from '../utils/log.js'

/**
 * cam edit <name> — interactively update the launch parameters for an account.
 * Enter a space-separated list of parameters, or leave blank to remove all saved parameters.
 */
export async function edit(accountName: string): Promise<void> {
  const account = await getAccount(accountName)

  if (!account) {
    log.error(`Account '${accountName}' does not exist.`)
    log.info(`Add it with: cam add ${accountName}`)
    process.exit(1)
  }

  const currentParams = account.launchParams ?? []

  console.log()
  const currentDisplay = currentParams.length > 0 ? formatArgs(currentParams) : log.dim('(none)')
  console.log(`  Account:           ${log.bold(accountName)}`)
  console.log(`  Launch parameters: ${currentDisplay}`)
  console.log()

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  try {
    const input = await rl.question(
      `  New launch parameters ${log.dim('(quote args with spaces, empty to remove all)')}: `
    )
    const newParams = input.trim() ? parseArgs(input.trim()) : []

    const unchanged =
      newParams.length === currentParams.length &&
      newParams.every((p, i) => p === currentParams[i])

    if (unchanged) {
      console.log()
      log.info('No changes.')
      return
    }

    const wasDisplay = currentParams.length > 0 ? formatArgs(currentParams) : log.dim('(none)')
    const nowDisplay = newParams.length > 0 ? formatArgs(newParams) : log.dim('(none)')

    console.log()
    console.log(`  was: ${wasDisplay}`)
    console.log(`  now: ${nowDisplay}`)
    console.log()

    const confirm = await rl.question(`  Save changes? [y/N] `)
    if (confirm.trim().toLowerCase() !== 'y') {
      log.info('Aborted.')
      return
    }

    await updateAccount(accountName, { launchParams: newParams })
    console.log()
    log.success(`Account '${log.bold(accountName)}' updated.`)
  } finally {
    rl.close()
  }
}
