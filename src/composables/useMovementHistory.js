import { computed, ref } from 'vue'

const FIELD_BY_FILTER = {
  grupo: 'itemGroup',
  categoria: 'itemCategory',
  subcategoria: 'itemSubcategory',
  item: 'itemName',
  responsavel: 'requestedBy',
  local: 'destination',
  doc: 'docRef',
  operador: 'operatorName',
}

export function useMovementHistory(movements) {
  const histSearch = ref('')
  const histDateFrom = ref('')
  const histDateTo = ref('')
  const histFilters = ref({})

  const histFacets = computed(() => {
    const ms = movements.value
    if (!ms.length) return []

    const counts = {}
    function inc(key, val) {
      if (!val) return
      if (!counts[key]) counts[key] = {}
      counts[key][val] = (counts[key][val] || 0) + 1
    }

    for (const m of ms) {
      inc('tipo', m.type === 'entrada' ? 'Entrada' : 'Sa\u00edda')
      inc('grupo', m.itemGroup)
      inc('categoria', m.itemCategory)
      inc('subcategoria', m.itemSubcategory)
      inc('item', m.itemName)
      inc('responsavel', m.requestedBy)
      inc('local', m.destination)
      inc('doc', m.docRef)
      inc('operador', m.operatorName)
      for (const [k, v] of Object.entries(m.variationValues || {})) {
        if (v) inc(`attr_${k}`, v)
      }
    }

    const selected = histFilters.value
    const facetDefs = [
      { key: 'tipo', label: 'Tipo', group: 'main', priority: 10, defaultExpanded: true },
      { key: 'responsavel', label: 'Responsavel', group: 'main', priority: 20 },
      { key: 'local', label: 'Local', group: 'main', priority: 30 },
      { key: 'doc', label: 'DOC', group: 'main', priority: 40 },
      { key: 'operador', label: 'Operador', group: 'main', priority: 50 },
      { key: 'grupo', label: 'Grupo', group: 'product', priority: 10 },
      { key: 'categoria', label: 'Categoria', group: 'product', priority: 20 },
      { key: 'subcategoria', label: 'Subcategoria', group: 'product', priority: 30 },
      { key: 'item', label: 'Item', group: 'product', priority: 40 },
    ]

    function makeFacet(def) {
      const vals = counts[def.key]
      if (!vals) return null
      const options = Object.entries(vals)
        .sort((a, b) => b[1] - a[1])
        .map(([value, count]) => ({ value, count }))
      if (!options.length) return null
      return { ...def, options, selected: selected[def.key] || [] }
    }

    const result = facetDefs
      .map(makeFacet)
      .filter(Boolean)

    for (const key of Object.keys(counts)) {
      if (!key.startsWith('attr_')) continue
      const attrName = key.slice(5)
      const vals = counts[key]
      const options = Object.entries(vals)
        .sort((a, b) => b[1] - a[1])
        .map(([value, count]) => ({ value, count }))
      if (options.length) {
        result.push({
          key,
          label: attrName,
          group: 'details',
          priority: 100,
          defaultExpanded: false,
          options,
          selected: selected[key] || [],
        })
      }
    }

    return result.sort((a, b) =>
      (a.group || '').localeCompare(b.group || '') ||
      (a.priority || 0) - (b.priority || 0) ||
      a.label.localeCompare(b.label)
    )
  })

  const hasHistFilters = computed(() =>
    histSearch.value.trim().length > 0 ||
    histDateFrom.value !== '' ||
    histDateTo.value !== '' ||
    Object.values(histFilters.value).some(arr => arr.length > 0)
  )

  function toggleHistFilter(key, value) {
    const cur = histFilters.value[key] || []
    const idx = cur.indexOf(value)
    if (idx >= 0) cur.splice(idx, 1)
    else cur.push(value)
    histFilters.value = { ...histFilters.value, [key]: cur }
  }

  function clearHistFilters() {
    histSearch.value = ''
    histDateFrom.value = ''
    histDateTo.value = ''
    histFilters.value = {}
  }

  const filteredMovements = computed(() => {
    const q = histSearch.value.trim().toLowerCase()
    const sf = histFilters.value
    return movements.value.filter(m => {
      if (sf.tipo && sf.tipo.length) {
        const typeLabel = m.type === 'entrada' ? 'Entrada' : 'Sa\u00edda'
        if (!sf.tipo.includes(typeLabel)) return false
      }

      for (const [filterKey, fieldName] of Object.entries(FIELD_BY_FILTER)) {
        if (sf[filterKey]?.length && !sf[filterKey].includes(m[fieldName])) return false
      }

      for (const key of Object.keys(sf)) {
        if (!key.startsWith('attr_') || !sf[key].length) continue
        const attrName = key.slice(5)
        const val = (m.variationValues || {})[attrName] || ''
        if (!sf[key].includes(val)) return false
      }

      if (q) {
        const haystack = [
          m.itemName, m.itemGroup, m.itemCategory, m.itemSubcategory,
          ...Object.values(m.variationValues || {}),
          ...Object.values(m.variationExtras || {}),
        ].join(' ').toLowerCase()
        if (!haystack.includes(q)) return false
      }
      if (histDateFrom.value && new Date(m.date) < new Date(histDateFrom.value)) return false
      if (histDateTo.value) {
        const to = new Date(histDateTo.value)
        to.setDate(to.getDate() + 1)
        if (new Date(m.date) >= to) return false
      }
      return true
    })
  })

  const histTotals = computed(() => {
    let entradas = 0
    let saidas = 0
    for (const m of filteredMovements.value) {
      if (m.type === 'entrada') entradas += m.qty
      else saidas += m.qty
    }
    return { entradas, saidas }
  })

  return {
    histSearch,
    histDateFrom,
    histDateTo,
    histFacets,
    hasHistFilters,
    toggleHistFilter,
    clearHistFilters,
    filteredMovements,
    histTotals,
  }
}
