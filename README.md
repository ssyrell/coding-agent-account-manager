# cam — Coding Agent Account Manager

Automatically use the right coding agent account based on your current working directory. Works like `nvm` — place a `.camrc` file in a project and `cam` picks the right account when you launch.

Currently supports [Claude Code](https://claude.ai/code), with support for additional agents coming in the future.

## Installation

```bash
npm install -g coding-agent-account-manager
```

## Quick Start

**1. Create an account**

```bash
cam add work
```

This creates an isolated profile directory (`~/.claude-work/`) for the account.

**2. Add a `.camrc` to your project**

```bash
echo "work" > ~/work/my-project/.camrc
```

**3. Launch**

```bash
cd ~/work/my-project
cam
```

`cam` walks up the directory tree, finds `.camrc`, and launches Claude Code with the matching account. No flags, no aliases — just `cam`.

## Default account

If you don't use `.camrc` files (or want a fallback for directories without one), you can set a default account:

```bash
cam default work
```

When `cam` is run in a directory with no `.camrc`, it uses the default. If no default is set either, `cam` prompts you to pick from your configured accounts and offers to save the choice as the default.

To see the current default:

```bash
cam default
```

## Launch parameters

You can save launch parameters for an account that will be passed to the agent every time that account is used. Specify them when creating the account:

```bash
cam add work --dangerously-skip-permissions
```

Or add/change them later with `cam edit`:

```bash
cam edit work
```

`cam edit` shows the current parameters, prompts for a new set, displays a before/after diff, and asks for confirmation before saving. Leave the input empty to remove all saved parameters.

Parameters that contain spaces must be quoted:

```bash
cam add work --system-prompt hello world     # wrong — hello and world are two separate params
cam add work "--system-prompt hello world"   # correct — one param
```

The same quoting rules apply inside `cam edit`. Saved parameters are always displayed with spaces-containing values already quoted, so you can copy, tweak, and paste them back in safely.

At launch time, saved parameters are prepended to any extra arguments you pass on the command line:

```bash
# account 'work' has launchParams: ["--dangerously-skip-permissions"]
cam use work --verbose
# agent receives: --dangerously-skip-permissions --verbose
```

## Account override

You can bypass the account specified in a `.camrc` with the `use <account>` command to launch with an account of your choosing:

```bash
cam use work
```

## How It Works

Each account gets its own isolated profile directory (`~/.claude-<name>/`). When you run `cam`, it:

1. Searches the current directory and all parents for a `.camrc` file
2. If found, reads the account name from that file; otherwise falls back to the configured default
3. Launches the agent pointing at the matching profile directory (i.e. the `CLAUDE_CONFIG_DIR` value for Claude Code)

Authentication state is kept separate per profile. Shared config (settings, hooks, skills) is symlinked from your default `~/.claude/` directory so changes apply everywhere.

## `.camrc` Format

A `.camrc` file contains a single account name:

```
work
```

Comments are supported:

```
# Use the work account for this project
work
```

`.camrc` files are inherited — a file in a parent directory applies to all subdirectories unless a closer `.camrc` overrides it. This means you can place one `.camrc` in `~/work/` and all projects under it will use that account automatically.

## Commands

| Command | Description |
|---|---|
| `cam` | Launch using the account from `.camrc`, default, or prompt |
| `cam use <name> [args...]` | Launch with a specific account, bypassing `.camrc` |
| `cam add <name> [params...]` | Create a new account; optional params are saved as launch parameters |
| `cam edit <name>` | Interactively edit an account's saved launch parameters |
| `cam default [name]` | Set or show the default account |
| `cam list` | List all configured accounts |
| `cam whoami` | Show which account resolves for the current directory |
| `cam remove <name>` | Remove an account and delete its profile directory |

## Configuration file

cam stores its account registry at:

```
~/.config/cam/accounts.json       # default
$XDG_CONFIG_HOME/cam/accounts.json  # if XDG_CONFIG_HOME is set
```

The file is plain JSON and looks like this:

```json
{
  "version": 1,
  "default": "work",
  "accounts": {
    "personal": {
      "agent": "claude",
      "profileDir": "~/.claude-personal",
      "createdAt": "2026-01-01T00:00:00.000Z"
    },
    "work": {
      "agent": "claude",
      "profileDir": "~/.claude-work",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "launchParams": ["--dangerously-skip-permissions"]
    }
  }
}
```

| Field | Description |
|---|---|
| `version` | Schema version, currently `1` |
| `default` | Name of the default account (set by `cam default`) |
| `accounts.<name>.agent` | Agent type, currently always `claude` |
| `accounts.<name>.profileDir` | Path to the isolated profile directory |
| `accounts.<name>.createdAt` | ISO 8601 timestamp of when the account was created |
| `accounts.<name>.launchParams` | Optional array of arguments prepended at launch |

The file is managed by cam commands — direct edits are supported but not required.

## Example Setup

```
~/.camrc (or ~/personal/.camrc)   →  personal
~/work/.camrc                     →  work
~/work/client-a/.camrc            →  client-a
```

```bash
cam add personal
cam add work
cam add client-a

cd ~/personal/my-blog
cam whoami   # personal
cam          # launches with personal account

cd ~/work/my-app
cam whoami   # work
cam          # launches with work account

cd ~/work/client-a/project
cam whoami   # client-a
cam          # launches with client-a account
```