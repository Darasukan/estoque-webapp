import { computed, ref } from 'vue'

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
      for (const [k, v] of Object.entries(m.variationValues || {})) {
        if (v) inc(`attr_${k}`, v)
      }
    }

    const selected = histFilters.value
    const result = []
    const facetDefs = [
      { key: 'tipo', label: 'Tipo' },
      { key: 'grupo', label: 'Grupo' },
      { key: 'categoria', label: 'Categoria' },
      { key: 'subcategoria', label: 'Subcategoria' },
      { key: 'item', label: 'Item' },
    ]

    for (const def of facetDefs) {
      const vals = counts[def.key]
      if (!vals) continue
      const options = Object.entries(vals)
        .sort((a, b) => b[1] - a[1])
        .map(([value, count]) => ({ value, count }))
      if (options.length) {
        result.push({ key: def.key, label: def.label, options, selected: selected[def.key] || [] })
      }
    }

    for (const key of Object.keys(counts)) {
      if (!key.startsWith('attr_')) continue
      const attrName = key.slice(5)
      const vals = counts[key]
      const options = Object.entries(vals)
        .sort((a, b) => b[1] - a[1])
        .map(([value, count]) => ({ value, count }))
      if (options.length) {
        result.push({ key, label: attrName, options, selected: selected[key] || [] })
      }
    }

    return result
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
      if (sf.grupo && sf.grupo.length && !sf.grupo.includes(m.itemGroup)) return false
      if (sf.categoria && sf.categoria.length && !sf.categoria.includes(m.itemCategory)) return false
      if (sf.subcategoria && sf.subcategoria.length && !sf.subcategoria.includes(m.itemSubcategory)) return false
      if (sf.item && sf.item.length && !sf.item.includes(m.itemName)) return false

      for (const key of Object.keys(sf)) {
        if (!key.startsWith('attr_') || !sf[key].length) continue
        const attrName = key.slice(5)
        const val = (m.variationValues || {})[attrName] || ''
        if (!sf[key].includes(val)) return false
      }

      if (q) {
        const haystack = [
          m.itemName, m.itemGroup, m.itemCategory, m.itemSubcategory,
          m.supplier, m.requestedBy, m.destination, m.docRef, m.note,
          m.operatorName || '',
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
