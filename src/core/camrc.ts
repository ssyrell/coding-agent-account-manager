import fs from 'fs/promises'
import path from 'path'

export interface CamrcResult {
  accountName: string
  foundAt: string
}

/**
 * Walk up the directory tree from startDir looking for a .camrc file.
 * Returns the account name and the path where .camrc was found, or null if not found.
 */
export async function findCamrc(startDir: string): Promise<CamrcResult | null> {
  let dir = path.resolve(startDir)
  const root = path.parse(dir).root

  while (true) {
    const candidate = path.join(dir, '.camrc')
    try {
      const content = await fs.readFile(candidate, 'utf8')
      const accountName = parseCamrc(content)
      if (accountName) {
        return { accountName, foundAt: candidate }
      }
    } catch {
      // file not found or unreadable — keep walking up
    }

    if (dir === root) break
    dir = path.dirname(dir)
  }

  return null
}

function parseCamrc(content: string): string | null {
  for (const line of content.split('\n')) {
    const trimmed = line.replace(/#.*$/, '').trim()
    if (trimmed) return trimmed
  }
  return null
}
