import { spawn, spawnSync } from 'child_process'

const target = String(process.argv[2] || 'prod').toLowerCase()
const envByTarget = {
  dev: { file: '.env.dev', mode: 'dev' },
  desenvolvimento: { file: '.env.dev', mode: 'dev' },
  master: { file: '.env.prod', mode: 'prod' },
  prod: { file: '.env.prod', mode: 'prod' },
  producao: { file: '.env.prod', mode: 'prod' },
  production: { file: '.env.prod', mode: 'prod' },
}

const envConfig = envByTarget[target]

if (!envConfig) {
  console.error('Ambiente invalido. Use: npm start dev | npm start master | npm start prod')
  process.exit(1)
}

const envFile = envConfig.file

console.log(`Build + server usando ${envFile}`)

const build = spawnSync('npm', ['run', 'build', '--', '--mode', envConfig.mode], {
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
