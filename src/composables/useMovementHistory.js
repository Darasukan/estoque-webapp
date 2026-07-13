import { computed, ref, watch } from 'vue'
import { normalizeSearchText } from '../utils/globalSearch.js'

const HISTORY_STATE_KEY = 'estoque_movement_history_v1'
const PAGE_SIZE_OPTIONS = [20, 50, 100]

function loadHistoryState() {
  try {
    return JSON.parse(globalThis.localStorage?.getItem(HISTORY_STATE_KEY) || '{}')
  } catch {
    return {}
  }
}

function savedFilters(value) {
  return Object.fromEntries(
    Object.entries(value || {}).filter(([, selected]) => Array.isArray(selected))
  )
}

function saveHistoryState(state) {
  try {
    globalThis.localStorage?.setItem(HISTORY_STATE_KEY, JSON.stringify(state))
  } catch {
    // The history still works when browser storage is unavailable.
  }
}

const FIELD_BY_FILTER = {
  grupo: 'itemGroup',
  categoria: 'itemCategory',
  subcategoria: 'itemSubcategory',
  item: 'itemName',
  responsavel: 'requestedBy',
  local: 'destination',
  operador: 'operatorName',
}

export function useMovementHistory(movements) {
  const saved = loadHistoryState()
  const histSearch = ref(typeof saved.search === 'string' ? saved.search : '')
  const histDateFrom = ref(typeof saved.dateFrom === 'string' ? saved.dateFrom : '')
  const histDateTo = ref(typeof saved.dateTo === 'string' ? saved.dateTo : '')
  const histFilters = ref(savedFilters(saved.filters))
  const historyCurrentPage = ref(1)
  const historyPageSize = ref(PAGE_SIZE_OPTIONS.includes(saved.pageSize) ? saved.pageSize : 20)

  const facetDefs = [
    { key: 'tipo', label: 'Tipo', group: 'main', priority: 10, defaultExpanded: true },
    { key: 'responsavel', label: 'Responsável', group: 'main', priority: 20 },
    { key: 'local', label: 'Local', group: 'main', priority: 30 },
    { key: 'operador', label: 'Operador', group: 'main', priority: 50 },
    { key: 'grupo', label: 'Grupo', group: 'product', priority: 10 },
    { key: 'categoria', label: 'Categoria', group: 'product', priority: 20 },
    { key: 'subcategoria', label: 'Subcategoria', group: 'product', priority: 30 },
    { key: 'item', label: 'Item', group: 'product', priority: 40 },
  ]

  function getFilterValue(movement, key) {
    if (key === 'tipo') return movement.type === 'entrada' ? 'Entrada' : 'Sa\u00edda'
    if (key.startsWith('attr_')) return (movement.variationValues || {})[key.slice(5)] || ''
    const fieldName = FIELD_BY_FILTER[key]
    return fieldName ? movement[fieldName] : ''
  }

  function movementMatchesSearch(movement) {
    const q = normalizeSearchText(histSearch.value).trim()
    if (!q) return true
    const haystack = [
      movement.itemName, movement.itemGroup, movement.itemCategory, movement.itemSubcategory,
      movement.supplier, movement.requestedBy, movement.destination,
      movement.docRef, movement.operatorName, movement.note,
      ...Object.values(movement.variationValues || {}),
      ...Object.values(movement.variationExtras || {}),
    ].map(normalizeSearchText).join(' ')
    return haystack.includes(q)
  }

  function movementMatchesDateRange(movement) {
    if (histDateFrom.value && new Date(movement.date) < new Date(histDateFrom.value)) return false
    if (histDateTo.value) {
      const to = new Date(histDateTo.value)
      to.setDate(to.getDate() + 1)
      if (new Date(movement.date) >= to) return false
    }
    return true
  }

  function movementMatchesFilters(movement, ignoredKey = '') {
    for (const [key, selectedValues] of Object.entries(histFilters.value)) {
      if (key === ignoredKey || !selectedValues.length) continue
      if (!selectedValues.includes(getFilterValue(movement, key))) return false
    }
    return true
  }

  function movementMatchesBase(movement) {
    return movementMatchesSearch(movement) && movementMatchesDateRange(movement)
  }

  function buildCountsForFacet(facetKey) {
    const counts = {}
    function inc(key, val) {
      if (!val) return
      if (!counts[key]) counts[key] = {}
      counts[key][val] = (counts[key][val] || 0) + 1
    }

    for (const m of movements.value) {
      if (!movementMatchesBase(m) || !movementMatchesFilters(m, facetKey)) continue
      inc(facetKey, getFilterValue(m, facetKey))
    }
    return counts[facetKey] || {}
  }

  const histFacets = computed(() => {
    if (!movements.value.length) return []
    const selected = histFilters.value

    function makeFacet(def) {
      const vals = buildCountsForFacet(def.key)
      for (const value of selected[def.key] || []) {
        if (vals[value] === undefined) vals[value] = 0
      }
      const options = Object.entries(vals)
        .sort((a, b) => b[1] - a[1])
        .map(([value, count]) => ({ value, count }))
      if (!options.length) return null
      return { ...def, options, selected: selected[def.key] || [] }
    }

    const result = facetDefs
      .map(makeFacet)
      .filter(Boolean)

    const attrKeys = new Set()
    for (const m of movements.value) {
      for (const key of Object.keys(m.variationValues || {})) {
        attrKeys.add(`attr_${key}`)
      }
    }
    for (const key of Object.keys(selected)) {
      if (key.startsWith('attr_')) attrKeys.add(key)
    }

    for (const key of attrKeys) {
      const attrName = key.slice(5)
      const vals = buildCountsForFacet(key)
      for (const value of selected[key] || []) {
        if (vals[value] === undefined) vals[value] = 0
      }
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
    return movements.value.filter(m =>
      movementMatchesBase(m) && movementMatchesFilters(m)
    )
  })

  const historyTotalPages = computed(() => Math.max(1, Math.ceil(filteredMovements.value.length / historyPageSize.value)))
  const paginatedMovements = computed(() => {
    const start = (historyCurrentPage.value - 1) * historyPageSize.value
    return filteredMovements.value.slice(start, start + historyPageSize.value)
  })

  watch([histSearch, histDateFrom, histDateTo, histFilters, historyPageSize], () => {
    historyCurrentPage.value = 1
    saveHistoryState({
      search: histSearch.value,
      dateFrom: histDateFrom.value,
      dateTo: histDateTo.value,
      filters: histFilters.value,
      pageSize: historyPageSize.value,
    })
  }, { deep: true })

  watch(historyTotalPages, total => {
    if (historyCurrentPage.value > total) historyCurrentPage.value = total
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
    paginatedMovements,
    historyCurrentPage,
    historyPageSize,
    historyPageSizeOptions: PAGE_SIZE_OPTIONS,
    historyTotalPages,
    histTotals,
  }
}
