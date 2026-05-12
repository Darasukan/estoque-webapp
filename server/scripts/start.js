import { spawn, spawnSync } from 'child_process'

const target = String(process.argv[2] || 'prod').toLowerCase()
const envByTarget = {
  dev: '.env.dev',
  desenvolvimento: '.env.dev',
  master: '.env.prod',
  prod: '.env.prod',
  producao: '.env.prod',
  production: '.env.prod',
}

const envFile = envByTarget[target]

if (!envFile) {
  console.error('Ambiente invalido. Use: npm start dev | npm start master | npm start prod')
  process.exit(1)
}

console.log(`Build + server usando ${envFile}`)

const build = spawnSync('npm', ['run', 'build'], {
  stdio: 'inherit',
  shell: true,
})

if (build.status !== 0) {
  process.exit(build.status || 1)
}

const server = spawn('node', ['server/index.js', `--env=${envFile}`], {
  stdio: 'inherit',
  shell: true,
})

server.on('exit', (code) => {
  process.exit(code || 0)
})
