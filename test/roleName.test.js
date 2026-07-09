import assert from 'node:assert/strict'
import test from 'node:test'
import { formatRoleName } from '../src/composables/usePeople.js'

test('formata nome de cargo com inicial maiuscula em cada palavra', () => {
  assert.equal(formatRoleName('OPERADOR DE RAMEUSE'), 'Operador De Rameuse')
})
