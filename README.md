# cam — Coding Agent Account Manager

Automatically use the right coding agent account based on your current working directory. Works like `nvm` — place a `.camrc` file in a project and `cam` picks the right account when you launch.

Currently supports [Claude Code](https://claude.ai/code), with a plugin architecture for adding other agents in the future.

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

**2. Authenticate**

Launch the agent under that account and log in:

```bash
cam use work
# Inside Claude Code, run: /login
```

**3. Add a `.camrc` to your project**

```bash
echo "work" > ~/work/my-project/.camrc
```

**4. Launch**

```bash
cd ~/work/my-project
cam
```

`cam` walks up the directory tree, finds `.camrc`, and launches Claude Code with the matching account. No flags, no aliases — just `cam`.

## How It Works

Each account gets its own isolated profile directory (`~/.claude-<name>/`). When you run `cam`, it:

1. Searches the current directory and all parents for a `.camrc` file
2. Reads the account name from that file
3. Launches the agent with `CLAUDE_HOME` pointing at the matching profile directory

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
| `cam` | Launch the agent using the account from `.camrc` |
| `cam use <name>` | Launch with a specific account, bypassing `.camrc` |
| `cam add <name>` | Create a new account and set up its profile directory |
| `cam list` | List all configured accounts |
| `cam whoami` | Show which account resolves for the current directory |
| `cam remove <name>` | Remove an account and delete its profile directory |

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

## Multiple Agents (Future)

The account config supports an `agent` field for future multi-agent support. When creating an account you'll be prompted to choose an agent if more than one is available (e.g. `claude`, `cursor`).
