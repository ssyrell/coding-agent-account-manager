/**
 * Parse a string into an argument array, respecting single- and double-quoted
 * groups. Quotes are stripped from the output; spaces inside quotes are preserved
 * as part of the same argument.
 *
 * Examples:
 *   parseArgs('--flag')                  → ['--flag']
 *   parseArgs('"/color blue"')           → ['/color blue']
 *   parseArgs("--flag '/color blue'")    → ['--flag', '/color blue']
 *   parseArgs('a"b c"d')                 → ['ab cd']   (adjacent segments merge)
 */
export function parseArgs(input: string): string[] {
  const args: string[] = []
  let current = ''
  let inSingle = false
  let inDouble = false
  // Tracks whether we have started an arg (entering a quote counts, even if no
  // characters are added, so that "" produces a single empty-string argument).
  let inArg = false

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!

    if (ch === '"' && !inSingle) {
      inDouble = !inDouble
      inArg = true
    } else if (ch === "'" && !inDouble) {
      inSingle = !inSingle
      inArg = true
    } else if (ch === ' ' && !inSingle && !inDouble) {
      if (inArg) {
        args.push(current)
        current = ''
        inArg = false
      }
    } else {
      current += ch
      inArg = true
    }
  }

  if (inArg) args.push(current)
  return args
}

/**
 * Serialize an argument array back to a display string suitable for re-parsing
 * with parseArgs. Arguments that contain spaces are wrapped in double quotes;
 * any embedded double quotes are escaped.
 *
 * Examples:
 *   formatArgs(['--flag'])            → '--flag'
 *   formatArgs(['/color blue'])       → '"/color blue"'
 *   formatArgs(['--flag', '/color blue']) → '--flag "/color blue"'
 */
export function formatArgs(args: string[]): string {
  return args
    .map(arg => {
      if (!arg.includes(' ')) return arg
      return `"${arg.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
    })
    .join(' ')
}
