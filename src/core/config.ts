import fs from 'fs/promises'
import path from 'path'
import { camConfigDir, ensureDir, fileExists } from '../utils/fs.js'

export interface AccountConfig {
  agent: string
  profileDir: string
  createdAt: string
  launchParams?: string[]
}

export interface CamConfig {
  version: number
  accounts: Record<string, AccountConfig>
  default?: string
}

function accountsFilePath(): string {
  return path.join(camConfigDir(), 'accounts.json')
}

export async function loadConfig(): Promise<CamConfig> {
  const filePath = accountsFilePath()
  if (!(await fileExists(filePath))) {
    return { version: 1, accounts: {} }
  }
  const raw = await fs.readFile(filePath, 'utf8')
  return JSON.parse(raw) as CamConfig
}

export async function saveConfig(config: CamConfig): Promise<void> {
  await ensureDir(camConfigDir())
  await fs.writeFile(accountsFilePath(), JSON.stringify(config, null, 2) + '\n', 'utf8')
}

export async function getAccount(name: string): Promise<AccountConfig | null> {
  const config = await loadConfig()
  return config.accounts[name] ?? null
}

export async function addAccount(name: string, account: AccountConfig): Promise<void> {
  const config = await loadConfig()
  config.accounts[name] = account
  await saveConfig(config)
}

export async function removeAccount(name: string): Promise<void> {
  const config = await loadConfig()
  delete config.accounts[name]
  await saveConfig(config)
}

export function accountExists(config: CamConfig, name: string): boolean {
  return Object.prototype.hasOwnProperty.call(config.accounts, name)
}

export async function updateAccount(name: string, updates: Partial<AccountConfig>): Promise<void> {
  const config = await loadConfig()
  if (!config.accounts[name]) return
  const merged = { ...config.accounts[name]!, ...updates }
  // Never store an empty launchParams array — omit the key instead
  if (!merged.launchParams?.length) {
    delete merged.launchParams
  }
  config.accounts[name] = merged
  await saveConfig(config)
}

export async function getDefault(): Promise<string | null> {
  const config = await loadConfig()
  return config.default ?? null
}

export async function setDefault(name: string): Promise<void> {
  const config = await loadConfig()
  config.default = name
  await saveConfig(config)
}

export async function clearDefault(): Promise<void> {
  const config = await loadConfig()
  delete config.default
  await saveConfig(config)
}
