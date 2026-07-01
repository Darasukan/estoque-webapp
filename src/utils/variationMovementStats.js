function numberOrNull(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function summarizeVariationMovements(movements) {
  const regular = movements.filter(movement =>
    String(movement.docRef || '').trim().toUpperCase() !== 'AJUSTE'
  )
  const entries = regular.filter(movement => movement.type === 'entrada')
  const exits = regular.filter(movement => movement.type === 'saida')
  const costs = entries.filter(movement => {
    const cost = numberOrNull(movement.unitCost)
    return cost !== null && cost >= 0
  })
  const supplierNames = new Map()
  for (const movement of entries) {
    const name = String(movement.supplier || '').trim()
    const key = name.toLocaleLowerCase('pt-BR')
    if (name && !supplierNames.has(key)) supplierNames.set(key, name)
  }
  const suppliers = [...supplierNames.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'))

  const averageQty = list => {
    const quantities = list.map(movement => numberOrNull(movement.qty)).filter(qty => qty !== null && qty > 0)
    return quantities.length ? quantities.reduce((sum, qty) => sum + qty, 0) / quantities.length : null
  }

  const priced = costs.map(movement => ({ ...movement, unitCost: Number(movement.unitCost) }))

  return {
    suppliers,
    averageEntryQty: averageQty(entries),
    averageExitQty: averageQty(exits),
    averageUnitCost: priced.length
      ? priced.reduce((sum, movement) => sum + movement.unitCost, 0) / priced.length
      : null,
    lowestPrice: priced.length
      ? priced.reduce((lowest, movement) => movement.unitCost < lowest.unitCost ? movement : lowest)
      : null,
    highestPrice: priced.length
      ? priced.reduce((highest, movement) => movement.unitCost > highest.unitCost ? movement : highest)
      : null,
  }
}
