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

  it('finds .camrc in the current directory', async () => {
    await fs.writeFile(path.join(tmpDir, '.camrc'), 'work\n')
    const result = await findCamrc(tmpDir)
    expect(result).not.toBeNull()
    expect(result!.accountName).toBe('work')
    expect(result!.foundAt).toBe(path.join(tmpDir, '.camrc'))
  })

  it('finds .camrc in a parent directory', async () => {
    await fs.writeFile(path.join(tmpDir, '.camrc'), 'personal\n')
    const child = path.join(tmpDir, 'subdir', 'deeper')
    await fs.mkdir(child, { recursive: true })
    const result = await findCamrc(child)
    expect(result).not.toBeNull()
    expect(result!.accountName).toBe('personal')
  })

  it('child .camrc overrides parent .camrc', async () => {
    await fs.writeFile(path.join(tmpDir, '.camrc'), 'parent-account\n')
    const child = path.join(tmpDir, 'subdir')
    await fs.mkdir(child)
    await fs.writeFile(path.join(child, '.camrc'), 'child-account\n')
    const result = await findCamrc(child)
    expect(result!.accountName).toBe('child-account')
  })

  it('ignores comment lines', async () => {
    await fs.writeFile(path.join(tmpDir, '.camrc'), '# this is a comment\nwork\n')
    const result = await findCamrc(tmpDir)
    expect(result!.accountName).toBe('work')
  })

  it('ignores inline comments', async () => {
    await fs.writeFile(path.join(tmpDir, '.camrc'), 'work # my work account\n')
    const result = await findCamrc(tmpDir)
    expect(result!.accountName).toBe('work')
  })

  it('returns null for empty .camrc', async () => {
    await fs.writeFile(path.join(tmpDir, '.camrc'), '# just a comment\n')
    const result = await findCamrc(tmpDir)
    expect(result).toBeNull()
  })
})
