import { spawn } from 'node:child_process'
import { copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const devProcesses = [
  { label: 'API', args: ['--watch', 'server/index.js', '--env=.env.dev'] },
  { label: 'Web', args: [resolve('node_modules/vite/bin/vite.js'), '--mode', 'dev'] },
]

export function runDev() {
  if (!existsSync('.env.dev')) {
    copyFileSync('.env.example', '.env.dev')
    console.log('Criado .env.dev a partir de .env.example')
  }
  const children = devProcesses.map(({ label, args }) => {
    const child = spawn(process.execPath, args, { stdio: 'inherit' })
    child.on('error', err => console.error(`${label}: ${err.message}`))
    return child
  })

  let stopping = false
  function stop(code = 0) {
    if (stopping) return
    stopping = true
    for (const child of children) child.kill()
    process.exitCode = code
  }

  for (const child of children) {
    child.on('exit', code => {
      if (!stopping) stop(code || 0)
    })
  }

  process.on('SIGINT', () => stop())
  process.on('SIGTERM', () => stop())
  return { children, stop }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) runDev()
