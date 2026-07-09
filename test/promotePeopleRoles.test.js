import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import Database from 'better-sqlite3'
import { assertPromoteAllowed, PROMOTE_CONFIRMATION, promotePeopleRoles } from '../server/scripts/promotePeopleRoles.js'

function createPeopleRolesDb(path, { roles = [], people = [] } = {}) {
  const db = new Database(path)
  db.exec(`
    CREATE TABLE roles (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT DEFAULT '', active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE people (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      role_text TEXT DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'ativo' CHECK(status IN ('ativo','inativo','demitido','afastado'))
    );
  `)
  const insertRole = db.prepare('INSERT INTO roles (id, name, description, active) VALUES (?, ?, ?, ?)')
  const insertPerson = db.prepare('INSERT INTO people (id, name, role_text, active, status) VALUES (?, ?, ?, ?, ?)')
  for (const role of roles) insertRole.run(role.id, role.name, role.description || '', role.active ?? 1)
  for (const person of people) insertPerson.run(person.id, person.name, person.role_text || '', person.active ?? 1, person.status || 'ativo')
  db.close()
}

function rows(path, table) {
  const db = new Database(path, { readonly: true })
  try {
    return db.prepare(`SELECT * FROM ${table} ORDER BY name`).all()
  } finally {
    db.close()
  }
}

test('promocao exige confirmacao explicita', () => {
  assert.throws(() => assertPromoteAllowed(''), /Promocao bloqueada/)
  assert.doesNotThrow(() => assertPromoteAllowed(PROMOTE_CONFIRMATION))
})

test('promove pessoas e cargos do dev para prod com backup', async t => {
  const dir = await mkdtemp(join(os.tmpdir(), 'estoque-promote-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const devPath = join(dir, 'dev.db')
  const prodPath = join(dir, 'prod.db')
  const backupDir = join(dir, 'backups')

  createPeopleRolesDb(devPath, {
    roles: [
      { id: 'role_dev_1', name: 'OPERADOR DE RAMEUSE', description: 'Opera maquina', active: 1 },
      { id: 'role_dev_2', name: 'ALMOXARIFE', description: 'Controle', active: 1 },
    ],
    people: [
      { id: 'person_dev_1', name: 'ANDRE SILVA COSTA', role_text: 'OPERADOR DE RAMEUSE', active: 1, status: 'ativo' },
    ],
  })
  createPeopleRolesDb(prodPath, {
    roles: [{ id: 'role_prod_1', name: 'operador de rameuse', description: '', active: 0 }],
    people: [{ id: 'person_prod_1', name: 'Andre Silva Costa', role_text: 'Ajudante', active: 0, status: 'inativo' }],
  })

  const result = await promotePeopleRoles({ devPath, prodPath, backupDir })

  assert.equal(result.rolesInserted, 1)
  assert.equal(result.rolesUpdated, 1)
  assert.equal(result.peopleInserted, 0)
  assert.equal(result.peopleUpdated, 1)
  assert.ok(existsSync(result.backupPath))
  assert.deepEqual(rows(prodPath, 'roles').map(row => row.name), ['Almoxarife', 'Operador De Rameuse'])
  assert.deepEqual(rows(prodPath, 'people').map(row => [row.name, row.role_text, row.status]), [
    ['Andre Silva Costa', 'Operador De Rameuse', 'ativo'],
  ])
})
