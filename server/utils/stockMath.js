export function parsePositiveQty(qty) {
  const n = Number(qty)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function calculateStockAfter(type, stockBefore, qty) {
  if (type === 'entrada') return stockBefore + qty
  if (type === 'saida') return stockBefore - qty
  throw new Error('Tipo de movimentacao invalido.')
}

export function hasEnoughStock(type, stockBefore, qty) {
  return calculateStockAfter(type, stockBefore, qty) >= 0
}
