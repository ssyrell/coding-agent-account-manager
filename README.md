# Coding Agent Account Manager (cam)

Automatically use the right coding agent account based on your current working directory. Insipired by [NVM](https://github.com/nvm-sh/nvm) and [Jean-Claude](https://github.com/MikeVeerman/jean-claude/tree/master).

Simply place a `.camrc` file in a project and run `cam` in place of your normal coding agent launch comand. Coding Agent Account Manager automatically picks the right account and launches it for you.

Cam supports [Claude Code](https://claude.ai/code) and the [GitHub Copilot CLI](https://github.com/github/copilot-cli), with support for additional agents coming in the future.

## Installation

```bash
npm install -g coding-agent-account-manager
```

## Quick Start

**1. Create an account**

```bash
cam add claude work
```

This creates an isolated profile directory (i.e. `~/.cam/claude/work/`) for the account. At the end, cam will offer to drop a `.camrc` file in your current directory.

**2. Add a `.camrc` to your project's directory** (skip if you already did this above)

```bash
echo "claude work" > ~/work/my-project/.camrc
```

**3. Launch**

```bash
cd ~/work/my-project
cam
```

`cam` walks up the directory tree, finds the nearest `.camrc` file, and launches your coding agent with the desired account. No flags, no aliases — just `cam`.

## Default account

A default account can be set by calling the `default` command and specifying the account you wish to make the default:

```bash
cam default claude work
```

When `cam` is run in a directory with no `.camrc`, it uses the default. If no default account is set, `cam` prompts you to pick from your configured accounts and offers to save the choice as the default.

To see the current default, call `default` with no account specified:

```bash
cam default
```

## Account override

You can bypass the account specified in a `.camrc` with the `use <agent> <name>` command to launch with an account of your choosing:

```bash
cam use claude work
```

Pass `--always` to write a `.camrc` for the chosen account in the current directory, so future `cam` invocations resolve to it automatically:

```bash
cam use claude work --always
```

## Launch parameters

You can save launch parameters for an account that will be passed to the agent every time that account is used. Specify them when creating the account:

```bash
cam add claude work --dangerously-skip-permissions
```

Or add/change them later with `cam edit`:

```bash
cam edit claude work
```

`cam edit` shows the current parameters, prompts for a new set, displays a before/after diff, and asks for confirmation before saving. Leave the input empty to remove all saved parameters.

Parameters that contain spaces must be quoted:

```bash
cam add claude work --system-prompt hello world     # wrong — hello and world are two separate params
cam add claude work "--system-prompt hello world"   # correct — one param
```

The same quoting rules apply inside `cam edit`. Saved parameters are always displayed with spaces-containing values already quoted, so you can copy, tweak, and paste them back in safely.

At launch time, saved parameters are prepended to any extra arguments you pass on the command line:

```bash
# claude/work has launchParams: ["--dangerously-skip-permissions"]
cam use claude work --verbose
# agent receives: --dangerously-skip-permissions --verbose
```

## How It Works

Each account gets its own isolated profile directory (i.e. `~/.cam/claude/<name>/`). When you run `cam`, it:

1. Searches the current directory and all parents for a `.camrc` file
2. If found, reads the account name from that file; otherwise falls back to the configured default
3. Launches the agent pointing at the matching profile directory (i.e. the `CLAUDE_CONFIG_DIR` value for Claude Code)

Authentication state is kept separate per profile. Shared config (settings, hooks, skills) is symlinked from your agent's default directory so changes apply everywhere.

Pass `--isolated` to `cam add` to skip those symlinks — the profile's settings, hooks, agents, skills, etc. start empty and stay independent of the agent's default config:

```bash
cam add claude sandbox --isolated
```

## `.camrc` Format

A `.camrc` file contains the agent type and account name, separated by whitespace:

```
claude work
```

Comments are supported:

```
# Use the work account for this project
claude work
```

`.camrc` files are inherited — a file in a parent directory applies to all subdirectories unless a closer `.camrc` overrides it. This means you can place one `.camrc` in `~/work/` and all projects under it will use that account automatically.

**Legacy format**: a `.camrc` containing just the account name (no agent prefix) is still supported and resolves to the `claude` agent.

## Commands

| Command | Description |
|---|---|
| `cam` | Launch using the account from `.camrc`, default, or prompt |
| `cam use <agent> <name> [--always] [params...]` | Launch with a specific account, bypassing `.camrc`. `--always` writes a `.camrc` for the account in the current directory |
| `cam add <agent> <name> [--isolated] [params...]` | Create a new account; optional params are saved as launch parameters. `--isolated` skips symlinking the agent's default config (settings, hooks, agents, skills, etc.) so the profile starts empty. Prompts at the end to drop a `.camrc` in the current directory |
| `cam edit <agent> <name>` | Interactively edit an account's saved launch parameters |
| `cam default [agent] [name]` | Set or show the default account |
| `cam list` | List all configured accounts |
| `cam whoami` | Show which account resolves for the current directory |
| `cam remove <agent> <name>` | Remove an account and delete its profile directory |
| `cam config` | Open `~/.cam/accounts.json` in `$VISUAL` / `$EDITOR` (falls back to `open`) |
| `cam help [command]` | Show help for cam or a specific command |
| `cam man` | Open the cam man page |

## Configuration file

Cam keeps everything under `~/.cam/`:

```
~/.cam/
  accounts.json
  update-check.json   # tracks the last GitHub release check (see below)
  claude/<name>/      # per-account Claude profile dirs
  copilot/<name>/     # per-account Copilot profile dirs
```

`accounts.json` is plain JSON and looks like this:

```json
{
  "version": 2,
  "default": { "agent": "claude", "name": "work" },
  "accounts": {
    "claude": {
      "personal": {
        "profileDir": "~/.cam/claude/personal",
        "createdAt": "2026-01-01T00:00:00.000Z"
      },
      "work": {
        "profileDir": "~/.cam/claude/work",
        "createdAt": "2026-01-01T00:00:00.000Z",
        "launchParams": ["--dangerously-skip-permissions"]
      }
    },
    "copilot": {
      "work": {
        "profileDir": "~/.cam/copilot/work",
        "createdAt": "2026-01-02T00:00:00.000Z"
      }
    }
  }
}
```

| Field | Description |
|---|---|
| `version` | Schema version, currently `2` |
| `default` | `{ agent, name }` of the default account (set by `cam default`) |
| `accounts.<agent>.<name>.profileDir` | Path to the isolated profile directory |
| `accounts.<agent>.<name>.createdAt` | ISO 8601 timestamp of when the account was created |
| `accounts.<agent>.<name>.launchParams` | Optional array of arguments prepended at launch |

The file is managed by cam commands — direct edits are supported but not required.

## Update notifications

On each invocation, cam checks the GitHub releases API for a newer version, at most once per 24 hours. The last check timestamp and most recently observed release are recorded in `~/.cam/update-check.json` so repeated commands within the window don't hit the network.

When a newer release is available, cam prints a notice and blocks on a single keypress before continuing, so an agent that clears the screen on launch can't hide it:

```
⚠ A new version of cam is available: 1.2.0 (current: 1.0.0)
ℹ Update with: npm install -g coding-agent-account-manager

  Press any key to continue...
```

If stdin isn't a TTY (e.g. cam's output is piped), the notice still prints but the wait is skipped so scripts don't hang. Network errors and HTTP failures are swallowed silently and never block a cam command from running.

### Migrating from v1.0.0

Earlier versions of cam stored `accounts.json` at `~/.config/cam/accounts.json` and per-agent profile directories at `~/.claude-<name>/` and `~/.copilot-<name>/`. On the first invocation after upgrading, cam automatically moves the profile directories under `~/.cam/`, rewrites the paths in `accounts.json`, and removes the legacy `~/.config/cam/` location. The migration is keyed off the `version` field and aborts up front with a clear error if any destination directory already exists.

## Example Setup

```
~/.camrc (or ~/personal/.camrc)   →  claude personal
~/work/.camrc                     →  claude work
~/work/client-a/.camrc            →  claude client-a
```

```bash
cam add claude personal
cam add claude work
cam add claude client-a

cd ~/personal/my-blog
cam whoami   # claude personal
cam          # launches with the claude/personal account

cd ~/work/my-app
cam whoami   # claude work
cam          # launches with the claude/work account

cd ~/work/client-a/project
cam whoami   # claude client-a
cam          # launches with the claude/client-a account
```