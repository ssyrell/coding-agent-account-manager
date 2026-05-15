import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { findCamrc } from '../src/core/camrc.js'

async function mkdtemp(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'cam-test-'))
}

describe('findCamrc', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp()
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('returns null when no .camrc exists', async () => {
    const result = await findCamrc(tmpDir)
    expect(result).toBeNull()
  })

  it('parses canonical "<agent> <name>" format', async () => {
    await fs.writeFile(path.join(tmpDir, '.camrc'), 'copilot work\n')
    const result = await findCamrc(tmpDir)
    expect(result).not.toBeNull()
    expect(result!.agent).toBe('copilot')
    expect(result!.name).toBe('work')
    expect(result!.isLegacyFormat).toBe(false)
    expect(result!.foundAt).toBe(path.join(tmpDir, '.camrc'))
  })

  it('finds .camrc in a parent directory', async () => {
    await fs.writeFile(path.join(tmpDir, '.camrc'), 'claude personal\n')
    const child = path.join(tmpDir, 'subdir', 'deeper')
    await fs.mkdir(child, { recursive: true })
    const result = await findCamrc(child)
    expect(result!.agent).toBe('claude')
    expect(result!.name).toBe('personal')
  })

  it('child .camrc overrides parent .camrc', async () => {
    await fs.writeFile(path.join(tmpDir, '.camrc'), 'claude parent-account\n')
    const child = path.join(tmpDir, 'subdir')
    await fs.mkdir(child)
    await fs.writeFile(path.join(child, '.camrc'), 'copilot child-account\n')
    const result = await findCamrc(child)
    expect(result!.agent).toBe('copilot')
    expect(result!.name).toBe('child-account')
  })

  it('ignores comment lines', async () => {
    await fs.writeFile(path.join(tmpDir, '.camrc'), '# this is a comment\nclaude work\n')
    const result = await findCamrc(tmpDir)
    expect(result!.agent).toBe('claude')
    expect(result!.name).toBe('work')
  })

  it('ignores inline comments', async () => {
    await fs.writeFile(path.join(tmpDir, '.camrc'), 'claude work # my work account\n')
    const result = await findCamrc(tmpDir)
    expect(result!.agent).toBe('claude')
    expect(result!.name).toBe('work')
  })

  it('returns null for empty .camrc', async () => {
    await fs.writeFile(path.join(tmpDir, '.camrc'), '# just a comment\n')
    const result = await findCamrc(tmpDir)
    expect(result).toBeNull()
  })

  describe('legacy single-token format', () => {
    it('defaults to the claude agent', async () => {
      await fs.writeFile(path.join(tmpDir, '.camrc'), 'work\n')
      const result = await findCamrc(tmpDir)
      expect(result!.agent).toBe('claude')
      expect(result!.name).toBe('work')
      expect(result!.isLegacyFormat).toBe(true)
    })
  })
})
