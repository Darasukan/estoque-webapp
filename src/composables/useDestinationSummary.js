import { computed, ref } from 'vue'

function normalizeDestinationKey(value) {
  return String(value || '')
    .replace(/[\u203a\u00bb]/g, '>')
    .trim()
    .toLowerCase()
}

function movementVariationLabel(m) {
  const parts = []
  for (const [key, val] of Object.entries(m.variationValues || {})) {
    if (val) parts.push(`${key}: ${val}`)
  }
  for (const [key, val] of Object.entries(m.variationExtras || {})) {
    if (val) parts.push(`${key}: ${val}`)
  }
  return parts.length ? parts.join(' - ') : '-'
}

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })

function compareText(a, b) {
  return collator.compare(String(a || ''), String(b || ''))
}

function compareMaterial(a, b) {
  return compareText(a.itemGroup, b.itemGroup) ||
    compareText(a.itemCategory, b.itemCategory) ||
    compareText(a.itemSubcategory, b.itemSubcategory) ||
    compareText(a.itemName, b.itemName) ||
    compareText(a.variation, b.variation)
}

export function useDestinationSummary({ destinations, movements, getDestFullName }) {
  const summarySearch = ref('')
  const expandedSummaryDestId = ref(null)

  const orderedRegisteredDestinations = computed(() => {
    const list = []
    const parents = destinations.value.filter(d => !d.parentId).sort((a, b) => compareText(a.name, b.name))
    for (const parent of parents) {
      list.push(parent)
      const children = destinations.value
        .filter(d => d.parentId === parent.id)
        .sort((a, b) => compareText(a.name, b.name))
      for (const child of children) {
        list.push(child)
      }
    }
    return list
  })

  function destinationMatchesValue(dest, value) {
    const q = normalizeDestinationKey(value)
    if (!q) return false
    return q === normalizeDestinationKey(dest.id) ||
      q === normalizeDestinationKey(dest.name) ||
      q === normalizeDestinationKey(getDestFullName(dest.id))
  }

  function movementMatchesDestination(m, dest) {
    return m.type === 'saida' &&
      destinationMatchesValue(dest, m.destination)
  }

  const destinationSummaries = computed(() =>
    orderedRegisteredDestinations.value.map(dest => {
      const fullName = getDestFullName(dest.id)
      const saidas = movements.value.filter(m => movementMatchesDestination(m, dest))
      const materialMap = {}

      for (const m of saidas) {
        const key = `${m.itemId || m.itemName}||${JSON.stringify(m.variationValues || {})}||${JSON.stringify(m.variationExtras || {})}`
        if (!materialMap[key]) {
          materialMap[key] = {
            variationId: m.variationId || key,
            itemId: m.itemId || '',
            itemName: m.itemName,
            itemGroup: m.itemGroup || 'Sem grupo',
            itemCategory: m.itemCategory || 'Sem categoria',
            itemSubcategory: m.itemSubcategory || 'Sem subcategoria',
            itemUnit: m.itemUnit,
            variation: movementVariationLabel(m),
            qty: 0,
            moves: 0,
            lastDate: m.date,
          }
        }
        materialMap[key].qty += Number(m.qty) || 0
        materialMap[key].moves += 1
        if (new Date(m.date) > new Date(materialMap[key].lastDate)) materialMap[key].lastDate = m.date
      }

      const materials = Object.values(materialMap).sort(compareMaterial)
      return {
        id: dest.id,
        name: dest.name,
        fullName,
        isChild: !!dest.parentId,
        orders: [],
        saidas,
        materials,
        totalQty: materials.reduce((sum, mat) => sum + mat.qty, 0),
        lastDate: saidas.reduce((latest, m) => !latest || new Date(m.date) > new Date(latest) ? m.date : latest, ''),
      }
    })
  )

  const filteredDestinationSummaries = computed(() => {
    const q = summarySearch.value.trim().toLowerCase()
    const withMovements = destinationSummaries.value.filter(d => d.materials.length)
    if (!q) return withMovements
    return withMovements.filter(d => {
      const haystack = [
        d.fullName,
        ...d.materials.map(mat => `${mat.itemGroup} ${mat.itemCategory} ${mat.itemSubcategory} ${mat.itemName} ${mat.variation}`),
      ].join(' ').toLowerCase()
      return haystack.includes(q)
    })
  })

  const summaryTotals = computed(() => ({
    destinations: destinationSummaries.value.filter(d => d.materials.length).length,
    withMovement: destinationSummaries.value.filter(d => d.saidas.length).length,
    saidas: destinationSummaries.value.reduce((sum, d) => sum + d.saidas.length, 0),
    orders: 0,
  }))

  return {
    summarySearch,
    expandedSummaryDestId,
    destinationSummaries,
    filteredDestinationSummaries,
    summaryTotals,
  }
}
