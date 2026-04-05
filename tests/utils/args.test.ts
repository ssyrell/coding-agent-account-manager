import { describe, it, expect } from 'vitest'
import { parseArgs, formatArgs } from '../../src/utils/args.js'

describe('parseArgs', () => {
  it('parses a single unquoted arg', () => {
    expect(parseArgs('--flag')).toEqual(['--flag'])
  })

  it('parses multiple unquoted args', () => {
    expect(parseArgs('--foo --bar --baz')).toEqual(['--foo', '--bar', '--baz'])
  })

  it('treats extra whitespace between args as a single separator', () => {
    expect(parseArgs('--foo   --bar')).toEqual(['--foo', '--bar'])
  })

  it('returns empty array for empty string', () => {
    expect(parseArgs('')).toEqual([])
  })

  it('returns empty array for whitespace-only string', () => {
    expect(parseArgs('   ')).toEqual([])
  })

  it('preserves a space inside double quotes as one arg', () => {
    expect(parseArgs('"/color blue"')).toEqual(['/color blue'])
  })

  it('preserves a space inside single quotes as one arg', () => {
    expect(parseArgs("'/color blue'")).toEqual(['/color blue'])
  })

  it('strips the surrounding quotes from the result', () => {
    expect(parseArgs('"hello world"')).toEqual(['hello world'])
  })

  it('handles a quoted arg alongside unquoted args', () => {
    expect(parseArgs('--flag "/color blue" --other')).toEqual([
      '--flag',
      '/color blue',
      '--other',
    ])
  })

  it('handles multiple quoted args', () => {
    expect(parseArgs('"/color blue" "/size large"')).toEqual(['/color blue', '/size large'])
  })

  it('merges adjacent quoted and unquoted segments into one arg', () => {
    expect(parseArgs('pre"mid dle"post')).toEqual(['premid dlepost'])
  })

  it('handles single quotes inside double-quoted string as literals', () => {
    expect(parseArgs(`"it's fine"`)).toEqual(["it's fine"])
  })

  it('handles double quotes inside single-quoted string as literals', () => {
    expect(parseArgs(`'say "hi"'`)).toEqual(['say "hi"'])
  })

  it('handles an empty double-quoted string', () => {
    expect(parseArgs('""')).toEqual([''])
  })
})

describe('formatArgs', () => {
  it('returns an empty string for an empty array', () => {
    expect(formatArgs([])).toBe('')
  })

  it('returns the arg unchanged when it contains no spaces', () => {
    expect(formatArgs(['--flag'])).toBe('--flag')
  })

  it('joins multiple unquoted args with spaces', () => {
    expect(formatArgs(['--foo', '--bar'])).toBe('--foo --bar')
  })

  it('wraps an arg that contains a space in double quotes', () => {
    expect(formatArgs(['/color blue'])).toBe('"/color blue"')
  })

  it('mixes quoted and unquoted args correctly', () => {
    expect(formatArgs(['--flag', '/color blue', '--other'])).toBe('--flag "/color blue" --other')
  })

  it('escapes embedded double quotes in a quoted arg', () => {
    expect(formatArgs(['say "hi"'])).toBe('"say \\"hi\\""')
  })
})

describe('parseArgs / formatArgs round-trip', () => {
  it('round-trips plain args', () => {
    const args = ['--foo', '--bar', '--baz']
    expect(parseArgs(formatArgs(args))).toEqual(args)
  })

  it('round-trips args that contain spaces', () => {
    const args = ['--flag', '/color blue', '/size large']
    expect(parseArgs(formatArgs(args))).toEqual(args)
  })

  it('round-trips a mix of plain and spaced args', () => {
    const args = ['--dangerously-skip-permissions', '/color blue', '--model', 'claude-opus-4-6']
    expect(parseArgs(formatArgs(args))).toEqual(args)
  })
})
