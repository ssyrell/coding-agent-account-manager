import path from 'path'
import spawn from 'cross-spawn'
import { camConfigDir, ensureDir } from '../utils/fs.js'
import * as log from '../utils/log.js'

function resolveEditor(filePath: string): { cmd: string; args: string[] } {
  const editorEnv = process.env.VISUAL ?? process.env.EDITOR
  if (editorEnv) {
    const [cmd, ...editorArgs] = editorEnv.trim().split(/\s+/)
    return { cmd: cmd!, args: [...editorArgs, filePath] }
  }
  if (process.platform === 'win32') return { cmd: 'cmd', args: ['/c', 'start', '', filePath] }
  if (process.platform === 'darwin') return { cmd: 'open', args: [filePath] }
  return { cmd: 'xdg-open', args: [filePath] }
}

export async function config(): Promise<void> {
  const filePath = path.join(camConfigDir(), 'accounts.json')
  await ensureDir(camConfigDir())

  const { cmd, args } = resolveEditor(filePath)

  await new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit' })

    child.on('close', (code) => {
      if (code === 0 || code === null) {
        resolve()
      } else {
        log.error(`Editor exited with code ${code}`)
        process.exit(code)
      }
    })

    child.on('error', (err) => reject(err))
  })
}
