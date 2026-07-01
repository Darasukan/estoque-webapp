import test from 'node:test'
import assert from 'node:assert/strict'

import { buildGlobalSearchResults, filterDestinations, findExactDestination, normalizeSearchText } from '../src/utils/globalSearch.js'
import { failedSourceNames } from '../src/utils/sync.js'
import { destinationDescendants, destinationMoveError } from '../src/composables/useDestinations.js'
import { buildMotorDestinationTree, motorMatchesIdentity, motorMatchesSearch, motorOpenEventLabel } from '../src/composables/useMotors.js'
import { getDestinationFullName } from '../server/utils/destinations.js'
import { workOrderCreationDateError } from '../src/utils/workOrderForm.js'
import { workOrderMaintenanceKindLabel, workOrderMaintenanceSearchParts } from '../src/utils/workOrderSearch.js'
import {
  extrasListToObject,
  validateVariationForm,
  variationFormForEdit,
  variationFormForItem,
} from '../src/utils/variationForm.js'

test('variation form helpers preserve catalog behavior', () => {
  const item = { attributes: ['Cor'], minStock: 2, location: 'A1' }
  assert.deepEqual(variationFormForItem(item), {
    values: { Cor: '' }, stock: 0, minStock: 2, extrasList: [], location: 'A1', locations: ['A1'], destinations: [],
  })
  assert.deepEqual(
    variationFormForEdit(item, { values: { Cor: 'Azul' }, stock: 3, extras: { Marca: 'X' }, destinations: [4] }),
    { values: { Cor: 'Azul' }, stock: 3, minStock: 0, extrasList: [{ key: 'Marca', value: 'X' }], location: '', locations: [], destinations: [4] }
  )
  assert.deepEqual(variationFormForEdit(item, { values: {}, stock: 1, locations: ['A1', 'A2'] }).locations, ['A1', 'A2'])
  assert.deepEqual(extrasListToObject([{ key: ' Marca ', value: 'X' }, { key: ' ', value: 'ignorar' }]), { Marca: 'X' })
  assert.equal(validateVariationForm(item, variationFormForItem(item)), 'Preencha ao menos um atributo.')
  assert.equal(validateVariationForm(item, { ...variationFormForItem(item), values: { Cor: 'Azul' }, stock: -1 }), 'Quantidade não pode ser negativa.')
  assert.equal(validateVariationForm(item, { ...variationFormForItem(item), values: { Cor: 'Azul' }, stock: 1 }), null)
})

test('global search remains accent-insensitive and returns catalog targets', () => {
  const results = buildGlobalSearchResults({
    query: 'acido',
    items: [{ id: 1, name: 'Ácido', group: 'Químicos', unit: 'L' }],
    variations: [{ id: 2, itemId: 1, values: { Tipo: 'Forte' }, stock: 3 }],
  })
  assert.deepEqual(results.map(result => result.id), ['item:1', 'var:2'])
  assert.deepEqual(results[0].target, { tab: 'catalogo', itemId: 1, search: 'Ácido' })
})

test('global search shows commands and balances result types', () => {
  const commands = [{ id: 'command:entrada', type: 'Ação', title: 'Registrar entrada', target: {} }]
  assert.deepEqual(buildGlobalSearchResults({ query: '', commands }).map(result => result.id), ['command:entrada'])

  const results = buildGlobalSearchResults({
    query: 'x',
    commands: [{ id: 'command:x', type: 'Ação', title: 'X', target: {} }],
    workOrders: Array.from({ length: 20 }, (_, index) => ({ id: index, number: `X${index}` })),
    items: [{ id: 'item-x', name: 'Material X' }],
    motors: [{ id: 'motor-x', tag: 'Motor X' }],
  })
  assert.deepEqual(results.slice(0, 4).map(result => result.id), ['command:x', 'os:0', 'motor:motor-x', 'item:item-x'])
})

test('destination search returns and opens child destinations', () => {
  const destinations = [
    { id: 'machines', name: 'Máquinas', parentId: null },
    { id: 'machine-1', name: 'Super Máquina 1', parentId: 'machines' },
    { id: 'machine-2', name: 'Outra Máquina', parentId: 'machines' },
  ]

  assert.deepEqual(filterDestinations(destinations, 'super maquina').map(destination => destination.id), ['machine-1'])
  assert.equal(findExactDestination(destinations, 'Super Maquina 1')?.id, 'machine-1')
})

test('sync failures identify only stale data sources', () => {
  assert.deepEqual(failedSourceNames(
    [['materiais'], ['movimentações'], ['motores']],
    [{ status: 'fulfilled' }, { status: 'rejected' }, { status: 'fulfilled' }]
  ), ['movimentações'])
})

test('destination hierarchy supports any depth and blocks cycles', () => {
  const destinations = [
    { id: 'a', name: 'A', parentId: null },
    { id: 'a1', name: 'A1', parentId: 'a' },
    { id: 'a11', name: 'A11', parentId: 'a1' },
    { id: 'b', name: 'B', parentId: null },
  ]

  assert.deepEqual(destinationDescendants(destinations, 'a').map(destination => destination.id), ['a1', 'a11'])
  assert.equal(destinationMoveError(destinations, 'a', 'b'), '')
  assert.match(destinationMoveError(destinations, 'a', 'a11'), /descendente/)
  assert.equal(destinationMoveError(destinations, 'a11', 'b'), '')
  assert.match(destinationMoveError(destinations, 'b', 'b'), /dele mesmo/)
})

test('server resolves destination names at any depth', () => {
  const rows = new Map([
    ['a', { id: 'a', name: 'A', parent_id: null }],
    ['a1', { id: 'a1', name: 'A1', parent_id: 'a' }],
    ['a11', { id: 'a11', name: 'A11', parent_id: 'a1' }],
  ])
  const db = { prepare: () => ({ get: id => rows.get(id) }) }
  assert.equal(getDestinationFullName(db, 'a11'), 'A > A1 > A11')
})

test('motor search combines fields and ignores accents', () => {
  const motor = {
    tag: 'M-001',
    serial: 'ABC123',
    name: 'Motor principal',
    manufacturer: 'WEG',
    power: '5 CV',
    voltage: '380 V',
    rpm: '1750',
    status: 'em_manutencao',
    notes: 'Revisão preventiva',
  }

  assert.equal(motorMatchesSearch(motor, 'weg super manutencao', 'Máquinas > Super Máquina 1'), true)
  assert.equal(motorMatchesSearch(motor, 'siemens'), false)
  assert.equal(motorMatchesSearch({ tag: '1', serial: '1001' }, '1001'), true)
  assert.equal(motorMatchesIdentity({ tag: '1001' }, '1001'), true)
  assert.equal(motorMatchesIdentity({ tag: '1', serial: '1001' }, '1001'), false)
  assert.equal(motorMatchesSearch({ power: '5 CV', powerUnit: 'CV' }, '5', '', 'power_cv'), true)
  assert.equal(motorMatchesSearch({ power: '5 HP', powerUnit: 'HP' }, '5', '', 'power_cv'), false)
  assert.equal(motorMatchesSearch({ power: '5 HP', powerUnit: 'HP' }, '5', '', 'power_hp'), true)
})

test('open motor work orders use activity names for events', () => {
  assert.equal(motorOpenEventLabel('movimentado'), 'Movimentação')
  assert.equal(motorOpenEventLabel('rebobinado'), 'Rebobinação')
  assert.equal(motorOpenEventLabel('instalado'), 'Instalação')
})

test('motor catalog nests motors under parent and child destinations', () => {
  const destinations = [
    { id: 'machines', name: 'Máquinas' },
    { id: 'machine-1', name: 'Super Máquina 1', parentId: 'machines' },
    { id: 'sector-a', name: 'Setor A', parentId: 'machine-1' },
  ]
  const motors = [
    { id: 'm1', tag: 'M-001', destinationId: 'sector-a' },
    { id: 'm2', tag: 'M-002', destinationId: '' },
  ]

  const tree = buildMotorDestinationTree(motors, destinations)
  assert.equal(tree[0].name, 'Máquinas')
  assert.equal(tree[0].motorCount, 1)
  assert.equal(tree[0].children[0].name, 'Super Máquina 1')
  assert.deepEqual(tree[0].children[0].children[0].motors.map(motor => motor.id), ['m1'])
  assert.deepEqual(tree[1].motors.map(motor => motor.id), ['m2'])
})

test('work order maintenance search includes external workshop mapping', () => {
  const order = {
    maintenanceLocationType: 'externa',
    maintenanceExternalLocation: 'Americana Motores',
    maintenanceExternalOrderNumber: 'PED-771',
    motorOriginDestinationName: 'Turbo 1',
    motorEventLabel: 'Rebobinado',
    motorEventPerformedBy: 'Carlos Silva',
    motorEventNotes: 'Troca de rolamento',
  }
  const searchText = normalizeSearchText(workOrderMaintenanceSearchParts(order).join(' '))

  assert.equal(workOrderMaintenanceKindLabel(order), 'Oficina Externa')
  assert.equal(searchText.includes('oficina externa'), true)
  assert.equal(searchText.includes('americana motores'), true)
  assert.equal(searchText.includes('ped-771'), true)
  assert.equal(searchText.includes('rebobinado'), true)
  assert.equal(searchText.includes('carlos silva'), true)
  assert.equal(searchText.includes('troca de rolamento'), true)
})

test('registering a closed work order requires start and end dates', () => {
  assert.equal(workOrderCreationDateError('open', '', ''), '')
  assert.equal(workOrderCreationDateError('open', '2026-06-29', ''), '')
  assert.match(workOrderCreationDateError('register', '', ''), /início/)
  assert.match(workOrderCreationDateError('register', '2026-06-29', ''), /término/)
  assert.equal(workOrderCreationDateError('register', '2026-06-29', '2026-06-29'), '')
})
