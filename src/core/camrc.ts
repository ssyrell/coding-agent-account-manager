import fs from 'fs/promises'
import path from 'path'
import * as log from '../utils/log.js'

export interface CamrcResult {
  agent: string
  name: string
  foundAt: string
  /** True if the file used the legacy single-token format (name only). */
  isLegacyFormat: boolean
}

/**
 * Walk up the directory tree from startDir looking for a .camrc file.
 * Returns the resolved account ref and the path where .camrc was found,
 * or null if no .camrc exists in the chain.
 *
 * The .camrc file may use either:
 *   - canonical form: "<agent> <name>"
 *   - legacy form:    "<name>"  (agent defaults to claude)
 */
export async function findCamrc(startDir: string): Promise<CamrcResult | null> {
  let dir = path.resolve(startDir)
  const root = path.parse(dir).root

  while (true) {
    const candidate = path.join(dir, '.camrc')
    try {
      const content = await fs.readFile(candidate, 'utf8')
      const tokens = parseCamrcTokens(content)
      if (tokens) {
        const { agent, name, isLegacyFormat: wasLegacy } = resolveTokens(tokens)
        let isLegacyFormat = wasLegacy
        if (wasLegacy) {
          try {
            await writeCamrc(path.dirname(candidate), agent, name)
            log.info(`Upgraded ${candidate} to modern format: ${agent} ${name}`)
            isLegacyFormat = false
          } catch {
            // leave as-is if the write fails
          }
        }
        return { agent, name, isLegacyFormat, foundAt: candidate }
      }
    } catch {
      // file not found or unreadable — keep walking up
    }

    if (dir === root) break
    dir = path.dirname(dir)
  }

  return null
}

/**
 * Write a `.camrc` file in the given directory pointing at (agent, name).
 * Overwrites any existing .camrc in that directory.
 */
export async function writeCamrc(dir: string, agent: string, name: string): Promise<string> {
  const filePath = path.join(dir, '.camrc')
  await fs.writeFile(filePath, `${agent} ${name}\n`, 'utf8')
  return filePath
}

function parseCamrcTokens(content: string): string[] | null {
  for (const line of content.split('\n')) {
    const trimmed = line.replace(/#.*$/, '').trim()
    if (!trimmed) continue
    const tokens = trimmed.split(/\s+/)
    if (tokens.length >= 1) return tokens.slice(0, 2)
  }
  return null
}

function resolveTokens(tokens: string[]): { agent: string; name: string; isLegacyFormat: boolean } {
  if (tokens.length >= 2) {
    return { agent: tokens[0]!, name: tokens[1]!, isLegacyFormat: false }
  }
  return { agent: 'claude', name: tokens[0]!, isLegacyFormat: true }
}
