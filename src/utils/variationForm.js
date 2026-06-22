export function emptyVariationForm() {
  return { values: {}, stock: 0, minStock: 0, extrasList: [], location: '', destinations: [] }
}

export function variationFormForItem(item) {
  return {
    ...emptyVariationForm(),
    values: Object.fromEntries((item?.attributes || []).map(attribute => [attribute, ''])),
    minStock: item?.minStock || 0,
    location: item?.location || '',
  }
}

export function variationFormForEdit(item, variation) {
  return {
    values: Object.fromEntries((item?.attributes || []).map(attribute => [attribute, variation.values?.[attribute] || ''])),
    stock: variation.stock,
    minStock: variation.minStock || 0,
    extrasList: Object.entries(variation.extras || {}).map(([key, value]) => ({ key, value })),
    location: variation.location || '',
    destinations: [...(variation.destinations || [])],
  }
}

export function extrasListToObject(list) {
  return Object.fromEntries(
    list.map(({ key, value }) => [String(key || '').trim(), value || '']).filter(([key]) => key)
  )
}

export function validateVariationForm(item, form) {
  if ((item?.attributes?.length || 0) > 0 && !Object.values(form.values).some(value => String(value || '').trim())) {
    return 'Preencha ao menos um atributo.'
  }
  const stock = Number(form.stock)
  if (!Number.isFinite(stock)) return 'Quantidade deve ser um número válido.'
  if (stock < 0) return 'Quantidade não pode ser negativa.'
  return null
}
