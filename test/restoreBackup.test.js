import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import Database from 'better-sqlite3'
import { assertRestoreAllowed, RESTORE_CONFIRMATION, restoreBackup } from '../server/scripts/restoreBackup.js'

function createDatabase(path, value) {
  const db = new Database(path)
  db.exec('CREATE TABLE state (value TEXT NOT NULL)')
  db.prepare('INSERT INTO state VALUES (?)').run(value)
  db.close()
}

function readValue(path) {
  const db = new Database(path, { readonly: true })
  try {
    return db.prepare('SELECT value FROM state').pluck().get()
  } finally {
    db.close()
  }
}

test('restauracao exige confirmacao explicita', () => {
  assert.throws(() => assertRestoreAllowed(''), /Restauracao bloqueada/)
  assert.doesNotThrow(() => assertRestoreAllowed(RESTORE_CONFIRMATION))
})

test('restaura backup valido e preserva copia do banco anterior', async t => {
  const dir = await mkdtemp(join(os.tmpdir(), 'estoque-restore-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const target = join(dir, 'atual.db')
  const source = join(dir, 'backup.db')
  const backupDir = join(dir, 'backups')
  createDatabase(target, 'antes')
  createDatabase(source, 'depois')

  const result = await restoreBackup({ source, target, backupDir })

  assert.equal(readValue(target), 'depois')
  assert.ok(result.safetyBackup)
  assert.equal(readValue(result.safetyBackup), 'antes')
})
