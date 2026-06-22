import test from 'node:test'
import assert from 'node:assert/strict'

import { buildGlobalSearchResults } from '../src/utils/globalSearch.js'
import { failedSourceNames } from '../src/utils/sync.js'
import {
  extrasListToObject,
  validateVariationForm,
  variationFormForEdit,
  variationFormForItem,
} from '../src/utils/variationForm.js'

test('variation form helpers preserve catalog behavior', () => {
  const item = { attributes: ['Cor'], minStock: 2, location: 'A1' }
  assert.deepEqual(variationFormForItem(item), {
    values: { Cor: '' }, stock: 0, minStock: 2, extrasList: [], location: 'A1', destinations: [],
  })
  assert.deepEqual(
    variationFormForEdit(item, { values: { Cor: 'Azul' }, stock: 3, extras: { Marca: 'X' }, destinations: [4] }),
    { values: { Cor: 'Azul' }, stock: 3, minStock: 0, extrasList: [{ key: 'Marca', value: 'X' }], location: '', destinations: [4] }
  )
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

test('sync failures identify only stale data sources', () => {
  assert.deepEqual(failedSourceNames(
    [['materiais'], ['movimentações'], ['motores']],
    [{ status: 'fulfilled' }, { status: 'rejected' }, { status: 'fulfilled' }]
  ), ['movimentações'])
})
