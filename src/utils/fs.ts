import fs from 'fs/promises'
import os from 'os'
import path from 'path'

export function homeDir(): string {
  return os.homedir()
}

export function expandHome(p: string): string {
  if (p.startsWith('~/') || p === '~') {
    return path.join(homeDir(), p.slice(2))
  }
  return p
}

export function camConfigDir(): string {
  const xdg = process.env['XDG_CONFIG_HOME']
  const base = xdg ? xdg : path.join(homeDir(), '.config')
  return path.join(base, 'cam')
}

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true })
}

export async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

export async function symlinkIfMissing(target: string, linkPath: string): Promise<void> {
  if (await fileExists(linkPath)) return
  await fs.symlink(target, linkPath)
}
