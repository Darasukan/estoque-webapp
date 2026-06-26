import assert from 'node:assert/strict'
import test from 'node:test'
import { nextMotorMaintenanceStatus } from '../server/utils/motorStatus.js'

test('motor status follows open work orders', () => {
  assert.equal(nextMotorMaintenanceStatus('ativo', 1), 'em_manutencao')
  assert.equal(nextMotorMaintenanceStatus('em_manutencao', 2), 'em_manutencao')
  assert.equal(nextMotorMaintenanceStatus('em_manutencao', 0, 'reserva'), 'reserva')
  assert.equal(nextMotorMaintenanceStatus('em_manutencao', 0, 'inativo'), 'inativo')
  assert.equal(nextMotorMaintenanceStatus('em_manutencao', 0), 'ativo')
  assert.equal(nextMotorMaintenanceStatus('reserva', 0), 'reserva')
})
