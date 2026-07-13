import assert from 'node:assert/strict'
import test from 'node:test'
import { devProcesses } from '../server/scripts/dev.js'
import { assertResetAllowed, isProductionEnv, seedMutationAllowed, PROD_RESET_CONFIRMATION } from '../server/utils/maintenanceGuard.js'
import { isOwnPasswordChangeRequest, passwordChangeError } from '../server/utils/authPolicy.js'
import { startBackupScheduler } from '../server/backup.js'
import { backupCountdownLabel } from '../src/utils/backupStatus.js'

test('backup scheduler exposes the next automatic run', () => {
  const previousEnabled = process.env.BACKUP_ENABLED
  const previousInterval = process.env.BACKUP_INTERVAL_HOURS
  process.env.BACKUP_ENABLED = 'true'
  process.env.BACKUP_INTERVAL_HOURS = '24'

  const scheduler = startBackupScheduler({})
  const status = scheduler.status()
  scheduler.stop()

  if (previousEnabled === undefined) delete process.env.BACKUP_ENABLED
  else process.env.BACKUP_ENABLED = previousEnabled
  if (previousInterval === undefined) delete process.env.BACKUP_INTERVAL_HOURS
  else process.env.BACKUP_INTERVAL_HOURS = previousInterval

  assert.equal(status.status, 'pending')
  assert.equal(status.intervalHours, 24)
  assert.ok(Date.parse(status.nextRunAt) > Date.now())
})

test('backup countdown uses a stable tabular time label', () => {
  const now = Date.parse('2026-07-13T12:00:00.000Z')
  assert.equal(backupCountdownLabel({ status: 'ok', nextRunAt: '2026-07-14T13:02:03.000Z' }, now), '1d 01:02:03')
  assert.equal(backupCountdownLabel({ status: 'running' }, now), 'Backup em andamento')
  assert.equal(backupCountdownLabel({ status: 'disabled' }, now), 'Backups desativados')
})

test('dev starts API watch and Vite together', () => {
  assert.equal(devProcesses.length, 2)
  assert.deepEqual(devProcesses[0].args, ['--watch', 'server/index.js', '--env=.env.dev'])
  assert.match(devProcesses[1].args[0], /vite[\\/]bin[\\/]vite\.js$/)
})

test('production reset requires explicit confirmation', () => {
  assert.throws(
    () => assertResetAllowed({ mode: 'reset', envFile: '.env.prod', confirmation: '' }),
    /bloqueado/
  )
  assert.doesNotThrow(() => assertResetAllowed({
    mode: 'reset',
    envFile: '.env.prod',
    confirmation: PROD_RESET_CONFIRMATION,
  }))
  assert.doesNotThrow(() => assertResetAllowed({ mode: 'reset', envFile: '.env.dev' }))
  assert.equal(isProductionEnv('config\\.env.prod'), true)
  assert.equal(seedMutationAllowed('.env.prod', true), false)
  assert.equal(seedMutationAllowed('.env.dev'), true)
  assert.equal(seedMutationAllowed('.env', false), false)
})

test('initial-password gate only permits the user own password update', () => {
  assert.equal(isOwnPasswordChangeRequest({
    baseUrl: '/api/auth', method: 'PUT', path: '/users/user_admin',
  }, 'user_admin'), true)
  assert.equal(isOwnPasswordChangeRequest({
    baseUrl: '/api/items', method: 'PUT', path: '/items/1',
  }, 'user_admin'), false)
  assert.match(passwordChangeError('123'), /8 caracteres/)
  assert.match(passwordChangeError('admin123', true), /diferente/)
  assert.equal(passwordChangeError('nova-senha'), '')
})
