import path from 'path'
import spawn from 'cross-spawn'
import { camConfigDir, ensureDir } from '../utils/fs.js'
import * as log from '../utils/log.js'

export async function config(): Promise<void> {
  const filePath = path.join(camConfigDir(), 'accounts.json')
  await ensureDir(camConfigDir())

  const editor = process.env.VISUAL ?? process.env.EDITOR ?? 'open'

  await new Promise<void>((resolve, reject) => {
    const child = spawn(editor, [filePath], { stdio: 'inherit' })

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
