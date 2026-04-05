# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

`cam` — Coding Agent Account Manager. Manages multiple AI coding agent accounts (currently Claude Code), switching context based on the current working directory via `.camrc` files. Works like `nvm`.

## Tech Stack

- **Language**: TypeScript (ESM), Node ≥ 18
- **CLI framework**: `commander`
- **Output**: `chalk`
- **Process spawning**: `cross-spawn`
- **Tests**: `vitest`
- **Build**: `tsc` (output to `dist/`)

## Key Architecture

```
src/
  index.ts              # CLI entry point, registers all commands
  commands/             # One file per cam subcommand (add, use, launch, list, remove, whoami)
  core/
    config.ts           # accounts.json read/write (~/.cam/accounts.json)
    camrc.ts            # .camrc file resolution (walks up directory tree)
    profile-manager.ts  # Creates/removes profile dirs, symlinks shared config
  agents/
    base.ts             # Agent interface
    claude.ts           # Claude Code agent implementation (sets CLAUDE_HOME, spawns claude)
    index.ts            # Agent registry
  utils/
    fs.ts               # File system helpers (homeDir, ensureDir, symlinkIfMissing, etc.)
    log.ts              # Logging helpers
```

## Data Model

- **Config file**: `~/.cam/accounts.json` — stores account name → `{ agent, profileDir, createdAt }`
- **Profile dirs**: `~/.claude-<name>/` — isolated Claude config per account
- **Shared entries** (symlinked from `~/.claude/` into each profile): `settings.json`, `hooks`, `agents`, `skills`, `plugins`, `keybindings.json`
- **Auth state** is profile-specific (not symlinked)

## Development

```bash
npm run build       # Compile TypeScript to dist/
npm run dev         # Watch mode
npm test            # Run tests
npm run test:watch  # Watch mode tests
```

To test the CLI locally before publishing:
```bash
npm run build && node dist/index.js <command>
```
