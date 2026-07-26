import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'

const devPort = process.env.DEV_PORT || '3001'
const prodPort = process.env.PROD_PORT || '3000'

if (!existsSync('.env.prod')) {
  const prodEnv = readFileSync('.env.example', 'utf8')
    .replace(/^DB_PATH=.*$/m, 'DB_PATH=./server/estoque-prod.db')
    .replace(/^PHOTO_UPLOAD_DIR=.*$/m, 'PHOTO_UPLOAD_DIR=./server/photo-uploads-prod')
  writeFileSync('.env.prod', prodEnv)
  console.log('Criado .env.prod a partir de .env.example com dados separados de DEV')
}

if (devPort === prodPort) {
  console.error('DEV_PORT e PROD_PORT precisam ser diferentes.')
  process.exit(1)
}

const targets = [
  { label: 'DEV', script: 'server/scripts/dev.js', port: devPort },
  { label: 'PROD', script: 'server/scripts/start.js', port: prodPort },
]

let stopping = false
let restarting = false
let children = []
const interactive = Boolean(process.stdin.isTTY)
let logsVisible = !interactive

function kill(child) {
  if (child.exitCode !== null || !child.pid) return
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  } else {
    child.kill()
  }
}

function start() {
  console.log(`\nIniciando DEV na porta ${devPort} e PROD na porta ${prodPort}`)
  children = targets.map(({ label, script, port }) => {
    const child = spawn(process.execPath, [script], {
      env: { ...process.env, PORT: port },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    child.stdout.on('data', chunk => {
      if (logsVisible) process.stdout.write(chunk)
    })
    child.stderr.on('data', chunk => {
      if (logsVisible) process.stderr.write(chunk)
    })
    child.on('error', error => console.error(`${label}: ${error.message}`))
    child.on('exit', code => {
      if (!stopping && !restarting && children.includes(child) && code) stop(code)
    })
    return child
  })
}

function stop(code = 0) {
  if (stopping) return
  stopping = true
  input?.close()
  for (const child of children) kill(child)
  process.exitCode = code
}

async function restart() {
  if (restarting) return
  restarting = true
  console.log('\nReiniciando DEV e PROD...')
  const exits = children.map(child => child.exitCode === null
    ? new Promise(resolve => {
        const timeout = setTimeout(resolve, 3000)
        child.once('exit', () => {
          clearTimeout(timeout)
          resolve()
        })
      })
    : Promise.resolve())
  for (const child of children) kill(child)
  await Promise.all(exits)
  restarting = false
  start()
}

const input = interactive
  ? createInterface({ input: process.stdin, output: process.stdout })
  : null
input?.on('line', command => {
  switch (command.trim().toLowerCase()) {
    case 'r':
      restart()
      break
    case 'l':
      logsVisible = !logsVisible
      console.log(`\nLogs ${logsVisible ? 'ativados' : 'ocultos'}.`)
      break
    default:
      console.log('Atalhos: R + Enter reinicia | L + Enter ativa/oculta logs')
  }
})

process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())

start()
console.log(interactive
  ? 'Atalhos: R + Enter reinicia | L + Enter ativa/oculta logs | Ctrl+C encerra'
  : 'Logs ativos (terminal não interativo).')
