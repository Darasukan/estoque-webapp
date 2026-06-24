import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const envFile = '.env.prod'
if (!existsSync(envFile)) {
  console.error('Arquivo .env.prod não encontrado. Copie .env.example e ajuste DB_PATH antes de iniciar produção.')
  process.exit(1)
}
console.log(`Build + servidor usando ${envFile}`)

const build = spawnSync(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'build', '--mode', 'prod'], {
  stdio: 'inherit',
})

if (build.status !== 0) {
  process.exit(build.status || 1)
}

const server = spawn(process.execPath, ['server/index.js', `--env=${envFile}`], {
  stdio: 'inherit',
})

let stopping = false
function stop(code = 0) {
  if (stopping) return
  stopping = true
  if (server.exitCode === null) server.kill()
  process.exitCode = code
}

server.on('exit', (code) => {
  if (!stopping) process.exitCode = code || 0
})

process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())
