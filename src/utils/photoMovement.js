import { matchesSearchTokens, normalizeSearchText, searchTokens } from './globalSearch.js'

function sameText(a, b) {
  return normalizeSearchText(String(a || '').trim()) === normalizeSearchText(String(b || '').trim())
}

function suggestionValues(suggestion) {
  return Object.fromEntries((suggestion?.attributes || [])
    .map(attribute => [String(attribute?.name || '').trim(), String(attribute?.value || '').trim()])
    .filter(([name, value]) => name && value))
}

function variationValue(variation, key) {
  const wanted = normalizeSearchText(key)
  const entry = Object.entries(variation?.values || {})
    .find(([name]) => normalizeSearchText(name) === wanted)
  return entry?.[1] ?? ''
}

export function findExactPhotoMatch(suggestion, items, variations) {
  const item = items.find(candidate =>
    sameText(candidate.group, suggestion?.group) &&
    sameText(candidate.category, suggestion?.category) &&
    (sameText(candidate.subcategory, suggestion?.subcategory) ||
      (!candidate.subcategory && sameText(suggestion?.subcategory, suggestion?.name))) &&
    sameText(candidate.name, suggestion?.name)
  ) || null

  if (!item) return { item: null, variation: null }

  const itemVariations = variations.filter(variation => variation.itemId === item.id)
  const registeredKeys = new Set(itemVariations.flatMap(variation =>
    Object.keys(variation.values || {}).map(normalizeSearchText)
  ))
  const values = Object.entries(suggestionValues(suggestion))
    .filter(([key]) => registeredKeys.has(normalizeSearchText(key)))
  if (!values.length) return { item, variation: null }

  const candidates = itemVariations.filter(variation =>
    values.every(([key, value]) => sameText(variationValue(variation, key), value))
  )

  return { item, variation: candidates.length === 1 ? candidates[0] : null }
}

export function photoSuggestionSearch(suggestion) {
  return [
    suggestion?.group,
    suggestion?.category,
    suggestion?.subcategory,
    suggestion?.name,
    ...Object.values(suggestionValues(suggestion)),
  ].filter(Boolean).join(' ')
}

export function variationDescription(variation) {
  return [
    ...Object.entries(variation?.values || {}).map(([key, value]) => `${key}: ${value}`),
    ...Object.entries(variation?.extras || {}).map(([key, value]) => `${key}: ${value}`),
  ].filter(Boolean).join(' · ') || 'Variação única'
}

export function searchPhotoVariations(query, items, variations, limit = 40) {
  const tokens = searchTokens(query)
  if (!tokens.length) return []
  const byItem = new Map(items.map(item => [item.id, item]))
  const results = []

  for (const variation of variations) {
    const item = byItem.get(variation.itemId)
    if (!item) continue
    const text = [
      item.group,
      item.category,
      item.subcategory,
      item.name,
      variationDescription(variation),
      variation.location,
    ].filter(Boolean).join(' ')
    if (!matchesSearchTokens(text, tokens)) continue
    results.push({ item, variation })
    if (results.length >= limit) break
  }
  return results
}

export function effectivePhotoFields(batch, photo) {
  return {
    ...(batch?.defaults || {}),
    ...(photo?.useOverrides ? (photo.overrides || {}) : {}),
  }
}

export function canEditPhotoBatch(batch, ownerUserId, isAdmin, editingBatchId = '') {
  if (!batch || batch.status !== 'pending') return false
  return batch.ownerUserId === ownerUserId || (isAdmin && editingBatchId === batch.id)
}

export function canDeletePhotoBatch(batch, ownerUserId, isAdmin) {
  if (!batch) return false
  return Boolean(isAdmin || batch.ownerUserId === ownerUserId)
}

export function buildPhotoMovementLine(batch, photo, item, variation) {
  const fields = effectivePhotoFields(batch, photo)
  return {
    variationId: variation.id,
    itemId: item.id,
    itemName: item.name,
    itemGroup: item.group,
    itemCategory: item.category || '',
    itemSubcategory: item.subcategory || '',
    itemUnit: item.unit,
    variationValues: { ...(variation.values || {}) },
    variationExtras: { ...(variation.extras || {}) },
    qty: Number(photo.qty),
    ...(batch.type === 'entrada'
      ? {
          supplier: fields.supplier || '',
          unitCost: photo.unitCost === '' || photo.unitCost == null ? null : Number(photo.unitCost),
          docRef: fields.docRef || '',
          note: fields.note || '',
        }
      : {
          requestedBy: fields.requestedBy || '',
          requestedByPersonId: fields.requestedByPersonId || '',
          destination: fields.destination || '',
          destinationId: fields.destinationId || '',
          destinationOther: fields.destinationOther === true,
          note: fields.note || '',
        }),
  }
}

export function photoBatchBlockReason(batch, photos, items, variations) {
  if (!photos.length) return 'Adicione ao menos uma foto.'
  const itemIds = new Set(items.map(item => item.id))
  const variationById = new Map(variations.map(variation => [variation.id, variation]))
  const requestedByVariation = new Map()

  for (const photo of photos) {
    if (!photo.itemId || !itemIds.has(photo.itemId)) return 'Revise o item de todas as fotos.'
    const variation = variationById.get(photo.variationId)
    if (!variation || variation.itemId !== photo.itemId) return 'Selecione a variação de todas as fotos.'
    const qty = Number(photo.qty)
    if (!Number.isFinite(qty) || qty <= 0) return 'Informe uma quantidade positiva em todas as fotos.'

    const fields = effectivePhotoFields(batch, photo)
    if (batch.type === 'entrada') {
      const cost = photo.unitCost === '' || photo.unitCost == null ? null : Number(photo.unitCost)
      if (cost !== null && (!Number.isFinite(cost) || cost < 0)) return 'Revise os custos unitários do lote.'
    } else {
      if (!fields.requestedByPersonId || !fields.requestedBy) return 'Selecione quem retirou em todas as fotos.'
      if (!fields.destinationId && !fields.destinationOther) return 'Selecione o destino em todas as fotos.'
      if (fields.destinationOther && !String(fields.destination || '').trim()) return 'Descreva os destinos informados como Outro.'
      const accumulated = (requestedByVariation.get(variation.id) || 0) + qty
      if (accumulated > Number(variation.stock || 0)) return `A saída acumulada de ${variationDescription(variation)} excede o saldo disponível.`
      requestedByVariation.set(variation.id, accumulated)
    }
  }
  return ''
}

export function photoBatchExpired(batch, now = Date.now()) {
  return batch?.status === 'completed' && Boolean(batch.expiresAt) && new Date(batch.expiresAt).getTime() <= now
}
