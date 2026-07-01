import assert from 'node:assert/strict'
import test from 'node:test'
import { summarizeVariationMovements } from '../src/utils/variationMovementStats.js'

test('summarizes regular purchases, consumption, suppliers and prices', () => {
  const stats = summarizeVariationMovements([
    { type: 'entrada', qty: 10, supplier: 'Fornecedor B', unitCost: 8 },
    { type: 'entrada', qty: 20, supplier: 'Fornecedor A', unitCost: 5 },
    { type: 'entrada', qty: 2, supplier: 'fornecedor a', unitCost: 7 },
    { type: 'saida', qty: 3 },
    { type: 'saida', qty: 5 },
    { type: 'entrada', qty: 100, supplier: 'Ajuste', unitCost: 1, docRef: 'AJUSTE' },
  ])

  assert.deepEqual(stats.suppliers, ['Fornecedor A', 'Fornecedor B'])
  assert.equal(stats.averageEntryQty, 32 / 3)
  assert.equal(stats.averageExitQty, 4)
  assert.equal(stats.averageUnitCost, 20 / 3)
  assert.equal(stats.lowestPrice.supplier, 'Fornecedor A')
  assert.equal(stats.lowestPrice.unitCost, 5)
  assert.equal(stats.highestPrice.supplier, 'Fornecedor B')
  assert.equal(stats.highestPrice.unitCost, 8)
})

test('returns null metrics when there is no usable history', () => {
  const stats = summarizeVariationMovements([{ type: 'entrada', qty: 'x', unitCost: null }])

  assert.deepEqual(stats.suppliers, [])
  assert.equal(stats.averageEntryQty, null)
  assert.equal(stats.averageExitQty, null)
  assert.equal(stats.averageUnitCost, null)
  assert.equal(stats.lowestPrice, null)
  assert.equal(stats.highestPrice, null)
})
