<script setup>
import { ref, computed, nextTick, inject, watch } from 'vue'
import { useItems } from '../composables/useItems.js'
import { stockAlertStatus } from '../composables/useItems.js'
import { useMovements } from '../composables/useMovements.js'
import { useWorkOrders } from '../composables/useWorkOrders.js'
import { useDestinations } from '../composables/useDestinations.js'
import { useToast } from '../composables/useToast.js'
import FechamentosView from './FechamentosView.vue'

const props = defineProps({
  initialSection: {
    type: String,
    default: 'estoque',
  },
  initialStatus: {
    type: String,
    default: 'all',
  },
})
const isAdmin = inject('isAdmin')
const isLoggedIn = inject('isLoggedIn')
const emit = defineEmits(['quick-movement'])

const { items, getVariationsForItem, getCategoriesForGroup, getSubcategoriesForCategory } = useItems()
const { movements, addMovement } = useMovements()
const { workOrders } = useWorkOrders()
const { getDestFullName } = useDestinations()
const { success, error } = useToast()
const inventorySection = ref(['estoque', 'fechamentos'].includes(props.initialSection) ? props.initialSection : 'estoque')
const columnMenuOpen = ref(false)
const visibleColumns = ref({
  variation: true,
  current: true,
  min: true,
  status: true,
  history: true,
  adjust: true,
})

const columnOptions = computed(() => [
  { key: 'variation', label: 'Variação' },
  { key: 'current', label: 'Qtd. atual' },
  { key: 'min', label: 'Mín.' },
  { key: 'status', label: 'Status' },
  { key: 'history', label: 'Histórico por item' },
  ...((isLoggedIn?.value ?? isLoggedIn) ? [{ key: 'adjust', label: 'Ações rápidas' }] : []),
])

watch(() => props.initialSection, section => {
  if (['estoque', 'fechamentos'].includes(section)) inventorySection.value = section
})

function isColumnVisible(key) {
  return visibleColumns.value[key] !== false
}

function toggleColumn(key) {
  visibleColumns.value = {
    ...visibleColumns.value,
    [key]: !isColumnVisible(key),
  }
}

// ===== Search =====
const searchQuery = ref('')
const autoHierarchy = ref(null)

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })

function compareText(a, b) {
  return collator.compare(String(a || ''), String(b || ''))
}

function rowVariationText(row) {
  const values = Object.entries(row.variation.values || {}).map(([key, value]) => `${key}: ${value}`)
  const extras = Object.entries(row.variation.extras || {}).map(([key, value]) => `${key}: ${value}`)
  return [...values, ...extras].filter(Boolean).join(' ')
}

function compareInventoryRows(a, b) {
  return compareText(a.item.group, b.item.group) ||
    compareText(a.item.category, b.item.category) ||
    compareText(a.item.subcategory, b.item.subcategory) ||
    compareText(a.item.name, b.item.name) ||
    compareText(rowVariationText(a), rowVariationText(b))
}

function compareNumber(a, b) {
  return Number(a || 0) - Number(b || 0)
}

function compareStatus(a, b) {
  const order = { zero: 0, critical: 1, alert: 2, ok: 3 }
  return (order[a] ?? 99) - (order[b] ?? 99)
}

const searchNorm = computed(() => normalizeSearchText(searchQuery.value))

// ===== Pagination =====
const currentPage = ref(1)
const pageSize = ref(20)
const PAGE_SIZE_OPTIONS = [20, 40, 60, 100]
const sortKey = ref('item')
const sortDirection = ref('asc')

function compareSortColumn(a, b) {
  if (sortKey.value === 'variation') return compareText(rowVariationText(a), rowVariationText(b)) || compareInventoryRows(a, b)
  if (sortKey.value === 'current') return compareNumber(a.variation.stock, b.variation.stock) || compareInventoryRows(a, b)
  if (sortKey.value === 'min') return compareNumber(a.variation.minStock, b.variation.minStock) || compareInventoryRows(a, b)
  if (sortKey.value === 'status') return compareStatus(a.status, b.status) || compareInventoryRows(a, b)
  return compareInventoryRows(a, b)
}

function sortRows(list) {
  const direction = sortDirection.value === 'desc' ? -1 : 1
  return [...list].sort((a, b) => compareSortColumn(a, b) * direction)
}

function setSort(key) {
  if (sortKey.value === key) sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  else {
    sortKey.value = key
    sortDirection.value = 'asc'
  }
}

function sortArrow(key) {
  if (sortKey.value !== key) return ''
  return sortDirection.value === 'asc' ? '↑' : '↓'
}

// ===== Status filter =====
const inventoryStatusFilters = ['all', '', 'zero', 'critical', 'alert']
const filterStatus = ref(inventoryStatusFilters.includes(props.initialStatus) ? props.initialStatus : 'all')

watch(() => props.initialStatus, status => {
  if (inventoryStatusFilters.includes(status)) filterStatus.value = status
})

// ===== Facet filters =====
const filterGroup = ref('')
const filterCategory = ref('')
const filterSubcategory = ref('')
const filterAttrValues = ref({}) // { [attrKey]: selectedValue }

// All rows regardless of status (for "Todas" tab)
const allRows = computed(() => {
  const rows = []
  for (const item of items.value) {
    const vars = getVariationsForItem(item.id)
    for (const v of vars) {
      const status = stockAlertStatus(v, item)
      rows.push({ variation: v, item, status })
    }
  }
  return rows.sort(compareInventoryRows)
})

// All alert rows (unfiltered)
const alertRows = computed(() => {
  const order = { zero: 0, critical: 1, alert: 2, ok: 3 }
  return allRows.value
    .filter(r => r.status !== 'ok')
    .slice()
    .sort((a, b) => order[a.status] - order[b.status] || compareInventoryRows(a, b))
})

// Base rows depending on active tab
const baseRows = computed(() => filterStatus.value === 'all' ? allRows.value : alertRows.value)

// After status + search only
const afterStatusSearch = computed(() => {
  let rows = baseRows.value
  if (filterStatus.value && filterStatus.value !== 'all')
    rows = rows.filter(r => r.status === filterStatus.value)
  if (searchNorm.value) {
    const q = searchNorm.value
    rows = rows.filter(r =>
      normalizeSearchText(r.item.name).includes(q) ||
      normalizeSearchText([r.item.group, r.item.category, r.item.subcategory].filter(Boolean).join(' ')).includes(q) ||
      Object.values(r.variation.values || {}).some(v => normalizeSearchText(v).includes(q)) ||
      Object.entries(r.variation.extras || {}).some(([k, v]) => normalizeSearchText(k).includes(q) || normalizeSearchText(v).includes(q))
    )
  }
  return rows
})

// Helper: apply attr filters to a row set, optionally skipping one key
function applyAttrFilters(rows, exceptKey = null) {
  const filters = Object.entries(filterAttrValues.value).filter(([k]) => k !== exceptKey)
  if (!filters.length) return rows
  return rows.filter(r =>
    filters.every(([key, val]) =>
      r.variation.values?.[key] === val || r.variation.extras?.[key] === val
    )
  )
}

// After hierarchy filters
const afterHierarchy = computed(() => {
  let rows = afterStatusSearch.value
  if (filterGroup.value) rows = rows.filter(r => r.item.group === filterGroup.value)
  if (filterCategory.value) rows = rows.filter(r => r.item.category === filterCategory.value)
  if (filterSubcategory.value) rows = rows.filter(r => r.item.subcategory === filterSubcategory.value)
  return rows
})

// Fully filtered rows (all active filters)
const filteredRows = computed(() => applyAttrFilters(afterHierarchy.value))
const sortedFilteredRows = computed(() => sortRows(filteredRows.value))

// ===== Paginated rows =====
const totalPages = computed(() => Math.max(1, Math.ceil(sortedFilteredRows.value.length / pageSize.value)))
const paginatedRows = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return sortedFilteredRows.value.slice(start, start + pageSize.value)
})

// Reset page when filters change
watch([searchQuery, filterStatus, filterGroup, filterCategory, filterSubcategory, filterAttrValues, pageSize, sortKey, sortDirection], () => {
  currentPage.value = 1
})

function clearAutoHierarchyIfOwned() {
  const auto = autoHierarchy.value
  if (!auto) return
  if (
    filterGroup.value === (auto.group || '') &&
    filterCategory.value === (auto.category || '') &&
    filterSubcategory.value === (auto.subcategory || '')
  ) {
    filterGroup.value = ''
    filterCategory.value = ''
    filterSubcategory.value = ''
  }
  autoHierarchy.value = null
}

function applyAutoHierarchy(next) {
  clearAutoHierarchyIfOwned()
  filterGroup.value = next.group || ''
  filterCategory.value = next.category || ''
  filterSubcategory.value = next.subcategory || ''
  autoHierarchy.value = {
    group: filterGroup.value,
    category: filterCategory.value,
    subcategory: filterSubcategory.value,
  }
}

function findHierarchySearchMatch(q) {
  if (!q) return null
  const rows = baseRows.value

  const levels = [
    { key: 'subcategory', fields: ['group', 'category', 'subcategory'] },
    { key: 'category', fields: ['group', 'category'] },
    { key: 'group', fields: ['group'] },
  ]

  for (const level of levels) {
    const matches = rows.filter(r => normalizeSearchText(r.item[level.key]) === q)
    const paths = new Map()
    for (const row of matches) {
      const path = {
        group: row.item.group || '',
        category: level.fields.includes('category') ? row.item.category || '' : '',
        subcategory: level.fields.includes('subcategory') ? row.item.subcategory || '' : '',
      }
      paths.set(JSON.stringify(path), path)
    }
    if (paths.size === 1) return [...paths.values()][0]
  }

  return null
}

watch(searchNorm, q => {
  const match = findHierarchySearchMatch(q)
  if (match) applyAutoHierarchy(match)
  else clearAutoHierarchyIfOwned()
})

// ---- Hierarchy facet options (each excludes its own filter, includes all others) ----
const facetGroups = computed(() => {
  let rows = afterStatusSearch.value
  if (filterCategory.value) rows = rows.filter(r => r.item.category === filterCategory.value)
  if (filterSubcategory.value) rows = rows.filter(r => r.item.subcategory === filterSubcategory.value)
  rows = applyAttrFilters(rows)
  return [...new Set(rows.map(r => r.item.group).filter(Boolean))].sort(compareText)
})

const facetCategories = computed(() => {
  let rows = afterStatusSearch.value
  if (filterGroup.value) rows = rows.filter(r => r.item.group === filterGroup.value)
  if (filterSubcategory.value) rows = rows.filter(r => r.item.subcategory === filterSubcategory.value)
  rows = applyAttrFilters(rows)
  return [...new Set(rows.map(r => r.item.category).filter(Boolean))].sort(compareText)
})

const facetSubcategories = computed(() => {
  let rows = afterStatusSearch.value
  if (filterGroup.value) rows = rows.filter(r => r.item.group === filterGroup.value)
  if (filterCategory.value) rows = rows.filter(r => r.item.category === filterCategory.value)
  rows = applyAttrFilters(rows)
  return [...new Set(rows.map(r => r.item.subcategory).filter(Boolean))].sort(compareText)
})

// ---- Attribute facet keys & values ----
// Keys: present in fully-filtered rows (+ currently active keys to keep them visible)
const facetAttrKeys = computed(() => {
  const rows = filteredRows.value
  const keys = new Set()
  for (const r of rows) {
    for (const k of (r.item.attributes || []))
      if (r.variation.values?.[k]) keys.add(k)
    for (const k of Object.keys(r.variation.extras || {}))
      if (r.variation.extras[k]) keys.add(k)
  }
  for (const k of Object.keys(filterAttrValues.value)) keys.add(k)
  return [...keys].sort(compareText)
})

// Values for key K: afterHierarchy with all attr filters EXCEPT K
function facetValuesForKey(key) {
  const rows = applyAttrFilters(afterHierarchy.value, key)
  const vals = new Set()
  for (const r of rows) {
    const v = r.variation.values?.[key] || r.variation.extras?.[key]
    if (v) vals.add(v)
  }
  return [...vals].sort(compareText)
}

// Pre-computed map of attr values per key (avoids calling the function in template on every render)
const facetAttrValueMap = computed(() => {
  const map = {}
  for (const key of facetAttrKeys.value) {
    map[key] = facetValuesForKey(key)
  }
  return map
})

// Is key an "extra" (not a template attr of any current item)?
const templateAttrKeys = computed(() => {
  const keys = new Set()
  for (const r of afterHierarchy.value)
    for (const k of (r.item.attributes || [])) keys.add(k)
  return keys
})

// ---- Setters ----
function setGroup(g) {
  autoHierarchy.value = null
  filterGroup.value = filterGroup.value === g ? '' : g
  filterCategory.value = ''
  filterSubcategory.value = ''
}
function setCategory(c) {
  autoHierarchy.value = null
  filterCategory.value = filterCategory.value === c ? '' : c
  filterSubcategory.value = ''
}
function setSubcategory(s) {
  autoHierarchy.value = null
  filterSubcategory.value = filterSubcategory.value === s ? '' : s
}
function setAttrValue(key, val) {
  const cur = filterAttrValues.value[key]
  const next = { ...filterAttrValues.value }
  if (cur === val) delete next[key]
  else next[key] = val
  filterAttrValues.value = next
}

function clearFacets() {
  autoHierarchy.value = null
  filterGroup.value = ''
  filterCategory.value = ''
  filterSubcategory.value = ''
  filterAttrValues.value = {}
}

const facetActive = computed(() =>
  filterGroup.value || filterCategory.value || filterSubcategory.value ||
  Object.keys(filterAttrValues.value).length > 0
)

const counts = computed(() => {
  const c = { zero: 0, critical: 0, alert: 0, alerts: 0, all: 0 }
  for (const r of allRows.value) {
    if (r.status !== 'ok') { c[r.status]++; c.alerts++ }
    c.all++
  }
  return c
})

const showBody = computed(() => filterStatus.value === 'all' || alertRows.value.length > 0)

// ===== Inline stock adjust =====
const adjustingId = ref(null)
const adjustInput = ref(null)
const adjustValue = ref('')
const movementMenuId = ref(null)

function startAdjust(varId, currentStock) {
  adjustingId.value = varId
  adjustValue.value = ''
  movementMenuId.value = null
  nextTick(() => adjustInput.value?.focus())
}

function quickMovement(row, type) {
  if (!(isLoggedIn?.value ?? isLoggedIn)) return
  movementMenuId.value = null
  emit('quick-movement', {
    type,
    itemId: row.item.id,
    variationId: row.variation.id,
    nonce: Date.now(),
  })
}

function toggleMovementMenu(varId) {
  movementMenuId.value = movementMenuId.value === varId ? null : varId
}

function cancelAdjust() {
  adjustingId.value = null
  adjustValue.value = ''
}

async function confirmAdjust(varId) {
  const val = Number(adjustValue.value)
  if (!isFinite(val) || isNaN(val) || val === 0) { error('Informe um ajuste diferente de zero.'); return }

  const delta = Math.round(val)
  if (delta === 0) { error('Informe um ajuste inteiro diferente de zero.'); return }

  const row = allRows.value.find(r => r.variation.id === varId)
  if (!row) { error('Variação não encontrada.'); return }

  const qty = Math.abs(delta)
  if (delta < 0 && row.variation.stock < qty) {
    error(`Estoque insuficiente. Disponível: ${row.variation.stock}`)
    return
  }

  const type = delta > 0 ? 'entrada' : 'saida'
  try {
    await addMovement(type, row.variation, row.item, qty, {
      supplier: '',
      requestedBy: '',
      destination: '',
      docRef: 'AJUSTE',
      note: 'Ajuste manual pelo inventário.',
    })
    success(type === 'entrada' ? 'Entrada de ajuste registrada.' : 'Saída de ajuste registrada.')
    adjustingId.value = null
    adjustValue.value = ''
  } catch (e) {
    error(e.message)
  }
}

function onAdjustKeydown(e, varId) {
  if (e.key === 'Enter') confirmAdjust(varId)
  else if (e.key === 'Escape') cancelAdjust()
}

// ===== Variation movement history =====
const historyRow = ref(null)

const historyMovements = computed(() => {
  if (!historyRow.value) return []
  return movements.value
    .filter(m => m.variationId === historyRow.value.variation.id)
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
})

const historyTotals = computed(() => {
  const totals = { entradas: 0, saidas: 0, ajustes: 0, os: 0 }
  const osNumbers = new Set()
  for (const movement of historyMovements.value) {
    if (movement.type === 'entrada') totals.entradas += Number(movement.qty || 0)
    else totals.saidas += Number(movement.qty || 0)
    if (movement.docRef === 'AJUSTE') totals.ajustes += 1
    const order = workOrderFromMovement(movement)
    if (order?.number) osNumbers.add(order.number)
  }
  totals.os = osNumbers.size
  return totals
})

const historyLinkedDestinations = computed(() => {
  if (!historyRow.value) return []
  return (historyRow.value.variation.destinations || [])
    .map(id => ({ id, name: getDestFullName(id) }))
    .filter(dest => dest.name)
    .sort((a, b) => compareText(a.name, b.name))
})

const historyTimeline = computed(() =>
  historyMovements.value.map(movement => ({
    movement,
    order: workOrderFromMovement(movement),
    title: movementTimelineTitle(movement),
    subtitle: movementTimelineSubtitle(movement),
  }))
)

function openVariationHistory(row) {
  historyRow.value = row
}

function closeVariationHistory() {
  historyRow.value = null
}

function formatHistoryDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('pt-BR')
}

function workOrderNumberFromMovement(movement) {
  const match = String(movement.docRef || movement.note || '').match(/OS\s*#\s*(\d+)/i)
  return match ? Number(match[1]) : null
}

function workOrderFromMovement(movement) {
  const number = workOrderNumberFromMovement(movement)
  if (!number) return null
  return workOrders.value.find(order => Number(order.number) === number) || null
}

function movementTimelineTitle(movement) {
  const orderNumber = workOrderNumberFromMovement(movement)
  if (orderNumber) return `Baixa por OS #${orderNumber}`
  if (movement.docRef === 'AJUSTE') return movement.type === 'entrada' ? 'Ajuste de entrada' : 'Ajuste de saída'
  return movement.type === 'entrada' ? 'Entrada avulsa' : 'Saída avulsa'
}

function movementTimelineSubtitle(movement) {
  const parts = []
  const responsible = movementResponsible(movement)
  const place = movementPlace(movement)
  if (responsible && responsible !== '-') parts.push(responsible)
  if (place && place !== '-') parts.push(place)
  if (movement.docRef && movement.docRef !== 'AJUSTE') parts.push(movement.docRef)
  return parts.join(' · ') || '-'
}

function movementResponsible(movement) {
  return movement.supplier || movement.requestedBy || '-'
}

function movementPlace(movement) {
  return movement.destination || movement.location || movement.note || '-'
}

function movementStock(movement) {
  const before = movement.stockBefore ?? movement.beforeStock
  const after = movement.stockAfter ?? movement.afterStock
  if (before === undefined || after === undefined) return '-'
  return `${before} -> ${after}`
}

// ===== Collapsible attr sections =====
const collapsedAttrs = ref({})

function toggleAttr(key) {
  collapsedAttrs.value[key] = collapsedAttrs.value[key] === false ? true : false
}
function isAttrCollapsed(key) {
  return collapsedAttrs.value[key] !== false
}

// Navigate back one level in the cascading hierarchy
function backToGroups() {
  autoHierarchy.value = null
  filterGroup.value = ''
  filterCategory.value = ''
  filterSubcategory.value = ''
  filterAttrValues.value = {}
}
function backToCategories() {
  autoHierarchy.value = null
  filterCategory.value = ''
  filterSubcategory.value = ''
  filterAttrValues.value = {}
}
function backToSubcategories() {
  autoHierarchy.value = null
  filterSubcategory.value = ''
  filterAttrValues.value = {}
}

// ===== Helpers =====
function hierarchyLabel(item) {
  return [item.group, item.category, item.subcategory].filter(Boolean).join(' › ')
}

const STATUS_CONFIG = {
  zero:     { label: 'Sem estoque', pillClass: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' },
  critical: { label: 'Crítico',     pillClass: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' },
  alert:    { label: 'Alerta',      pillClass: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-500' },
  ok:       { label: 'OK',          pillClass: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' },
}

const FILTER_TABS = [
  { id: 'all',      label: 'Todas',        countKey: 'all' },
  { id: '',         label: 'Com alertas',  countKey: 'alerts' },
  { id: 'zero',     label: 'Sem estoque',  countKey: 'zero' },
  { id: 'critical', label: 'Crítico',      countKey: 'critical' },
  { id: 'alert',    label: 'Alerta',       countKey: 'alert' },
]

const FILTER_COUNT_CLASS = {
  alerts:   'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  zero:     'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  critical: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
  alert:    'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-500',
  all:      'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
}

// ===== CSV Export =====
const csvSelectedMonth = ref(new Date().getMonth() + 1)
const csvSelectedYear = ref(new Date().getFullYear())

const CSV_MONTHS = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
]

const csvYears = computed(() => {
  const cur = new Date().getFullYear()
  const years = []
  for (let y = cur; y >= cur - 5; y--) years.push(y)
  return years
})

function exportCSV() {
  const month = Number(csvSelectedMonth.value)
  const year = Number(csvSelectedYear.value)
  const from = new Date(year, month - 1, 1)
  const to = new Date(year, month, 1)
  const cutoffLabel = new Date(year, month, 0).toLocaleDateString('pt-BR')
  const monthTag = `${String(month).padStart(2, '0')}/${year}`

  // Pre-compute monthly movements per variation
  const monthMovs = {}
  const afterPeriodMovs = {}
  for (const m of movements.value) {
    const d = new Date(m.date)
    if (d >= from && d < to) {
      if (!monthMovs[m.variationId]) monthMovs[m.variationId] = { entradas: 0, saidas: 0 }
      if (m.type === 'entrada') monthMovs[m.variationId].entradas += m.qty
      else monthMovs[m.variationId].saidas += m.qty
    }
    if (d >= to) {
      if (!afterPeriodMovs[m.variationId]) afterPeriodMovs[m.variationId] = 0
      afterPeriodMovs[m.variationId] += m.type === 'entrada' ? m.qty : -m.qty
    }
  }

  const STATUS_LABEL = { zero: 'Zero', critical: 'Crítico', alert: 'Alerta', ok: 'OK' }
  const sep = ';'
  const header = ['Grupo', 'Categoria', 'Subcategoria', 'Item', 'Variação', 'Unidade', `Saldo em ${cutoffLabel}`, 'Estoque Atual', 'Estoque Mínimo', 'Status', `Entradas (${monthTag})`, `Saídas (${monthTag})`, 'Local'].join(sep)

  const rows = sortedFilteredRows.value.map(row => {
    const attrs = []
    for (const k of (row.item.attributes || [])) {
      const v = row.variation.values?.[k]
      if (v) attrs.push(`${k}: ${v}`)
    }
    for (const [k, v] of Object.entries(row.variation.extras || {})) {
      if (v) attrs.push(`${k}: ${v}`)
    }
    const vm = monthMovs[row.variation.id] || { entradas: 0, saidas: 0 }
    const stockAtCutoff = row.variation.stock - (afterPeriodMovs[row.variation.id] || 0)
    return [
      row.item.group || '',
      row.item.category || '',
      row.item.subcategory || '',
      row.item.name,
      attrs.join(', '),
      row.item.unit || 'UN',
      stockAtCutoff,
      row.variation.stock,
      row.variation.minStock || 0,
      STATUS_LABEL[row.status],
      vm.entradas,
      vm.saidas,
      row.variation.location || '',
    ].map(v => String(v).replace(/;/g, ',')).join(sep)
  })

  const bom = '\uFEFF'
  const csv = bom + header + '\n' + rows.join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const fileTag = `${year}-${String(month).padStart(2, '0')}`
  a.download = `estoque_${fileTag}.csv`
  a.click()
  URL.revokeObjectURL(url)
  success(`Relatório exportado: estoque_${fileTag}.csv`)
}
</script>

<template>
  <div class="space-y-4">

    <!-- Header -->
    <div class="flex items-center justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Inventário</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          <template v-if="filterStatus === 'all'">
            Todas as variações cadastradas
            <span v-if="counts.all" class="ml-1 font-medium text-gray-700 dark:text-gray-300">({{ counts.all }})</span>
          </template>
          <template v-else>
            Variações que precisam de atenção
            <span v-if="alertRows.length" class="ml-1 font-medium text-gray-700 dark:text-gray-300">({{ alertRows.length }})</span>
          </template>
        </p>
      </div>
    </div>

    <div class="ds-segmented">
      <button
        type="button"
        class="ds-segmented-item"
        :class="inventorySection === 'estoque' ? 'ds-segmented-item-active' : ''"
        @click="inventorySection = 'estoque'"
      >
        Estoque
      </button>
      <button
        type="button"
        class="ds-segmented-item"
        :class="inventorySection === 'fechamentos' ? 'ds-segmented-item-active' : ''"
        @click="inventorySection = 'fechamentos'"
      >
        Fechamentos
      </button>
    </div>

    <template v-if="inventorySection === 'estoque'">
    <!-- Filter tabs + CSV export -->
    <div class="flex items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-700">
      <div class="flex items-center gap-1">
        <button
          v-for="tab in FILTER_TABS"
          :key="tab.id"
          class="flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors relative"
          :class="filterStatus === tab.id
            ? 'text-primary-700 dark:text-primary-400'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'"
          @click="filterStatus = tab.id"
        >
          {{ tab.label }}
          <span
            v-if="tab.countKey && counts[tab.countKey]"
            class="text-[11px] font-semibold px-1.5 py-0.5 rounded-full"
            :class="FILTER_COUNT_CLASS[tab.countKey]"
          >{{ counts[tab.countKey] }}</span>
          <span
            v-if="filterStatus === tab.id"
            class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 dark:bg-primary-400 rounded-full"
          ></span>
        </button>
      </div>

      <!-- CSV export -->
      <div class="flex items-center gap-2 pb-1">
        <div class="relative">
          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-primary-400 dark:hover:border-primary-500 hover:text-primary-700 dark:hover:text-primary-400 transition-colors cursor-pointer"
            @click="columnMenuOpen = !columnMenuOpen"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 5.25h16.5M3.75 9.75h16.5M3.75 14.25h16.5M3.75 18.75h16.5" />
            </svg>
            Colunas
          </button>
          <div
            v-if="columnMenuOpen"
            class="absolute right-0 top-full z-20 mt-2 w-56 rounded-lg border border-gray-200 bg-white p-2 shadow-xl dark:border-gray-700 dark:bg-gray-900"
          >
            <button
              v-for="column in columnOptions"
              :key="column.key"
              type="button"
              class="w-full flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              @click="toggleColumn(column.key)"
            >
              <span
                class="flex h-4 w-4 items-center justify-center rounded border"
                :class="isColumnVisible(column.key)
                  ? 'border-primary-500 bg-primary-600 text-white'
                  : 'border-gray-300 dark:border-gray-600'"
              >
                <svg v-if="isColumnVisible(column.key)" class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </span>
              {{ column.label }}
            </button>
          </div>
        </div>
        <select
          v-model="csvSelectedMonth"
          class="px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-primary-500 transition-colors"
        >
          <option v-for="m in CSV_MONTHS" :key="m.value" :value="m.value">{{ m.label }}</option>
        </select>
        <select
          v-model="csvSelectedYear"
          class="px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-primary-500 transition-colors"
        >
          <option v-for="y in csvYears" :key="y" :value="y">{{ y }}</option>
        </select>
        <button
          class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-primary-400 dark:hover:border-primary-500 hover:text-primary-700 dark:hover:text-primary-400 transition-colors"
          title="Exportar relatório de estoque em CSV"
          @click="exportCSV"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Exportar CSV
        </button>
      </div>
    </div>

    <!-- Empty: no alerts -->
    <div v-if="alertRows.length === 0 && filterStatus !== 'all'" class="flex flex-col items-center justify-center py-20 text-center">
      <svg class="w-12 h-12 text-green-300 dark:text-green-700 mb-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
      <p class="text-lg font-medium text-gray-600 dark:text-gray-300">Estoque em dia!</p>
      <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">Nenhuma variação com estoque baixo ou zerado.</p>
    </div>

    <!-- Body: facet sidebar + table -->
    <div v-if="showBody" class="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden flex items-start">

      <!-- ===== Facet sidebar ===== -->
      <div class="w-44 flex-shrink-0 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-3 space-y-2 self-stretch">

        <!-- Search -->
        <div class="relative">
          <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-gray-500 pointer-events-none" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Buscar..."
            class="w-full pl-8 pr-7 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700/60 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
          />
          <button
            v-if="searchQuery"
            class="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            @click="searchQuery = ''"
          >
            <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <!-- ===== Cascade: no group selected — show group list ===== -->
        <template v-if="!filterGroup">
          <ul class="space-y-0.5 mt-1">
            <li v-for="g in facetGroups" :key="g">
              <button
                class="w-full text-left px-2 py-1.5 rounded-md text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors truncate"
                @click="setGroup(g)"
              >{{ g }}</button>
            </li>
          </ul>
        </template>

        <!-- ===== Cascade: group selected, no category yet ===== -->
        <template v-else-if="filterGroup && !filterCategory">
          <button
            class="w-full text-left px-2 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700/60 transition-colors flex items-center gap-1 border-b border-gray-200 dark:border-gray-700 mb-1"
            @click="backToGroups"
          >
            <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
            Todos os Grupos
          </button>
          <p class="px-2 py-1 text-xs font-bold text-gray-800 dark:text-gray-100 truncate">{{ filterGroup }}</p>
          <ul class="space-y-0.5 mt-1">
            <li v-for="c in facetCategories" :key="c">
              <button
                class="w-full text-left px-2 py-1.5 rounded-md text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors truncate"
                @click="setCategory(c)"
              >{{ c }}</button>
            </li>
          </ul>
          <!-- Se não há categorias, mostra attr filters direto -->
          <template v-if="!facetCategories.length">
            <template v-for="key in facetAttrKeys" :key="key">
              <div v-if="(facetAttrValueMap[key] || []).length > 1 || filterAttrValues[key]" class="mt-1">
                <button class="w-full flex items-center justify-between gap-1 mb-1 group" @click="toggleAttr(key)">
                  <span class="text-[10px] font-bold uppercase tracking-wider truncate flex items-center gap-1 min-w-0 transition-colors"
                    :class="filterAttrValues[key] ? 'text-primary-500 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'">
                    {{ key }}
                    <span v-if="!templateAttrKeys.has(key)" class="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block flex-shrink-0" title="Atributo extra"></span>
                  </span>
                  <svg class="w-3 h-3 flex-shrink-0 transition-transform text-gray-400 dark:text-gray-500" :class="isAttrCollapsed(key) ? '' : 'rotate-180'" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m19 9-7 7-7-7" /></svg>
                </button>
                <ul v-if="!isAttrCollapsed(key)" class="space-y-0.5">
                  <li v-for="val in (facetAttrValueMap[key] || [])" :key="val">
                    <button class="w-full text-left px-2 py-1 rounded-md text-xs transition-colors truncate"
                      :class="filterAttrValues[key] === val ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 font-semibold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'"
                      @click="setAttrValue(key, val)">{{ val }}</button>
                  </li>
                </ul>
              </div>
            </template>
          </template>
        </template>

        <!-- ===== Cascade: category selected, no subcategory yet ===== -->
        <template v-else-if="filterGroup && filterCategory && !filterSubcategory">
          <button
            class="w-full text-left px-2 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700/60 transition-colors flex items-center gap-1 border-b border-gray-200 dark:border-gray-700 mb-1"
            @click="backToCategories"
          >
            <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
            {{ filterGroup }}
          </button>
          <p class="px-2 py-1 text-xs font-bold text-gray-800 dark:text-gray-100 truncate">{{ filterCategory }}</p>
          <ul v-if="facetSubcategories.length" class="space-y-0.5 mt-1">
            <li v-for="s in facetSubcategories" :key="s">
              <button
                class="w-full text-left px-2 py-1.5 rounded-md text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors truncate"
                @click="setSubcategory(s)"
              >{{ s }}</button>
            </li>
          </ul>
          <!-- Se não há subcategorias, mostra attr filters direto -->
          <template v-if="!facetSubcategories.length">
            <template v-for="key in facetAttrKeys" :key="key">
              <div v-if="(facetAttrValueMap[key] || []).length > 1 || filterAttrValues[key]" class="mt-1">
                <button class="w-full flex items-center justify-between gap-1 mb-1 group" @click="toggleAttr(key)">
                  <span class="text-[10px] font-bold uppercase tracking-wider truncate flex items-center gap-1 min-w-0 transition-colors"
                    :class="filterAttrValues[key] ? 'text-primary-500 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'">
                    {{ key }}
                    <span v-if="!templateAttrKeys.has(key)" class="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block flex-shrink-0" title="Atributo extra"></span>
                  </span>
                  <svg class="w-3 h-3 flex-shrink-0 transition-transform text-gray-400 dark:text-gray-500" :class="isAttrCollapsed(key) ? '' : 'rotate-180'" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m19 9-7 7-7-7" /></svg>
                </button>
                <ul v-if="!isAttrCollapsed(key)" class="space-y-0.5">
                  <li v-for="val in (facetAttrValueMap[key] || [])" :key="val">
                    <button class="w-full text-left px-2 py-1 rounded-md text-xs transition-colors truncate"
                      :class="filterAttrValues[key] === val ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 font-semibold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'"
                      @click="setAttrValue(key, val)">{{ val }}</button>
                  </li>
                </ul>
              </div>
            </template>
          </template>
        </template>

        <!-- ===== Cascade: subcategory selected — show attr filters ===== -->
        <template v-else-if="filterGroup && filterCategory && filterSubcategory">
          <button
            class="w-full text-left px-2 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700/60 transition-colors flex items-center gap-1 border-b border-gray-200 dark:border-gray-700 mb-1"
            @click="backToSubcategories"
          >
            <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
            {{ filterCategory }}
          </button>
          <p class="px-2 py-1 text-xs font-bold text-gray-800 dark:text-gray-100 truncate">{{ filterSubcategory }}</p>
          <button
            v-if="Object.keys(filterAttrValues).length"
            class="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline mt-1 px-1"
            @click="filterAttrValues = {}"
          >
            <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
            Limpar filtros
          </button>
          <template v-for="key in facetAttrKeys" :key="key">
            <div v-if="(facetAttrValueMap[key] || []).length > 1 || filterAttrValues[key]" class="mt-1">
              <button class="w-full flex items-center justify-between gap-1 mb-1 group" @click="toggleAttr(key)">
                <span class="text-[10px] font-bold uppercase tracking-wider truncate flex items-center gap-1 min-w-0 transition-colors"
                  :class="filterAttrValues[key] ? 'text-primary-500 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'">
                  {{ key }}
                  <span v-if="!templateAttrKeys.has(key)" class="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block flex-shrink-0" title="Atributo extra"></span>
                </span>
                <svg class="w-3 h-3 flex-shrink-0 transition-transform text-gray-400 dark:text-gray-500" :class="isAttrCollapsed(key) ? '' : 'rotate-180'" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m19 9-7 7-7-7" /></svg>
              </button>
              <ul v-if="!isAttrCollapsed(key)" class="space-y-0.5">
                <li v-for="val in (facetAttrValueMap[key] || [])" :key="val">
                  <button class="w-full text-left px-2 py-1 rounded-md text-xs transition-colors truncate"
                    :class="filterAttrValues[key] === val ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 font-semibold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'"
                    @click="setAttrValue(key, val)">{{ val }}</button>
                </li>
              </ul>
            </div>
          </template>
        </template>

      </div>

      <!-- ===== Main area ===== -->
      <div class="flex-1 min-w-0 bg-white dark:bg-gray-900">

        <!-- Empty: filter yields nothing -->
        <div v-if="filteredRows.length === 0" class="py-12 text-center text-gray-400 dark:text-gray-500 text-sm">
          Nenhum resultado para os filtros selecionados.
        </div>

        <div v-else>
          <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
                <th class="px-4 py-2.5 text-left font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider w-[200px]">
                  <button type="button" class="inline-flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400 cursor-pointer" @click="setSort('item')">
                    Item <span class="text-[10px]">{{ sortArrow('item') }}</span>
                  </button>
                </th>
                <th v-if="isColumnVisible('variation')" class="px-4 py-2.5 text-left font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">
                  <button type="button" class="inline-flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400 cursor-pointer" @click="setSort('variation')">
                    Variação <span class="text-[10px]">{{ sortArrow('variation') }}</span>
                  </button>
                </th>
                <th v-if="isColumnVisible('current')" class="px-4 py-2.5 text-center font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider w-24">
                  <button type="button" class="inline-flex items-center justify-center gap-1 hover:text-primary-600 dark:hover:text-primary-400 cursor-pointer" @click="setSort('current')">
                    Qtd. atual <span class="text-[10px]">{{ sortArrow('current') }}</span>
                  </button>
                </th>
                <th v-if="isColumnVisible('min')" class="px-4 py-2.5 text-center font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider w-20">
                  <button type="button" class="inline-flex items-center justify-center gap-1 hover:text-primary-600 dark:hover:text-primary-400 cursor-pointer" @click="setSort('min')">
                    Mín. <span class="text-[10px]">{{ sortArrow('min') }}</span>
                  </button>
                </th>
                <th v-if="isColumnVisible('status')" class="px-4 py-2.5 text-center font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider w-32">
                  <button type="button" class="inline-flex items-center justify-center gap-1 hover:text-primary-600 dark:hover:text-primary-400 cursor-pointer" @click="setSort('status')">
                    Status <span class="text-[10px]">{{ sortArrow('status') }}</span>
                  </button>
                </th>
                <th v-if="isColumnVisible('history')" class="px-4 py-2.5 text-center font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider w-28">Histórico</th>
                <th v-if="isLoggedIn && isColumnVisible('adjust')" class="px-4 py-2.5 text-center font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider w-44">Ações</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
              <tr
                v-for="row in paginatedRows"
                :key="row.variation.id"
                class="hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors"
              >
                <!-- Item -->
                <td class="px-4 py-3">
                  <p class="font-medium text-gray-800 dark:text-gray-100 leading-snug">{{ row.item.name }}</p>
                  <p class="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 leading-tight">{{ hierarchyLabel(row.item) }}</p>
                </td>

                <!-- Variação: attribute pills -->
                <td v-if="isColumnVisible('variation')" class="px-4 py-3">
                  <div class="flex flex-wrap gap-1">
                    <!-- Template attribute pills (blue) -->
                    <template v-for="attr in (row.item.attributes || [])" :key="attr">
                      <span
                        v-if="row.variation.values && row.variation.values[attr]"
                        class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[11px] bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border border-primary-100 dark:border-primary-800"
                      >
                        <span class="font-medium opacity-60">{{ attr }}:</span>
                        <span>{{ row.variation.values[attr] }}</span>
                      </span>
                    </template>
                    <!-- Extra attribute pills (yellow) -->
                    <template v-for="(val, key) in (row.variation.extras || {})" :key="'x-' + key">
                      <span
                        v-if="val"
                        class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[11px] bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-800"
                      >
                        <span class="font-medium opacity-60">{{ key }}:</span>
                        <span>{{ val }}</span>
                      </span>
                    </template>
                    <!-- Fallback -->
                    <span
                      v-if="!Object.values(row.variation.values || {}).some(Boolean) && !Object.values(row.variation.extras || {}).some(Boolean)"
                      class="text-gray-300 dark:text-gray-600 text-xs"
                    >—</span>
                  </div>
                </td>

                <!-- Qtd atual -->
                <td v-if="isColumnVisible('current')" class="px-4 py-3 text-center">
                  <span
                    class="text-base font-semibold"
                    :class="row.status === 'zero'
                      ? 'text-red-600 dark:text-red-400'
                      : row.status === 'critical'
                        ? 'text-orange-600 dark:text-orange-400'
                        : row.status === 'alert'
                          ? 'text-yellow-600 dark:text-yellow-500'
                          : 'text-green-600 dark:text-green-400'"
                  >{{ row.variation.stock }}</span>
                  <span class="text-xs text-gray-400 dark:text-gray-500 ml-1">{{ row.item.unit }}</span>
                </td>

                <!-- Mín. -->
                <td v-if="isColumnVisible('min')" class="px-4 py-3 text-center">
                  <span v-if="row.variation.minStock > 0" class="text-gray-600 dark:text-gray-400">{{ row.variation.minStock }}</span>
                  <span v-else class="text-gray-300 dark:text-gray-600">—</span>
                </td>

                <!-- Status pill -->
                <td v-if="isColumnVisible('status')" class="px-4 py-3 text-center">
                  <span
                    class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
                    :class="STATUS_CONFIG[row.status].pillClass"
                  >{{ STATUS_CONFIG[row.status].label }}</span>
                </td>

                <!-- Histórico -->
                <td v-if="isColumnVisible('history')" class="px-4 py-3 text-center">
                  <button
                    class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-primary-400 dark:hover:border-primary-600 hover:text-primary-700 dark:hover:text-primary-400 transition-colors cursor-pointer"
                    @click="openVariationHistory(row)"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    Histórico
                  </button>
                </td>

                <!-- Ações rápidas -->
                <td v-if="isLoggedIn && isColumnVisible('adjust')" class="px-4 py-3 text-center">
                  <div v-if="adjustingId === row.variation.id" class="flex items-center justify-center gap-1">
                    <input
                      ref="adjustInput"
                      v-model="adjustValue"
                      type="number"
                      step="1"
                      placeholder="+/-"
                      class="w-16 px-2 py-1 text-center text-sm border border-primary-400 dark:border-primary-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      @keydown="onAdjustKeydown($event, row.variation.id)"
                    />
                    <button
                      class="p-1 rounded text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors cursor-pointer"
                      title="Confirmar"
                      @click="confirmAdjust(row.variation.id)"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    </button>
                    <button
                      class="p-1 rounded text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                      title="Cancelar"
                      @click="cancelAdjust"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div v-else class="relative flex items-center justify-center gap-1.5">
                    <button
                      v-if="isAdmin"
                      class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-primary-400 dark:hover:border-primary-600 hover:text-primary-700 dark:hover:text-primary-400 transition-colors cursor-pointer"
                      title="Corrigir saldo manualmente"
                      @click="startAdjust(row.variation.id, row.variation.stock)"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                      </svg>
                    </button>
                    <div class="rounded-lg p-[1px] bg-[linear-gradient(90deg,#16a34a_0_50%,#dc2626_50%_100%)]">
                      <button
                        type="button"
                        class="inline-flex h-8 w-8 items-center justify-center rounded-[7px] bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                        title="Movimentação"
                        :aria-expanded="movementMenuId === row.variation.id"
                        @click="toggleMovementMenu(row.variation.id)"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M7.5 7.5h9m0 0-3-3m3 3-3 3M16.5 16.5h-9m0 0 3 3m-3-3 3-3" />
                        </svg>
                      </button>
                    </div>
                    <div
                      v-if="movementMenuId === row.variation.id"
                      class="absolute right-0 top-9 z-20 w-32 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl"
                    >
                      <button
                        type="button"
                        class="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors cursor-pointer"
                        @click="quickMovement(row, 'entrada')"
                      >
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m0-15 6 6m-6-6-6 6" />
                        </svg>
                        Entrada
                      </button>
                      <button
                        type="button"
                        class="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
                        @click="quickMovement(row, 'saida')"
                      >
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M12 19.5v-15m0 15-6-6m6 6 6-6" />
                        </svg>
                        Saída
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          </div>

          <!-- Pagination controls -->
          <div class="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/40">
            <!-- Page size selector -->
            <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span>Exibir</span>
              <select
                v-model.number="pageSize"
                class="px-2 py-1 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-primary-500 transition-colors text-xs"
              >
                <option v-for="opt in PAGE_SIZE_OPTIONS" :key="opt" :value="opt">{{ opt }}</option>
              </select>
              <span>por página</span>
              <span class="text-gray-400 dark:text-gray-500 ml-2">
                {{ (currentPage - 1) * pageSize + 1 }}–{{ Math.min(currentPage * pageSize, sortedFilteredRows.length) }} de {{ sortedFilteredRows.length }}
              </span>
            </div>

            <!-- Page navigation -->
            <div class="flex items-center gap-1">
              <button
                class="px-2 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 transition-colors"
                :class="currentPage <= 1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200'"
                :disabled="currentPage <= 1"
                @click="currentPage = 1"
                title="Primeira página"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m18.75 19.5-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" /></svg>
              </button>
              <button
                class="px-2 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 transition-colors"
                :class="currentPage <= 1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200'"
                :disabled="currentPage <= 1"
                @click="currentPage--"
                title="Página anterior"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
              </button>

              <span class="px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-200">
                {{ currentPage }} / {{ totalPages }}
              </span>

              <button
                class="px-2 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 transition-colors"
                :class="currentPage >= totalPages ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200'"
                :disabled="currentPage >= totalPages"
                @click="currentPage++"
                title="Próxima página"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
              </button>
              <button
                class="px-2 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 transition-colors"
                :class="currentPage >= totalPages ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200'"
                :disabled="currentPage >= totalPages"
                @click="currentPage = totalPages"
                title="Última página"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m5.25 4.5 7.5 7.5-7.5 7.5m6-15 7.5 7.5-7.5 7.5" /></svg>
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>

    </template>

    <FechamentosView v-else />

    <div
      v-if="historyRow"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @click.self="closeVariationHistory"
    >
      <section class="w-full max-w-5xl max-h-[86vh] overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl">
        <div class="flex items-start justify-between gap-4 border-b border-gray-200 dark:border-gray-700 p-4">
          <div class="min-w-0">
            <p class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Histórico por item / variação</p>
            <h2 class="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">{{ historyRow.item.name }}</h2>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate">{{ hierarchyLabel(historyRow.item) }}</p>
            <div class="mt-3 flex flex-wrap gap-1.5">
              <template v-for="attr in (historyRow.item.attributes || [])" :key="attr">
                <span
                  v-if="historyRow.variation.values && historyRow.variation.values[attr]"
                  class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[11px] bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border border-primary-100 dark:border-primary-800"
                >
                  <span class="font-medium opacity-60">{{ attr }}:</span>
                  <span>{{ historyRow.variation.values[attr] }}</span>
                </span>
              </template>
              <template v-for="(val, key) in (historyRow.variation.extras || {})" :key="'history-' + key">
                <span
                  v-if="val"
                  class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[11px] bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-800"
                >
                  <span class="font-medium opacity-60">{{ key }}:</span>
                  <span>{{ val }}</span>
                </span>
              </template>
            </div>
          </div>
          <button
            class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            title="Fechar"
            @click="closeVariationHistory"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="grid grid-cols-2 lg:grid-cols-5 gap-3 border-b border-gray-200 dark:border-gray-700 p-4">
          <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3">
            <p class="text-xs text-gray-500 dark:text-gray-400">Estoque atual</p>
            <p class="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-100">{{ historyRow.variation.stock }} {{ historyRow.item.unit }}</p>
          </div>
          <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3">
            <p class="text-xs text-gray-500 dark:text-gray-400">Entradas registradas</p>
            <p class="mt-1 text-xl font-semibold text-green-600 dark:text-green-400">{{ historyTotals.entradas }} {{ historyRow.item.unit }}</p>
          </div>
          <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3">
            <p class="text-xs text-gray-500 dark:text-gray-400">Saídas registradas</p>
            <p class="mt-1 text-xl font-semibold text-red-600 dark:text-red-400">{{ historyTotals.saidas }} {{ historyRow.item.unit }}</p>
          </div>
          <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3">
            <p class="text-xs text-gray-500 dark:text-gray-400">OS vinculadas</p>
            <p class="mt-1 text-xl font-semibold text-primary-600 dark:text-primary-400">{{ historyTotals.os }}</p>
          </div>
          <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3">
            <p class="text-xs text-gray-500 dark:text-gray-400">Destinos vinculados</p>
            <p class="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-100">{{ historyLinkedDestinations.length }}</p>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-[1fr_18rem] gap-4 max-h-[48vh] overflow-auto p-4">
          <div>
            <h3 class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">Linha do tempo</h3>
            <div v-if="!historyTimeline.length" class="rounded-lg border border-dashed border-gray-200 dark:border-gray-700 p-6 text-sm text-gray-500 dark:text-gray-400">
              Nenhuma movimentação registrada para esta variação.
            </div>
            <div v-else class="space-y-3">
              <article
                v-for="entry in historyTimeline"
                :key="entry.movement.id"
                class="relative rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/40 p-3 pl-4"
              >
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                      <span
                        class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
                        :class="entry.movement.type === 'entrada'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'"
                      >
                        {{ entry.movement.type === 'entrada' ? 'Entrada' : 'Saída' }}
                      </span>
                      <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ entry.title }}</h4>
                    </div>
                    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ entry.subtitle }}</p>
                    <p v-if="entry.order" class="mt-1 text-xs text-primary-700 dark:text-primary-300">
                      {{ entry.order.title || entry.order.equipment || 'Ordem de serviço' }}
                    </p>
                    <p v-if="entry.movement.note" class="mt-2 text-xs text-gray-600 dark:text-gray-300">{{ entry.movement.note }}</p>
                  </div>
                  <div class="text-right text-xs text-gray-500 dark:text-gray-400">
                    <p>{{ formatHistoryDate(entry.movement.date) }}</p>
                    <p class="mt-1 font-semibold text-gray-900 dark:text-gray-100">{{ entry.movement.qty }} {{ historyRow.item.unit }}</p>
                  </div>
                </div>
                <div class="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span class="text-gray-400 dark:text-gray-500">Estoque</span>
                    <p class="font-medium text-gray-800 dark:text-gray-200">{{ movementStock(entry.movement) }}</p>
                  </div>
                  <div>
                    <span class="text-gray-400 dark:text-gray-500">Responsável</span>
                    <p class="font-medium text-gray-800 dark:text-gray-200">{{ movementResponsible(entry.movement) }}</p>
                  </div>
                  <div>
                    <span class="text-gray-400 dark:text-gray-500">Local</span>
                    <p class="font-medium text-gray-800 dark:text-gray-200">{{ movementPlace(entry.movement) }}</p>
                  </div>
                  <div>
                    <span class="text-gray-400 dark:text-gray-500">Operador</span>
                    <p class="font-medium text-gray-800 dark:text-gray-200">{{ entry.movement.operatorName || entry.movement.operator || '-' }}</p>
                  </div>
                </div>
              </article>
            </div>
          </div>

          <aside class="space-y-3">
            <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3">
              <h3 class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Destinos vinculados</h3>
              <div v-if="historyLinkedDestinations.length" class="mt-3 flex flex-wrap gap-1.5">
                <span
                  v-for="dest in historyLinkedDestinations"
                  :key="dest.id"
                  class="inline-flex rounded px-2 py-1 text-xs bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
                >
                  {{ dest.name }}
                </span>
              </div>
              <p v-else class="mt-3 text-sm text-gray-500 dark:text-gray-400">Nenhum destino vinculado no cadastro.</p>
            </div>

            <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3">
              <h3 class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Resumo</h3>
              <dl class="mt-3 space-y-2 text-sm">
                <div class="flex justify-between gap-3">
                  <dt class="text-gray-500 dark:text-gray-400">Ajustes</dt>
                  <dd class="font-medium text-gray-900 dark:text-gray-100">{{ historyTotals.ajustes }}</dd>
                </div>
                <div class="flex justify-between gap-3">
                  <dt class="text-gray-500 dark:text-gray-400">Movimentações</dt>
                  <dd class="font-medium text-gray-900 dark:text-gray-100">{{ historyMovements.length }}</dd>
                </div>
                <div class="flex justify-between gap-3">
                  <dt class="text-gray-500 dark:text-gray-400">Último movimento</dt>
                  <dd class="font-medium text-gray-900 dark:text-gray-100">{{ historyMovements[0] ? formatHistoryDate(historyMovements[0].date) : '-' }}</dd>
                </div>
              </dl>
            </div>
          </aside>
        </div>
      </section>
    </div>

  </div>
</template>
