import fs from 'fs/promises'
import path from 'path'
import { camConfigDir, ensureDir, fileExists } from '../utils/fs.js'
import { migrateIfNeeded } from './migrate.js'

export interface AccountConfig {
  profileDir: string
  createdAt: string
  launchParams?: string[]
}

export interface AccountRef {
  agent: string
  name: string
}

export interface CamConfig {
  version: number
  accounts: Record<string, Record<string, AccountConfig>>
  default?: AccountRef
}

function accountsFilePath(): string {
  return path.join(camConfigDir(), 'accounts.json')
}

export async function loadConfig(): Promise<CamConfig> {
  await migrateIfNeeded()
  const filePath = accountsFilePath()
  if (!(await fileExists(filePath))) {
    return { version: 2, accounts: {} }
  }
  const raw = await fs.readFile(filePath, 'utf8')
  return JSON.parse(raw) as CamConfig
}

export async function saveConfig(config: CamConfig): Promise<void> {
  await ensureDir(camConfigDir())
  await fs.writeFile(accountsFilePath(), JSON.stringify(config, null, 2) + '\n', 'utf8')
}

export async function getAccount(agent: string, name: string): Promise<AccountConfig | null> {
  const config = await loadConfig()
  return config.accounts[agent]?.[name] ?? null
}

export async function addAccount(agent: string, name: string, account: AccountConfig): Promise<void> {
  const config = await loadConfig()
  if (!config.accounts[agent]) {
    config.accounts[agent] = {}
  }
  config.accounts[agent][name] = account
  await saveConfig(config)
}

export async function removeAccount(agent: string, name: string): Promise<void> {
  const config = await loadConfig()
  const forAgent = config.accounts[agent]
  if (!forAgent) return
  delete forAgent[name]
  if (Object.keys(forAgent).length === 0) {
    delete config.accounts[agent]
  }
  await saveConfig(config)
}

export function accountExists(config: CamConfig, agent: string, name: string): boolean {
  return Boolean(config.accounts[agent]?.[name])
}

export async function updateAccount(
  agent: string,
  name: string,
  updates: Partial<AccountConfig>
): Promise<void> {
  const config = await loadConfig()
  const existing = config.accounts[agent]?.[name]
  if (!existing) return
  const merged = { ...existing, ...updates }
  if (!merged.launchParams?.length) {
    delete merged.launchParams
  }
  config.accounts[agent]![name] = merged
  await saveConfig(config)
}

export async function getDefault(): Promise<AccountRef | null> {
  const config = await loadConfig()
  return config.default ?? null
}

export async function setDefault(agent: string, name: string): Promise<void> {
  const config = await loadConfig()
  config.default = { agent, name }
  await saveConfig(config)
}

export async function clearDefault(): Promise<void> {
  const config = await loadConfig()
  delete config.default
  await saveConfig(config)
}

/**
 * Iterate all accounts across all agents as { agent, name, account } tuples.
 * Convenient for `cam list` and for resolving a legacy `.camrc` (which only
 * contains a name) against every agent that might own it.
 */
export function allAccounts(
  config: CamConfig
): Array<{ agent: string; name: string; account: AccountConfig }> {
  const out: Array<{ agent: string; name: string; account: AccountConfig }> = []
  for (const [agent, byName] of Object.entries(config.accounts)) {
    for (const [name, account] of Object.entries(byName)) {
      out.push({ agent, name, account })
    }
  }
  return out
}
