import type { AgentDriver } from './base.js'
import { ClaudeDriver } from './claude.js'
import { CopilotDriver } from './copilot.js'

const registry: Record<string, AgentDriver> = {
  claude: new ClaudeDriver(),
  copilot: new CopilotDriver(),
  // cursor: new CursorDriver(),   // future
  // windsurf: new WindsurfDriver(), // future
}

export function getDriver(agentName: string): AgentDriver | null {
  return registry[agentName] ?? null
}

export function listDrivers(): string[] {
  return Object.keys(registry)
}
