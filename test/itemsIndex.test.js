import test from 'node:test'
import assert from 'node:assert/strict'
import { useItems } from '../src/composables/useItems.js'

test('indexes variations and stock by item', () => {
  const { variations, getVariationsForItem, getTotalStock } = useItems()
  variations.value = [
    { id: 'v2', itemId: 'item-a', values: { Cor: 'Verde' }, stock: 2 },
    { id: 'v3', itemId: 'item-b', values: { Cor: 'Azul' }, stock: 7 },
    { id: 'v1', itemId: 'item-a', values: { Cor: 'Azul' }, stock: 3 },
  ]

  assert.deepEqual(getVariationsForItem('item-a').map(v => v.id), ['v1', 'v2'])
  assert.equal(getTotalStock('item-a'), 5)
  assert.equal(getTotalStock('missing'), 0)

  variations.value[0].stock = 10
  assert.equal(getTotalStock('item-a'), 13)
})
