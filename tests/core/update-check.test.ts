import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

let tmpDir: string

vi.mock('../../src/utils/fs.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/utils/fs.js')>()
  return {
    ...original,
    camConfigDir: () => path.join(tmpDir, 'cam'),
  }
})

const { checkForUpdate, compareSemver } = await import('../../src/core/update-check.js')

const stateFile = () => path.join(tmpDir, 'cam', 'update-check.json')

describe('compareSemver', () => {
  it('orders numeric segments correctly', () => {
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0)
    expect(compareSemver('1.0.1', '1.0.0')).toBeGreaterThan(0)
    expect(compareSemver('1.0.0', '1.0.1')).toBeLessThan(0)
    expect(compareSemver('2.0.0', '1.99.99')).toBeGreaterThan(0)
    expect(compareSemver('1.10.0', '1.9.0')).toBeGreaterThan(0)
  })

  it('treats equal versions as equal', () => {
    expect(compareSemver('1.2.3', '1.2.3')).toBe(0)
  })

  it('treats pre-release versions as older than the corresponding release', () => {
    expect(compareSemver('1.0.0-beta.1', '1.0.0')).toBeLessThan(0)
    expect(compareSemver('1.0.0', '1.0.0-beta.1')).toBeGreaterThan(0)
  })

  it('pads missing segments with zero', () => {
    expect(compareSemver('1.2', '1.2.0')).toBe(0)
    expect(compareSemver('2', '1.99.99')).toBeGreaterThan(0)
  })
})

describe('checkForUpdate', () => {
  const originalFetch = globalThis.fetch
  const now = Date.parse('2026-05-15T12:00:00Z')

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cam-update-test-'))
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
    globalThis.fetch = originalFetch
    vi.clearAllMocks()
  })

  function mockFetch(impl: typeof fetch): void {
    globalThis.fetch = impl as typeof fetch
  }

  function okResponse(tag: string): Response {
    return new Response(JSON.stringify({ tag_name: tag }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  it('returns the newer version when GitHub reports one', async () => {
    mockFetch(async () => okResponse('v1.1.0'))
    const result = await checkForUpdate('1.0.0', now)
    expect(result).toBe('1.1.0')
  })

  it('strips a leading v from the tag', async () => {
    mockFetch(async () => okResponse('v2.0.0'))
    expect(await checkForUpdate('1.0.0', now)).toBe('2.0.0')
  })

  it('returns null when current version is up to date', async () => {
    mockFetch(async () => okResponse('1.0.0'))
    expect(await checkForUpdate('1.0.0', now)).toBeNull()
  })

  it('returns null when current version is ahead of latest release', async () => {
    mockFetch(async () => okResponse('1.0.0'))
    expect(await checkForUpdate('1.1.0', now)).toBeNull()
  })

  it('persists the check timestamp on success', async () => {
    mockFetch(async () => okResponse('1.1.0'))
    await checkForUpdate('1.0.0', now)
    const raw = await fs.readFile(stateFile(), 'utf8')
    const state = JSON.parse(raw)
    expect(state.lastCheckedAt).toBe(new Date(now).toISOString())
    expect(state.latestVersion).toBe('1.1.0')
  })

  it('persists the check timestamp even when the fetch fails', async () => {
    mockFetch(async () => {
      throw new Error('network down')
    })
    const result = await checkForUpdate('1.0.0', now)
    expect(result).toBeNull()
    const state = JSON.parse(await fs.readFile(stateFile(), 'utf8'))
    expect(state.lastCheckedAt).toBe(new Date(now).toISOString())
  })

  it('returns null when the API returns a non-OK status', async () => {
    mockFetch(async () => new Response('rate limited', { status: 403 }))
    expect(await checkForUpdate('1.0.0', now)).toBeNull()
  })

  it('skips the network call when checked within the last 24 hours', async () => {
    const lastCheck = new Date(now - 60 * 60 * 1000).toISOString()
    await fs.mkdir(path.join(tmpDir, 'cam'), { recursive: true })
    await fs.writeFile(
      stateFile(),
      JSON.stringify({ lastCheckedAt: lastCheck, latestVersion: '1.0.0' })
    )
    const fetchSpy = vi.fn()
    mockFetch(fetchSpy as unknown as typeof fetch)
    const result = await checkForUpdate('1.0.0', now)
    expect(result).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('re-checks once the 24-hour throttle window has elapsed', async () => {
    const lastCheck = new Date(now - 25 * 60 * 60 * 1000).toISOString()
    await fs.mkdir(path.join(tmpDir, 'cam'), { recursive: true })
    await fs.writeFile(
      stateFile(),
      JSON.stringify({ lastCheckedAt: lastCheck, latestVersion: '1.0.0' })
    )
    mockFetch(async () => okResponse('1.2.0'))
    expect(await checkForUpdate('1.0.0', now)).toBe('1.2.0')
  })

  it('treats an unparsable timestamp as no prior check', async () => {
    await fs.mkdir(path.join(tmpDir, 'cam'), { recursive: true })
    await fs.writeFile(stateFile(), JSON.stringify({ lastCheckedAt: 'not-a-date' }))
    mockFetch(async () => okResponse('1.1.0'))
    expect(await checkForUpdate('1.0.0', now)).toBe('1.1.0')
  })

  it('tolerates a corrupted state file', async () => {
    await fs.mkdir(path.join(tmpDir, 'cam'), { recursive: true })
    await fs.writeFile(stateFile(), 'not json')
    mockFetch(async () => okResponse('1.1.0'))
    expect(await checkForUpdate('1.0.0', now)).toBe('1.1.0')
  })
})
