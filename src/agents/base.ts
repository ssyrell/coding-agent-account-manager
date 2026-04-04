export interface AgentDriver {
  /** Identifier used in accounts.json `agent` field */
  readonly name: string
  /** The executable name on PATH */
  readonly binaryName: string
  /** Derive the profile directory path for a given account name */
  getProfileDir(accountName: string): string
  /** Create the profile directory and wire up shared config */
  setupProfile(accountName: string): Promise<void>
  /** Remove the profile directory */
  teardownProfile(accountName: string): Promise<void>
  /** Launch the agent pointing at the given profile directory */
  launch(profileDir: string, args: string[]): Promise<void>
}
