import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import net from 'node:net'
import os from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import Database from 'better-sqlite3'

async function freePort() {
  const server = net.createServer()
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject))
  const { port } = server.address()
  await new Promise(resolve => server.close(resolve))
  return port
}

async function waitForServer(url, child, logs) {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Servidor encerrou antes da migração:\n${logs()}`)
    try {
      const response = await fetch(`${url}/api/health`)
      if (response.ok) return
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(`Servidor não iniciou em 10 segundos:\n${logs()}`)
}

test('migração versionada cria backup antes de alterar um banco existente', { timeout: 20_000 }, async t => {
  const tempDir = await mkdtemp(join(os.tmpdir(), 'estoque-migration-'))
  const dbPath = join(tempDir, 'legacy.db')
  const backupDir = join(tempDir, 'backups')
  const legacyDb = new Database(dbPath)
  legacyDb.exec("CREATE TABLE legacy_marker (value TEXT); INSERT INTO legacy_marker VALUES ('preservado');")
  legacyDb.pragma('user_version = 0')
  legacyDb.close()

  const port = await freePort()
  const url = `http://127.0.0.1:${port}`
  let output = ''
  const child = spawn(process.execPath, ['server/index.js', '--env=.env.test'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      DB_PATH: dbPath,
      BACKUP_DIR: backupDir,
      BACKUP_ENABLED: 'false',
      CORS_ORIGINS: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout.on('data', chunk => { output += chunk })
  child.stderr.on('data', chunk => { output += chunk })

  t.after(async () => {
    if (child.exitCode === null) child.kill()
    await Promise.race([
      new Promise(resolve => child.once('exit', resolve)),
      new Promise(resolve => setTimeout(resolve, 3000)),
    ])
    await rm(tempDir, { recursive: true, force: true })
  })

  await waitForServer(url, child, () => output)

  const backups = (await readdir(backupDir)).filter(name => name.endsWith('.db'))
  assert.equal(backups.length, 1)
  const backupDb = new Database(join(backupDir, backups[0]), { readonly: true })
  assert.equal(backupDb.prepare('SELECT value FROM legacy_marker').pluck().get(), 'preservado')
  assert.equal(backupDb.pragma('user_version', { simple: true }), 0)
  backupDb.close()

  const migratedDb = new Database(dbPath, { readonly: true })
  assert.equal(migratedDb.pragma('user_version', { simple: true }), 1)
  assert.ok(migratedDb.prepare('PRAGMA table_info(sessions)').all().some(column => column.name === 'expires_at'))
  assert.ok(migratedDb.prepare('PRAGMA table_info(items)').all().some(column => column.name === 'active'))
  migratedDb.close()
})
