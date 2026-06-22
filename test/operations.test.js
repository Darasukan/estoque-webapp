import assert from 'node:assert/strict'
import test from 'node:test'
import { devProcesses } from '../server/scripts/dev.js'
import { assertResetAllowed, isProductionEnv, seedMutationAllowed, PROD_RESET_CONFIRMATION } from '../server/utils/maintenanceGuard.js'
import { isOwnPasswordChangeRequest, passwordChangeError } from '../server/utils/authPolicy.js'

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
  assert.match(passwordChangeError('123'), /4 caracteres/)
  assert.match(passwordChangeError('admin123', true), /diferente/)
  assert.equal(passwordChangeError('nova-senha'), '')
})
