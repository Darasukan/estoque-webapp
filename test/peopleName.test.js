import assert from 'node:assert/strict'
import test from 'node:test'
import { formatPersonName, formatRoleName } from '../src/composables/usePeople.js'

test('formata nome de pessoa com inicial maiuscula em cada palavra', () => {
  assert.equal(formatPersonName('  aNDRÉ   sILVA costa  '), 'André Silva Costa')
  assert.equal(formatPersonName('ana-maria d almeida'), 'Ana-Maria D Almeida')
})

test('formata cargo da pessoa com a mesma regra', () => {
  assert.equal(formatRoleName('OPERADOR MAQ SALA DE PANO CRU'), 'Operador Maq Sala De Pano Cru')
})
