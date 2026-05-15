#!/usr/bin/env node
import { Command } from 'commander'
import { createRequire } from 'module'

const { version } = createRequire(import.meta.url)('../package.json') as { version: string }
import { launch } from './commands/launch.js'
import { use } from './commands/use.js'
import { add } from './commands/add.js'
import { list } from './commands/list.js'
import { remove } from './commands/remove.js'
import { whoami } from './commands/whoami.js'
import { setDefaultAccount } from './commands/default.js'
import { edit } from './commands/edit.js'
import { config } from './commands/config.js'
import { runUpdateCheck } from './core/update-check.js'

const program = new Command()

program
  .name('cam')
  .description('Coding Agent Account Manager — launch coding agents with the right account for your project')
  .version(version)
  // Default action: launch with .camrc-resolved account, forwarding all args to the agent
  .allowUnknownOption()
  .action(async (_opts: unknown, cmd: Command) => {
    const extraArgs = cmd.args
    if (extraArgs.length > 0 && !extraArgs[0].startsWith('-')) {
      console.error(`error: unknown command '${extraArgs[0]}'`)
      program.help({ error: true })
      return
    }
    await launch(extraArgs)
  })

program
  .command('use <agent> <name>')
  .description('Launch with a specific account, bypassing .camrc')
  .option('--always', 'write a .camrc file in the current directory for this account')
  .allowUnknownOption()
  .action(async (agent: string, name: string, opts: { always?: boolean }, cmd: Command) => {
    // Collect any extra args after the two positional args
    const extraArgs = cmd.args.slice(2)
    await use(agent, name, extraArgs, opts)
  })

program
  .command('add <agent> <name>')
  .description('Create a new account and set up its profile directory')
  .option('--isolated', "create the profile without symlinking the agent's default config (settings, hooks, agents, skills, etc.)")
  .allowUnknownOption()
  .action(async (agent: string, name: string, opts: { isolated?: boolean }, cmd: Command) => {
    const params = cmd.args.slice(2)
    await add(agent, name, params, opts)
  })

program
  .command('list')
  .description('List all configured accounts')
  .action(async () => {
    await list()
  })

program
  .command('remove <agent> <name>')
  .description('Remove an account and delete its profile directory')
  .option('-f, --force', 'skip confirmation prompt')
  .action(async (agent: string, name: string, opts: { force?: boolean }) => {
    await remove(agent, name, opts)
  })

program
  .command('whoami')
  .description('Show which account resolves for the current directory')
  .action(async () => {
    await whoami()
  })

program
  .command('default [agent] [name]')
  .description('Set or show the default account (used when no .camrc is found)')
  .action(async (agent: string | undefined, name: string | undefined) => {
    await setDefaultAccount(agent, name)
  })

program
  .command('edit <agent> <name>')
  .description('Edit the launch parameters for an account')
  .action(async (agent: string, name: string) => {
    await edit(agent, name)
  })

program
  .command('config')
  .description('Open the cam configuration file in your default editor')
  .action(async () => {
    await config()
  })

program
  .command('help [command]')
  .description('Show help for cam or a specific command')
  .action((commandName: string | undefined) => {
    if (commandName) {
      const sub = program.commands.find((c) => c.name() === commandName)
      if (sub) {
        sub.help()
      } else {
        console.error(`Unknown command: ${commandName}`)
        process.exit(1)
      }
    } else {
      program.help()
    }
  })

await runUpdateCheck(version)

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
