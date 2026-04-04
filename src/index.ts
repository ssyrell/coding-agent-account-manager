#!/usr/bin/env node
import { Command } from 'commander'
import { launch } from './commands/launch.js'
import { use } from './commands/use.js'
import { add } from './commands/add.js'
import { list } from './commands/list.js'
import { remove } from './commands/remove.js'
import { whoami } from './commands/whoami.js'

const program = new Command()

program
  .name('cam')
  .description('Coding Agent Account Manager — launch coding agents with the right account for your project')
  .version('0.1.0')
  // Default action: launch with .camrc-resolved account, forwarding all args to the agent
  .allowUnknownOption()
  .action(async (_opts: unknown, cmd: Command) => {
    const extraArgs = cmd.args
    await launch(extraArgs)
  })

program
  .command('use <name>')
  .description('Launch with a specific account, bypassing .camrc')
  .allowUnknownOption()
  .action(async (name: string, _opts: unknown, cmd: Command) => {
    // Collect any extra args after the account name
    const extraArgs = cmd.args.slice(1)
    await use(name, extraArgs)
  })

program
  .command('add <name>')
  .description('Create a new account and set up its profile directory')
  .action(async (name: string) => {
    await add(name)
  })

program
  .command('list')
  .description('List all configured accounts')
  .action(async () => {
    await list()
  })

program
  .command('remove <name>')
  .description('Remove an account and delete its profile directory')
  .option('-f, --force', 'skip confirmation prompt')
  .action(async (name: string, opts: { force?: boolean }) => {
    await remove(name, opts)
  })

program
  .command('whoami')
  .description('Show which account resolves for the current directory')
  .action(async () => {
    await whoami()
  })

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
