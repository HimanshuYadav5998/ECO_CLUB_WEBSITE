import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const isWin = process.platform === 'win32'

const serverProc = spawn(process.execPath, ['--no-warnings', 'server/index.js'], {
  cwd: rootDir,
  stdio: 'inherit',
  env: { ...process.env, PORT: process.env.PORT || '3001' },
})

const viteCmd = isWin ? 'npx.cmd' : 'npx'
const clientProc = spawn(viteCmd, ['vite'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: isWin,
})

function shutdown() {
  serverProc.kill()
  clientProc.kill()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
serverProc.on('exit', code => {
  if (code && code !== 0) {
    clientProc.kill()
    process.exit(code)
  }
})
clientProc.on('exit', code => {
  serverProc.kill()
  process.exit(code || 0)
})
