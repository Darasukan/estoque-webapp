<script setup>
import { computed, inject, onMounted, ref, watch } from 'vue'
import { useMotors, MOTOR_EVENT_TYPES, MOTOR_STATUSES, motorStatusLabel, motorEventLabel, motorMatchesSearch, motorMatchesIdentity, buildMotorDestinationTree } from '../composables/useMotors.js'
import { useDestinations } from '../composables/useDestinations.js'
import { useWorkOrders } from '../composables/useWorkOrders.js'
import { useItems } from '../composables/useItems.js'
import { useToast } from '../composables/useToast.js'
import OrdensServicoView from './OrdensServicoView.vue'
import AppButton from '../components/ui/AppButton.vue'
import AppDialog from '../components/ui/AppDialog.vue'
import ConfirmInline from '../components/ui/ConfirmInline.vue'
import DestinationTreePicker from '../components/ui/DestinationTreePicker.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import StatusBadge from '../components/ui/StatusBadge.vue'
import AttributeBadges from '../components/ui/AttributeBadges.vue'

const isLoggedIn = inject('isLoggedIn')
const canManageMotorOrders = computed(() => Boolean(isLoggedIn?.value ?? isLoggedIn))

const {
  motors,
  motorEvents,
  motorMaterials,
  loadData,
  loadEvents,
  loadMaterials,
  addMotorMaterial,
  removeMotorMaterial,
  addMotor,
  editMotor,
  removeMotor,
} = useMotors()
const { items, variations } = useItems()
const { destinations, groupedDestinations, getDestFullName } = useDestinations()
const { workOrders } = useWorkOrders()
const { success, error } = useToast()
const motorPowerUnits = ['CV', 'HP']
const motorSearchScopes = [
  { id: 'all', label: 'Tudo' },
  { id: 'tag', label: 'Nº motor' },
  { id: 'serial', label: 'Série' },
  { id: 'manufacturer', label: 'Fabricante' },
  { id: 'power_cv', label: 'CV' },
  { id: 'power_hp', label: 'HP' },
  { id: 'voltage', label: 'Tensão' },
  { id: 'amperage', label: 'Amperagem' },
  { id: 'destination', label: 'Local' },
  { id: 'status', label: 'Status' },
]

const search = ref('')
const searchScope = ref('all')
const motorPage = ref(1)
const MOTOR_PAGE_SIZE = 8
const motorSortKey = ref('tag')
const motorSortDirection = ref('asc')
const motorViewMode = ref('catalogo')
const motorCatalogPath = ref([])
const selectedMotorId = ref('')
const showForm = ref(false)
const editingMotorId = ref(null)
const materialsPanelOpen = ref(false)
const osPrefillMotor = ref(null)
const osActiveTab = ref('ordens')
const osInitialStatus = ref('open')
const osMotorFilterId = ref('')
const osFocusOrderId = ref('')
const osRouteKey = ref(0)
const confirmDeleteMotorId = ref(null)
const confirmCreateMotor = ref(false)
const locationTrailOpen = ref(false)
const eventSummaryOpen = ref(false)
const workOrderPreview = ref(null)
const selectedEventSummaryType = ref('rebobinado')
const motorMaterialSearch = ref('')
const motorMaterialVariationId = ref('')
const motorMaterialNote = ref('')
const motorMaterialSelectorOpen = ref(false)
const motorMaterialGroup = ref('')
const motorMaterialCategory = ref('')
const motorMaterialSubcategory = ref('')
const motorMaterialItemId = ref('')
const motorSaving = ref(false)
const motorFormAttempted = ref(false)

const motorForm = ref(emptyMotorForm())

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })

function compareText(a, b) {
  return collator.compare(String(a || ''), String(b || ''))
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function compareMotorSort(a, b) {
  if (motorSortKey.value === 'name') {
    return compareText(a.name || a.manufacturer, b.name || b.manufacturer) || compareText(a.tag, b.tag)
  }
  if (motorSortKey.value === 'destination') {
    return compareText(a.destinationName, b.destinationName) || compareText(a.tag, b.tag)
  }
  if (motorSortKey.value === 'status') {
    return compareText(motorStatusLabel(a.status), motorStatusLabel(b.status)) || compareText(a.tag, b.tag)
  }
  return compareText(a.tag, b.tag)
}

function sortMotors(list) {
  const direction = motorSortDirection.value === 'desc' ? -1 : 1
  return [...list].sort((a, b) => compareMotorSort(a, b) * direction)
}

function setMotorSort(key) {
  if (motorSortKey.value === key) motorSortDirection.value = motorSortDirection.value === 'asc' ? 'desc' : 'asc'
  else {
    motorSortKey.value = key
    motorSortDirection.value = 'asc'
  }
}

function motorSortArrow(key) {
  if (motorSortKey.value !== key) return ''
  return motorSortDirection.value === 'asc' ? '↑' : '↓'
}

function emptyMotorForm() {
  return {
    tag: '',
    serial: '',
    name: '',
    manufacturer: '',
    power: '',
    powerUnit: 'CV',
    voltage: '',
    rpm: '',
    amperage: '',
    destinationId: '',
    status: 'ativo',
    notes: '',
  }
}

const orderedDestinations = computed(() => {
  const list = []
  for (const g of groupedDestinations.value) {
    list.push(g.parent)
    for (const c of g.children) list.push(c)
  }
  return list
})

const filteredMotors = computed(() => {
  const scope = motorViewMode.value === 'catalogo' ? searchScope.value : 'tag'
  const identityMatches = scope === 'all'
    ? motors.value.filter(m => motorMatchesIdentity(m, search.value))
    : []
  const list = identityMatches.length
    ? identityMatches
    : motors.value.filter(m => motorMatchesSearch(m, search.value, getDestFullName(m.destinationId), scope))
  return sortMotors(list)
})

const motorCatalogTree = computed(() =>
  buildMotorDestinationTree(filteredMotors.value, destinations.value)
)

const motorCatalogBreadcrumb = computed(() => {
  const result = []
  let nodes = motorCatalogTree.value
  for (const id of motorCatalogPath.value) {
    const node = nodes.find(candidate => candidate.id === id)
    if (!node) break
    result.push(node)
    nodes = node.children
  }
  return result
})

const motorCatalogCurrentNode = computed(() =>
  motorCatalogBreadcrumb.value.at(-1) || null
)

const motorCatalogDestinationCards = computed(() =>
  motorCatalogCurrentNode.value?.children || motorCatalogTree.value
)

const motorCatalogMotorCards = computed(() =>
  motorCatalogCurrentNode.value?.motors || []
)

function openMotorCatalogDestination(node) {
  motorCatalogPath.value.push(node.id)
}

function goToMotorCatalogLevel(index) {
  motorCatalogPath.value = index < 0 ? [] : motorCatalogPath.value.slice(0, index + 1)
}

const selectedMotor = computed(() =>
  filteredMotors.value.find(m => m.id === selectedMotorId.value) || filteredMotors.value[0] || null
)

const motorTotalPages = computed(() => Math.max(1, Math.ceil(filteredMotors.value.length / MOTOR_PAGE_SIZE)))

const paginatedMotors = computed(() => {
  const start = (motorPage.value - 1) * MOTOR_PAGE_SIZE
  return filteredMotors.value.slice(start, start + MOTOR_PAGE_SIZE)
})

const selectedWorkOrders = computed(() =>
  selectedMotor.value
    ? workOrders.value.filter(wo => wo.motorId === selectedMotor.value.id).sort((a, b) => workOrderSortKey(b).localeCompare(workOrderSortKey(a)))
    : []
)

const selectedOpenWorkOrders = computed(() =>
  selectedWorkOrders.value.filter(wo => !wo.maintenanceEndDate)
)

const selectedFinishedWorkOrders = computed(() =>
  selectedWorkOrders.value.filter(wo => wo.maintenanceEndDate)
)

const motorFormBlockReason = computed(() =>
  motorForm.value.tag.trim() ? '' : 'Informe a tag/patrimonio do motor.'
)

const visibleMotorFormBlockReason = computed(() =>
  motorFormAttempted.value ? motorFormBlockReason.value : ''
)

const itemById = computed(() => new Map(items.value.map(item => [item.id, item])))
const DIRECT_ITEMS_SUBCATEGORY = 'Itens diretos'

function variationLabel(variation, item) {
  const values = Object.entries(variation.values || {}).map(([key, value]) => `${key}: ${value}`)
  const extras = Object.entries(variation.extras || {}).map(([key, value]) => `${key}: ${value}`)
  return [item?.name, ...values, ...extras].filter(Boolean).join(' / ')
}

function materialOptionPath(row) {
  return [row.item.group, row.item.category, row.item.subcategory].filter(Boolean).join(' > ')
}

function materialOptionDetails(row) {
  return [
    ...Object.entries(row.variation.values || {}).map(([key, value]) => `${key}: ${value}`),
    ...Object.entries(row.variation.extras || {}).map(([key, value]) => `${key}: ${value}`),
  ].filter(Boolean).join(' · ')
}

function materialOptionLabel(row) {
  return `${materialOptionPath(row)} - ${variationLabel(row.variation, row.item)}`
}

const selectedMotorMaterialIds = computed(() => {
  if (!selectedMotor.value) return new Set()
  return new Set((motorMaterials.value[selectedMotor.value.id] || []).map(material => material.variationId))
})

const availableMotorMaterialRows = computed(() =>
  variations.value
    .map(variation => ({ variation, item: itemById.value.get(variation.itemId) }))
    .filter(row => row.item)
    .filter(row => !selectedMotorMaterialIds.value.has(row.variation.id))
)

const motorMaterialOptions = computed(() => {
  const terms = normalizeText(motorMaterialSearch.value).split(/\s+/).filter(Boolean)
  return variations.value
    .map(variation => ({ variation, item: itemById.value.get(variation.itemId) }))
    .filter(row => row.item)
    .filter(row => !selectedMotorMaterialIds.value.has(row.variation.id))
    .filter(row => {
      if (!terms.length) return true
      const haystack = normalizeText([
        materialOptionPath(row),
        row.item.name,
        materialOptionDetails(row),
        row.item.unit,
        row.variation.location,
      ].join(' '))
      return terms.every(term => haystack.includes(term))
    })
    .sort((a, b) => materialOptionLabel(a).localeCompare(materialOptionLabel(b), 'pt-BR', { sensitivity: 'base', numeric: true }))
})

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base', numeric: true }))
}

const motorMaterialGroups = computed(() =>
  uniqueSorted(availableMotorMaterialRows.value.map(row => row.item.group || 'Sem grupo'))
)

const motorMaterialCategories = computed(() => {
  if (!motorMaterialGroup.value) return []
  return uniqueSorted(
    availableMotorMaterialRows.value
      .filter(row => (row.item.group || 'Sem grupo') === motorMaterialGroup.value)
      .map(row => row.item.category || 'Sem categoria')
  )
})

const motorMaterialSubcategories = computed(() => {
  if (!motorMaterialGroup.value || !motorMaterialCategory.value) return []
  const scopedRows = availableMotorMaterialRows.value.filter(row =>
    (row.item.group || 'Sem grupo') === motorMaterialGroup.value &&
    (row.item.category || 'Sem categoria') === motorMaterialCategory.value
  )
  const subs = uniqueSorted(scopedRows.map(row => row.item.subcategory))
  if (subs.length && scopedRows.some(row => !row.item.subcategory)) return [...subs, DIRECT_ITEMS_SUBCATEGORY]
  return subs
})

const motorMaterialItems = computed(() => {
  if (!motorMaterialGroup.value || !motorMaterialCategory.value) return []
  const hasSubcategories = motorMaterialSubcategories.value.length > 0
  const byId = new Map()
  for (const row of availableMotorMaterialRows.value) {
    if ((row.item.group || 'Sem grupo') !== motorMaterialGroup.value) continue
    if ((row.item.category || 'Sem categoria') !== motorMaterialCategory.value) continue
    if (motorMaterialSubcategory.value === DIRECT_ITEMS_SUBCATEGORY && row.item.subcategory) continue
    else if (hasSubcategories && motorMaterialSubcategory.value && row.item.subcategory !== motorMaterialSubcategory.value) continue
    else if (hasSubcategories && !motorMaterialSubcategory.value) continue
    if (!byId.has(row.item.id)) byId.set(row.item.id, row.item)
  }
  return [...byId.values()].sort((a, b) => compareText(a.name, b.name))
})

const motorMaterialItemVariations = computed(() =>
  availableMotorMaterialRows.value
    .filter(row => row.item.id === motorMaterialItemId.value)
    .sort((a, b) => variationLabel(a.variation, a.item).localeCompare(variationLabel(b.variation, b.item), 'pt-BR', { sensitivity: 'base', numeric: true }))
)

const selectedMotorMaterialOption = computed(() => {
  if (!motorMaterialVariationId.value) return null
  const variation = variations.value.find(v => v.id === motorMaterialVariationId.value)
  const item = variation ? itemById.value.get(variation.itemId) : null
  return variation && item ? { variation, item } : null
})

function selectMotorMaterial(row) {
  motorMaterialVariationId.value = row.variation.id
  motorMaterialSearch.value = ''
  motorMaterialGroup.value = row.item.group || 'Sem grupo'
  motorMaterialCategory.value = row.item.category || 'Sem categoria'
  motorMaterialSubcategory.value = row.item.subcategory || (motorMaterialSubcategories.value.includes(DIRECT_ITEMS_SUBCATEGORY) ? DIRECT_ITEMS_SUBCATEGORY : '')
  motorMaterialItemId.value = row.item.id
  motorMaterialSelectorOpen.value = false
}

function openMotorMaterialSelector() {
  motorMaterialSelectorOpen.value = true
}

function resetMotorMaterialPath(level = 'root') {
  if (level === 'root') {
    motorMaterialGroup.value = ''
    motorMaterialCategory.value = ''
    motorMaterialSubcategory.value = ''
    motorMaterialItemId.value = ''
    return
  }
  if (level === 'group') {
    motorMaterialCategory.value = ''
    motorMaterialSubcategory.value = ''
    motorMaterialItemId.value = ''
    return
  }
  if (level === 'category') {
    motorMaterialSubcategory.value = ''
    motorMaterialItemId.value = ''
    return
  }
  motorMaterialItemId.value = ''
}

function selectMotorMaterialGroup(group) {
  motorMaterialGroup.value = group
  resetMotorMaterialPath('group')
}

function selectMotorMaterialCategory(category) {
  motorMaterialCategory.value = category
  resetMotorMaterialPath('category')
}

function selectMotorMaterialSubcategory(subcategory) {
  motorMaterialSubcategory.value = subcategory
  motorMaterialItemId.value = ''
}

function motorMaterialRowsForGroup(group) {
  return availableMotorMaterialRows.value.filter(row => (row.item.group || 'Sem grupo') === group)
}

function motorMaterialRowsForCategory(category) {
  return availableMotorMaterialRows.value.filter(row =>
    (row.item.group || 'Sem grupo') === motorMaterialGroup.value &&
    (row.item.category || 'Sem categoria') === category
  )
}

function motorMaterialRowsForSubcategory(subcategory) {
  return availableMotorMaterialRows.value.filter(row => {
    if ((row.item.group || 'Sem grupo') !== motorMaterialGroup.value) return false
    if ((row.item.category || 'Sem categoria') !== motorMaterialCategory.value) return false
    if (subcategory === DIRECT_ITEMS_SUBCATEGORY) return !row.item.subcategory
    return row.item.subcategory === subcategory
  })
}

function motorMaterialItemStock(item) {
  return availableMotorMaterialRows.value
    .filter(row => row.item.id === item.id)
    .reduce((sum, row) => sum + Number(row.variation.stock || 0), 0)
}

function motorMaterialStockTotal(rows) {
  return rows.reduce((sum, row) => sum + Number(row.variation.stock || 0), 0)
}

const selectedMotorMaterials = computed(() => {
  if (!selectedMotor.value) return []
  return (motorMaterials.value[selectedMotor.value.id] || [])
    .map(material => {
      const variation = variations.value.find(v => v.id === material.variationId)
      const item = variation ? itemById.value.get(variation.itemId) : null
      return { material, variation, item }
    })
    .filter(row => row.variation && row.item)
})

const selectedMotorEventCounts = computed(() => {
  const counts = {}
  if (!selectedMotor.value) return counts
  for (const type of MOTOR_EVENT_TYPES) counts[type.id] = 0
  const events = motorEvents.value[selectedMotor.value.id] || []
  for (const event of events) {
    const type = event.eventType === 'enrolar' ? 'enrolado' : event.eventType
    if (!type) continue
    counts[type] = (counts[type] || 0) + 1
  }
  return counts
})

const selectedMotorEventSummary = computed(() => {
  const counts = selectedMotorEventCounts.value
  return MOTOR_EVENT_TYPES.map(type => {
    if (type.id === 'enrolado') return null
    const isWinding = type.id === 'rebobinado'
    return {
      id: type.id,
      label: isWinding ? 'Rebobinado / Enrolado' : type.label,
      count: isWinding
        ? (counts.enrolado || 0) + (counts.rebobinado || 0)
        : counts[type.id] || 0,
      grouped: isWinding,
    }
  }).filter(Boolean)
})

const selectedMotorEventTotal = computed(() =>
  selectedMotorEventSummary.value.reduce((sum, row) => sum + row.count, 0)
)

const workOrderById = computed(() => new Map(workOrders.value.map(order => [order.id, order])))

const selectedMotorEventRows = computed(() => {
  if (!selectedMotor.value) return []
  return (motorEvents.value[selectedMotor.value.id] || [])
    .map(event => ({
      event,
      order: event.workOrderId ? workOrderById.value.get(event.workOrderId) : null,
    }))
    .sort((a, b) => (b.event.eventDate || b.event.createdAt || '').localeCompare(a.event.eventDate || a.event.createdAt || ''))
})

function eventMatchesSummary(eventType, summaryType) {
  const normalized = eventType === 'enrolar' ? 'enrolado' : eventType
  if (summaryType === 'rebobinado') return normalized === 'rebobinado' || normalized === 'enrolado'
  return normalized === summaryType
}

const selectedEventSummary = computed(() =>
  selectedMotorEventSummary.value.find(row => row.id === selectedEventSummaryType.value) ||
  selectedMotorEventSummary.value[0] ||
  null
)

const selectedEventDateRows = computed(() => {
  const summary = selectedEventSummary.value
  if (!summary) return []
  return selectedMotorEventRows.value.filter(({ event }) =>
    eventMatchesSummary(event.eventType, summary.id)
  )
})

const selectedMotorLocationTrail = computed(() => {
  if (!selectedMotor.value) return []
  const events = motorEvents.value[selectedMotor.value.id] || []
  const movements = [...events]
    .filter(event => event.eventType === 'movimentado')
    .sort((a, b) => (a.eventDate || a.createdAt || '').localeCompare(b.eventDate || b.createdAt || ''))

  const periods = []
  let currentPeriod = null

  for (const event of movements) {
    const from = String(event.fromDestination || '').trim()
    const to = String(event.toDestination || '').trim()
    const eventDate = event.eventDate || event.createdAt || ''
    const order = event.workOrderId
      ? selectedWorkOrders.value.find(wo => wo.id === event.workOrderId)
      : null
    const orderNumber = order?.number || ''

    if (!currentPeriod && from && from !== '-') {
      currentPeriod = {
        location: from,
        startDate: '',
        startOrderNumber: '',
      }
    }

    if (currentPeriod?.location && eventDate) {
      periods.push({
        ...currentPeriod,
        endDate: eventDate,
        endOrderNumber: orderNumber,
      })
    }

    if (to && to !== '-') {
      currentPeriod = {
        location: to,
        startDate: eventDate,
        startOrderNumber: orderNumber,
      }
    } else {
      currentPeriod = null
    }
  }

  if (currentPeriod?.location) {
    periods.push({
      ...currentPeriod,
      endDate: '',
      endOrderNumber: '',
    })
  }

  return periods
    .filter(period => period.location)
    .reverse()
})

const motorStats = computed(() => ({
  total: motors.value.length,
  active: motors.value.filter(m => m.status === 'ativo').length,
  maintenance: motors.value.filter(m => m.status === 'em_manutencao').length,
  reserve: motors.value.filter(m => m.status === 'reserva').length,
  inactive: motors.value.filter(m => m.status === 'inativo').length,
}))

onMounted(() => loadData())

watch(selectedMotor, (motor) => {
  if (motor) {
    loadEvents(motor.id).catch(() => {})
    loadMaterials(motor.id).catch(() => {})
  }
  locationTrailOpen.value = false
}, { immediate: true })

watch([search, motorSortKey, motorSortDirection], () => {
  motorPage.value = 1
  motorCatalogPath.value = []
})

watch(motorTotalPages, () => {
  if (motorPage.value > motorTotalPages.value) motorPage.value = motorTotalPages.value
  if (motorPage.value < 1) motorPage.value = 1
})

function selectMotor(motor) {
  cancelMotorForm()
  selectedMotorId.value = motor.id
  motorViewMode.value = 'motores'
  materialsPanelOpen.value = false
  osPrefillMotor.value = null
  osMotorFilterId.value = ''
  osFocusOrderId.value = ''
  confirmDeleteMotorId.value = null
}

function openMotorWorkOrdersPage({ tab = 'ordens', status = 'open', prefillMotor = null, motorId = '', focusOrderId = '' } = {}) {
  cancelMotorForm()
  materialsPanelOpen.value = false
  osActiveTab.value = tab
  osInitialStatus.value = status
  osPrefillMotor.value = prefillMotor
  osMotorFilterId.value = motorId || prefillMotor?.id || ''
  osFocusOrderId.value = focusOrderId
  osRouteKey.value += 1
  motorViewMode.value = 'linha'
}

function setMotorViewMode(mode) {
  if (mode === 'linha') {
    openMotorWorkOrdersPage()
    return
  }
  if (mode !== 'motores') cancelMotorForm()
  motorViewMode.value = mode
}

function startNewMotor() {
  motorViewMode.value = 'motores'
  editingMotorId.value = null
  motorForm.value = emptyMotorForm()
  showForm.value = true
  confirmCreateMotor.value = false
  motorFormAttempted.value = false
}

function startEditMotor(motor) {
  editingMotorId.value = motor.id
  confirmCreateMotor.value = false
  motorFormAttempted.value = false
  motorForm.value = {
    tag: motor.tag,
    serial: motor.serial,
    name: motor.name,
    manufacturer: motor.manufacturer,
    power: motor.power,
    powerUnit: motor.powerUnit || 'CV',
    voltage: motor.voltage,
    rpm: motor.rpm,
    amperage: motor.amperage || '',
    destinationId: motor.destinationId,
    status: motor.status,
    notes: motor.notes,
  }
  showForm.value = true
}

function cancelMotorForm() {
  showForm.value = false
  editingMotorId.value = null
  motorForm.value = emptyMotorForm()
  confirmCreateMotor.value = false
  motorFormAttempted.value = false
}

function requestCreateMotor() {
  motorFormAttempted.value = true
  if (motorFormBlockReason.value) { error(motorFormBlockReason.value); return }
  confirmCreateMotor.value = true
}

async function saveMotor() {
  if (motorSaving.value) return
  motorFormAttempted.value = true
  if (motorFormBlockReason.value) { error(motorFormBlockReason.value); return }
  const isEditing = Boolean(editingMotorId.value)
  motorSaving.value = true
  try {
    const saved = isEditing
      ? await editMotor(editingMotorId.value, motorForm.value)
      : await addMotor(motorForm.value)
    selectedMotorId.value = saved.id
    success(isEditing ? 'Motor atualizado.' : 'Motor cadastrado.')
    cancelMotorForm()
  } catch (e) {
    error(e.message)
  } finally {
    motorSaving.value = false
  }
}

async function deleteSelectedMotor() {
  if (!selectedMotor.value) return
  try {
    await removeMotor(selectedMotor.value.id)
    success('Motor excluido.')
    selectedMotorId.value = ''
    confirmDeleteMotorId.value = null
    materialsPanelOpen.value = false
    osPrefillMotor.value = null
    osMotorFilterId.value = ''
    osFocusOrderId.value = ''
  } catch (e) {
    error(e.message)
  }
}

function showMotorMaterials() {
  if (!selectedMotor.value) return
  materialsPanelOpen.value = true
  osPrefillMotor.value = null
  osMotorFilterId.value = ''
  osFocusOrderId.value = ''
}

async function addSelectedMotorMaterial() {
  if (!selectedMotor.value || !motorMaterialVariationId.value) return
  try {
    await addMotorMaterial(selectedMotor.value.id, {
      variationId: motorMaterialVariationId.value,
      note: motorMaterialNote.value,
    })
    motorMaterialVariationId.value = ''
    motorMaterialSearch.value = ''
    motorMaterialNote.value = ''
    motorMaterialSelectorOpen.value = false
    success('Material vinculado ao motor.')
  } catch (e) {
    error(e.message)
  }
}

async function deleteMotorMaterial(material) {
  if (!selectedMotor.value) return
  try {
    await removeMotorMaterial(selectedMotor.value.id, material.id)
    success('Material removido do motor.')
  } catch (e) {
    error(e.message)
  }
}

function createWorkOrderForMotor() {
  if (!selectedMotor.value || !canManageMotorOrders.value) return
  openMotorWorkOrdersPage({ tab: 'nova', status: 'open', prefillMotor: selectedMotor.value, motorId: selectedMotor.value.id })
}

function registerWorkOrderForMotor() {
  if (!selectedMotor.value || !canManageMotorOrders.value) return
  openMotorWorkOrdersPage({ tab: 'registrar', status: 'finished', prefillMotor: selectedMotor.value, motorId: selectedMotor.value.id })
}

function showMotorOrders(order = null, status = 'open') {
  openMotorWorkOrdersPage({
    tab: 'ordens',
    status: order?.maintenanceEndDate ? 'finished' : status,
    motorId: order?.motorId || selectedMotor.value?.id || '',
    focusOrderId: order?.id || '',
  })
}

function openWorkOrderPreview(order) {
  if (order) workOrderPreview.value = order
}

function showFinishedMotorOrders() {
  showMotorOrders(null, 'finished')
}

function csvCell(value) {
  if (value === null || value === undefined) return ''
  const text = String(value).replace(/\r?\n/g, ' ').trim()
  return `"${text.replace(/"/g, '""')}"`
}

function exportSelectedMotorEventsCsv() {
  if (!selectedMotor.value) return
  const rows = [
    ['Data', 'Motor', 'Tipo', 'Origem', 'Destino', 'Executado por', 'OS', 'Observações'],
    ...selectedMotorEventRows.value.map(({ event, order }) => [
      formatDate(event.eventDate || event.createdAt),
      selectedMotor.value.tag,
      motorEventLabel(event.eventType),
      event.fromDestination || '',
      event.toDestination || '',
      event.performedBy || '',
      order?.number ? `OS #${order.number}` : '',
      event.notes || '',
    ]),
  ]
  const csv = rows.map(row => row.map(csvCell).join(';')).join('\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `eventos-motor-${selectedMotor.value.tag}-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function workOrderSortKey(order) {
  return order.createdAt || `${order.requestDate || ''} ${order.requestTime || ''}`
}

function formatDate(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('pt-BR')
}

function formatDateTime(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function formatLocationPeriod(entry) {
  const start = entry.startDate ? formatDate(entry.startDate) : 'Inicio'
  const end = entry.endDate ? formatDate(entry.endDate) : 'Atual'
  return `${start} - ${end}`
}

function workOrderStatusLabel(order) {
  return order.maintenanceEndDate ? 'Finalizada' : 'Aberta'
}

function workOrderMotorEventLabel(order) {
  if (!order?.motorId) return ''
  if (order.motorEventLabel) return order.motorEventLabel === 'Enrolar' ? 'Enrolado' : order.motorEventLabel
  if (order.motorEventType) return motorEventLabel(order.motorEventType)
  const parts = String(order.title || '').split(' - ').map(part => part.trim()).filter(Boolean)
  const label = parts.length > 1 ? parts[parts.length - 1] : ''
  if (!label || label === order.motorName || label === order.motorTag) return ''
  return label === 'Enrolar' ? 'Enrolado' : label
}

function workOrderLocationLabel(order) {
  return order.maintenanceLocationName ||
    order.maintenanceDestinationName ||
    order.maintenanceExternalLocation ||
    order.destinationName ||
    '-'
}

function workOrderDateLabel(order) {
  if (order.requestDate && order.requestTime) return `${formatDate(order.requestDate)} ${order.requestTime}`
  return formatDate(order.requestDate || order.createdAt)
}

function workOrderEndLabel(order) {
  if (order.maintenanceEndDate && order.maintenanceEndTime) return `${formatDate(order.maintenanceEndDate)} ${order.maintenanceEndTime}`
  if (order.maintenanceEndDate) return formatDate(order.maintenanceEndDate)
  return 'Em aberto'
}

function workOrderStartLabel(order) {
  if (order.maintenanceStartDate && order.maintenanceStartTime) return `${formatDate(order.maintenanceStartDate)} ${order.maintenanceStartTime}`
  if (order.maintenanceStartDate) return formatDate(order.maintenanceStartDate)
  return '-'
}

function workOrderMaintenanceTypeLabel(order) {
  if (order.maintenanceLocationType === 'externa') return 'Externa'
  if (order.maintenanceLocationType === 'interna') return 'Interna'
  return '-'
}

function workOrderItemVariationLabel(item) {
  const parts = Object.entries(item.variationValues || {}).map(([key, value]) => `${key}: ${value}`)
  return parts.length ? parts.join(' - ') : '-'
}
</script>

<template>
  <div v-if="selectedMotor && materialsPanelOpen" class="ds-page-stack">
    <div class="ds-page-header">
      <div>
        <button
          type="button"
          class="mb-3 inline-flex min-h-9 items-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-800 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500/40 dark:border-white/[0.14] dark:bg-white/[0.06] dark:text-gray-100 dark:hover:bg-white/[0.10]"
          @click="materialsPanelOpen = false"
        >
          <span aria-hidden="true">←</span>
          Voltar ao motor
        </button>
        <p class="ds-page-kicker">Materiais do Motor</p>
        <h1 class="ds-page-title">{{ selectedMotor.tag }}</h1>
        <p class="ds-page-subtitle">Peças previstas para este motor e estoque atual no almoxarifado.</p>
      </div>
    </div>

    <section class="ds-panel overflow-visible">
      <div class="px-5 py-4 border-b border-gray-200 dark:border-white/[0.06] flex flex-wrap items-start justify-between gap-3 bg-gray-50/70 dark:bg-white/[0.02]">
        <div>
          <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Materiais vinculados</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ selectedMotorMaterials.length }} material{{ selectedMotorMaterials.length === 1 ? '' : 'is' }} cadastrado{{ selectedMotorMaterials.length === 1 ? '' : 's' }} para este motor.</p>
        </div>
        <span class="ds-chip">{{ selectedMotor.destinationName || 'Sem local' }}</span>
      </div>

      <div v-if="isLoggedIn" class="grid gap-3 border-b border-gray-100 bg-gray-50/70 p-4 dark:border-gray-700 dark:bg-gray-800/40 lg:grid-cols-[1fr_1fr_auto]">
        <div>
          <label class="ds-label">Material</label>
          <button
            type="button"
            class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm text-gray-900 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
            @click="openMotorMaterialSelector"
          >
            <span v-if="selectedMotorMaterialOption" class="block">
              <span class="block font-semibold">{{ selectedMotorMaterialOption.item.name }}</span>
              <AttributeBadges class="mt-1" :item="selectedMotorMaterialOption.item" :variation="selectedMotorMaterialOption.variation" compact />
            </span>
            <span v-else class="text-gray-500 dark:text-gray-400">Selecionar por blocos do catálogo...</span>
          </button>
          <div
            v-if="selectedMotorMaterialOption"
            class="mt-2 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-xs text-primary-700 dark:border-primary-800 dark:bg-primary-900/20 dark:text-primary-200"
          >
            <span class="font-semibold">Selecionado:</span> {{ materialOptionPath(selectedMotorMaterialOption) || selectedMotorMaterialOption.item.name }}
          </div>
        </div>
        <label>
          <span class="ds-label">Observação</span>
          <input v-model="motorMaterialNote" class="ds-input" placeholder="Ex: lado acoplado, tampa dianteira..." />
        </label>
        <div class="flex items-end">
          <AppButton variant="primary" :disabled="!motorMaterialVariationId" @click="addSelectedMotorMaterial">
            Vincular material
          </AppButton>
        </div>
      </div>

      <div v-if="selectedMotorMaterials.length" class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400">
              <th class="px-4 py-3 text-left font-semibold">Material</th>
              <th class="px-4 py-3 text-left font-semibold">Variação</th>
              <th class="px-4 py-3 text-center font-semibold">Estoque</th>
              <th class="px-4 py-3 text-center font-semibold">Mínimo</th>
              <th class="px-4 py-3 text-left font-semibold">Observação</th>
              <th v-if="isLoggedIn" class="px-4 py-3 text-right font-semibold">Ação</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
            <tr v-for="{ material, variation, item } in selectedMotorMaterials" :key="material.id" class="hover:bg-gray-50/70 dark:hover:bg-gray-800/40">
              <td class="px-4 py-3">
                <p class="font-medium text-gray-900 dark:text-gray-100">{{ item.name }}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">{{ item.group }} > {{ item.category }} > {{ item.subcategory }}</p>
              </td>
              <td class="px-4 py-3 text-gray-600 dark:text-gray-300">
                <AttributeBadges :item="item" :variation="variation" compact />
              </td>
              <td class="px-4 py-3 text-center">
                <span class="font-semibold" :class="variation.stock <= 0 ? 'text-red-500' : 'text-green-500'">{{ variation.stock }}</span>
                <span class="ml-1 text-xs text-gray-400">{{ item.unit }}</span>
              </td>
              <td class="px-4 py-3 text-center text-gray-700 dark:text-gray-300">{{ variation.minStock || '-' }}</td>
              <td class="px-4 py-3 text-gray-500 dark:text-gray-400">{{ material.note || '-' }}</td>
              <td v-if="isLoggedIn" class="px-4 py-3 text-right">
                <AppButton variant="danger" size="xs" @click="deleteMotorMaterial(material)">Remover</AppButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <EmptyState
        v-else
        title="Nenhum material vinculado."
        text="Vincule rolamentos, tampas, buchas ou outras peças cadastradas no catálogo."
      />

      <AppDialog
        v-if="motorMaterialSelectorOpen"
        visible
        aria-label="Selecionar material do catálogo"
        @close="motorMaterialSelectorOpen = false"
      >
        <section class="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
          <header class="flex flex-wrap items-start justify-between gap-3 border-b border-gray-200 p-4 dark:border-gray-700">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Materiais do Motor</p>
              <h3 class="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">Selecionar material do catálogo</h3>
            </div>
            <AppButton variant="ghost" size="sm" @click="motorMaterialSelectorOpen = false">Fechar</AppButton>
          </header>

          <div class="border-b border-gray-200 p-4 dark:border-gray-700">
            <input
              v-model="motorMaterialSearch"
              type="search"
              placeholder="Buscar por nome, caminho, atributo ou local..."
              class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>

          <div class="min-h-0 flex-1 overflow-auto p-4">
            <div v-if="motorMaterialSearch.trim()" class="space-y-2">
              <button
                v-for="row in motorMaterialOptions.slice(0, 40)"
                :key="row.variation.id"
                type="button"
                class="flex w-full items-start justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-left transition-colors hover:border-primary-400 hover:bg-primary-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-primary-500 dark:hover:bg-primary-950/20"
                @click="selectMotorMaterial(row)"
              >
                <span class="min-w-0">
                  <span class="block text-sm font-semibold text-gray-900 dark:text-gray-100">{{ row.item.name }}</span>
                  <span class="block text-xs text-gray-500 dark:text-gray-400">{{ materialOptionPath(row) || 'Sem hierarquia' }}</span>
                  <AttributeBadges class="mt-2" :item="row.item" :variation="row.variation" compact />
                </span>
                <span class="shrink-0 text-right text-xs text-gray-500 dark:text-gray-400">
                  <span class="block font-semibold" :class="row.variation.stock <= 0 ? 'text-red-500' : 'text-green-500'">{{ row.variation.stock }} {{ row.item.unit }}</span>
                  <span>min. {{ row.variation.minStock || '-' }}</span>
                </span>
              </button>
              <p v-if="!motorMaterialOptions.length" class="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                Nenhum material encontrado ou todas as variações encontradas já estão vinculadas.
              </p>
            </div>

            <div v-else class="space-y-4">
              <div v-if="motorMaterialGroup" class="flex flex-wrap items-center gap-1.5 text-sm">
                <button type="button" class="font-medium text-primary-600 hover:underline dark:text-primary-400" @click="resetMotorMaterialPath('root')">Catálogo</button>
                <svg class="h-3.5 w-3.5 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                <button
                  v-if="motorMaterialCategory"
                  type="button"
                  class="font-medium text-primary-600 hover:underline dark:text-primary-400"
                  @click="resetMotorMaterialPath('group')"
                >{{ motorMaterialGroup }}</button>
                <span v-else class="font-semibold text-gray-900 dark:text-gray-100">{{ motorMaterialGroup }}</span>
                <template v-if="motorMaterialCategory">
                  <svg class="h-3.5 w-3.5 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                  <button
                    v-if="motorMaterialSubcategory || motorMaterialItemId"
                    type="button"
                    class="font-medium text-primary-600 hover:underline dark:text-primary-400"
                    @click="resetMotorMaterialPath('category')"
                  >{{ motorMaterialCategory }}</button>
                  <span v-else class="font-semibold text-gray-900 dark:text-gray-100">{{ motorMaterialCategory }}</span>
                </template>
                <template v-if="motorMaterialSubcategory">
                  <svg class="h-3.5 w-3.5 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                  <button
                    v-if="motorMaterialItemId"
                    type="button"
                    class="font-medium text-primary-600 hover:underline dark:text-primary-400"
                    @click="resetMotorMaterialPath('subcategory')"
                  >{{ motorMaterialSubcategory }}</button>
                  <span v-else class="font-semibold text-gray-900 dark:text-gray-100">{{ motorMaterialSubcategory }}</span>
                </template>
              </div>

              <div v-if="!motorMaterialGroup" class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                <button
                  v-for="group in motorMaterialGroups"
                  :key="group"
                  type="button"
                  class="group cursor-pointer rounded-lg border border-gray-200 bg-white p-5 text-left transition-all hover:border-primary-400 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-primary-500"
                  @click="selectMotorMaterialGroup(group)"
                >
                  <div class="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 transition-colors group-hover:bg-primary-100 dark:bg-primary-900/30 dark:group-hover:bg-primary-900/50">
                    <svg class="h-5 w-5 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
                    </svg>
                  </div>
                  <p class="mb-1 truncate text-sm font-bold text-gray-800 dark:text-gray-100">{{ group }}</p>
                  <p class="text-xs text-gray-400 dark:text-gray-500">
                    {{ motorMaterialRowsForGroup(group).length }} var. · Estoque: {{ motorMaterialStockTotal(motorMaterialRowsForGroup(group)) }}
                  </p>
                </button>
              </div>

              <div v-else-if="!motorMaterialCategory" class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                <button
                  v-for="category in motorMaterialCategories"
                  :key="category"
                  type="button"
                  class="group cursor-pointer rounded-lg border border-gray-200 bg-white p-5 text-left transition-all hover:border-primary-400 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-primary-500"
                  @click="selectMotorMaterialCategory(category)"
                >
                  <p class="mb-1 truncate text-sm font-bold text-gray-800 dark:text-gray-100">{{ category }}</p>
                  <p class="text-xs text-gray-400 dark:text-gray-500">
                    {{ motorMaterialRowsForCategory(category).length }} var. · Estoque: {{ motorMaterialStockTotal(motorMaterialRowsForCategory(category)) }}
                  </p>
                </button>
              </div>

              <div v-else-if="motorMaterialSubcategories.length && !motorMaterialSubcategory" class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                <button
                  v-for="subcategory in motorMaterialSubcategories"
                  :key="subcategory"
                  type="button"
                  class="group cursor-pointer rounded-lg border border-gray-200 bg-white p-5 text-left transition-all hover:border-primary-400 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-primary-500"
                  @click="selectMotorMaterialSubcategory(subcategory)"
                >
                  <p class="mb-1 truncate text-sm font-bold text-gray-800 dark:text-gray-100">{{ subcategory }}</p>
                  <p class="text-xs text-gray-400 dark:text-gray-500">
                    {{ motorMaterialRowsForSubcategory(subcategory).length }} var. · Estoque: {{ motorMaterialStockTotal(motorMaterialRowsForSubcategory(subcategory)) }}
                  </p>
                </button>
              </div>

              <div v-else-if="!motorMaterialItemId" class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                <button
                  v-for="item in motorMaterialItems"
                  :key="item.id"
                  type="button"
                  class="group cursor-pointer rounded-lg border border-gray-200 bg-white p-4 text-left transition-all hover:border-primary-400 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-primary-500"
                  @click="motorMaterialItemId = item.id"
                >
                  <p class="mb-1 truncate text-sm font-semibold text-gray-800 dark:text-gray-100">{{ item.name }}</p>
                  <p class="mb-1 truncate text-xs text-gray-400 dark:text-gray-500">{{ [item.group, item.category, item.subcategory].filter(Boolean).join(' > ') || 'Sem hierarquia' }}</p>
                  <p class="text-xs text-gray-400 dark:text-gray-500">
                    {{ availableMotorMaterialRows.filter(row => row.item.id === item.id).length }} var. · Estoque: {{ motorMaterialItemStock(item) }}
                  </p>
                </button>
              </div>

              <div v-else>
                <div v-if="motorMaterialItemVariations.length" class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                  <table class="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
                    <thead class="bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-800/70 dark:text-gray-400">
                      <tr>
                        <th class="px-4 py-3">Variação</th>
                        <th class="px-4 py-3 text-right">Estoque</th>
                        <th class="px-4 py-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-900">
                      <tr
                        v-for="row in motorMaterialItemVariations"
                        :key="row.variation.id"
                        class="cursor-pointer transition-colors hover:bg-primary-50/70 dark:hover:bg-primary-950/20"
                        @click="selectMotorMaterial(row)"
                      >
                        <td class="px-4 py-3 text-gray-900 dark:text-gray-100">
                          <p class="font-semibold">{{ row.item.name }}</p>
                          <AttributeBadges class="mt-1" :item="row.item" :variation="row.variation" compact />
                        </td>
                        <td class="px-4 py-3 text-right font-semibold" :class="row.variation.stock <= 0 ? 'text-red-500' : 'text-green-500'">
                          {{ row.variation.stock }} {{ row.item.unit }}
                        </td>
                        <td class="px-4 py-3 text-right">
                          <AppButton variant="primary" size="xs" @click.stop="selectMotorMaterial(row)">Selecionar</AppButton>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p v-else class="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  Nenhuma variação disponível para este item.
                </p>
              </div>
            </div>
          </div>
        </section>
      </AppDialog>
    </section>
  </div>

  <div v-else class="ds-page-stack">
    <div class="ds-page-header">
      <div>
        <p class="ds-page-kicker">Ativos físicos</p>
        <h1 class="ds-page-title">Motores</h1>
        <p class="ds-page-subtitle">Ficha técnica, localização atual e históricos de OS por motor.</p>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 min-w-full sm:min-w-[36rem]">
        <div class="ds-metric">
          <p class="ds-metric-label">Total</p>
          <p class="ds-metric-value">{{ motorStats.total }}</p>
        </div>
        <div class="ds-metric">
          <p class="ds-metric-label">Ativos</p>
          <p class="ds-metric-value">{{ motorStats.active }}</p>
        </div>
        <div class="ds-metric">
          <p class="ds-metric-label">Manutenção</p>
          <p class="ds-metric-value">{{ motorStats.maintenance }}</p>
        </div>
        <div class="ds-metric">
          <p class="ds-metric-label">Reserva</p>
          <p class="ds-metric-value">{{ motorStats.reserve }}</p>
        </div>
        <div class="ds-metric">
          <p class="ds-metric-label">Inativos</p>
          <p class="ds-metric-value">{{ motorStats.inactive }}</p>
        </div>
      </div>
    </div>

    <div class="ds-segmented">
      <button
        type="button"
        class="ds-segmented-item"
        :class="motorViewMode === 'motores' ? 'ds-segmented-item-active' : ''"
        @click="setMotorViewMode('motores')"
      >
        Motores
      </button>
      <button
        type="button"
        class="ds-segmented-item"
        :class="motorViewMode === 'catalogo' ? 'ds-segmented-item-active' : ''"
        @click="setMotorViewMode('catalogo')"
      >
        Consultar motores
      </button>
      <button
        type="button"
        class="ds-segmented-item"
        :class="motorViewMode === 'linha' ? 'ds-segmented-item-active' : ''"
        @click="setMotorViewMode('linha')"
      >
        Ordens de Serviço
      </button>
    </div>

    <div v-if="motorViewMode === 'linha'" class="ds-panel p-4">
      <OrdensServicoView
        :key="osRouteKey"
        mode="motor"
        embedded
        :prefill-motor="osPrefillMotor"
        :initial-motor-id="osMotorFilterId"
        :initial-tab="osActiveTab"
        :initial-status="osInitialStatus"
        :focus-order-id="osFocusOrderId"
        @prefill-consumed="osPrefillMotor = null"
        @created="showMotorOrders"
      />
    </div>

    <div v-else-if="motorViewMode === 'catalogo'" class="space-y-4">
      <div class="ds-panel p-4 space-y-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Catálogo por destino</h2>
            <p class="text-sm text-gray-500 dark:text-gray-400">Encontre o local e abra a ficha do motor.</p>
          </div>
          <div class="flex items-center gap-2">
            <AppButton v-if="isLoggedIn" variant="primary" size="sm" @click="startNewMotor">Cadastrar motor</AppButton>
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-[150px_minmax(240px,1fr)] gap-2">
          <select v-model="searchScope" class="ds-input">
            <option v-for="scope in motorSearchScopes" :key="scope.id" :value="scope.id">{{ scope.label }}</option>
          </select>
          <input
            v-model="search"
            type="search"
            placeholder="Buscar motores..."
            class="ds-input"
          />
        </div>
      </div>

      <div v-if="motorCatalogTree.length" class="flex flex-wrap items-center gap-1.5 text-sm">
        <button
          type="button"
          class="font-medium text-primary-600 hover:underline dark:text-primary-400"
          @click="goToMotorCatalogLevel(-1)"
        >Destinos</button>
        <template v-for="(node, index) in motorCatalogBreadcrumb" :key="node.id">
          <svg class="h-3.5 w-3.5 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
          <button
            type="button"
            class="font-medium"
            :class="index === motorCatalogBreadcrumb.length - 1 ? 'text-gray-900 dark:text-gray-100' : 'text-primary-600 hover:underline dark:text-primary-400'"
            @click="goToMotorCatalogLevel(index)"
          >{{ node.name }}</button>
        </template>
      </div>

      <div v-if="motorCatalogDestinationCards.length" class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <button
          v-for="node in motorCatalogDestinationCards"
          :key="node.id"
          type="button"
          class="ds-panel p-5 text-left transition-colors hover:border-primary-400 hover:bg-primary-50/40 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:hover:border-primary-500 dark:hover:bg-primary-950/20"
          @click="openMotorCatalogDestination(node)"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="ds-page-kicker">Destino</p>
              <h3 class="mt-1 truncate text-lg font-semibold text-gray-900 dark:text-gray-100">{{ node.name }}</h3>
            </div>
          </div>
          <p class="mt-4 text-xs text-gray-500 dark:text-gray-400">
            {{ node.children.length ? `${node.children.length} sub-destino${node.children.length !== 1 ? 's' : ''}` : 'Ver motores' }}
          </p>
        </button>
      </div>

      <div v-if="motorCatalogMotorCards.length" class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <button
          v-for="motor in motorCatalogMotorCards"
          :key="motor.id"
          type="button"
          class="ds-panel p-4 text-left transition-colors hover:border-primary-400 hover:bg-primary-50/40 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:hover:border-primary-500 dark:hover:bg-primary-950/20"
          @click="selectMotor(motor)"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="ds-page-kicker">Motor</p>
              <h3 class="mt-1 truncate text-lg font-semibold text-gray-900 dark:text-gray-100">{{ motor.tag }}</h3>
              <p class="mt-0.5 truncate text-sm text-gray-500 dark:text-gray-400">{{ motor.name || motor.manufacturer || 'Sem descrição' }}</p>
            </div>
            <StatusBadge domain="motor" :status="motor.status" :label="motorStatusLabel(motor.status)" />
          </div>
          <div class="mt-3 flex flex-wrap gap-1.5">
            <span v-if="motor.serial" class="ds-chip">Série {{ motor.serial }}</span>
            <span v-if="motor.manufacturer" class="ds-chip">{{ motor.manufacturer }}</span>
            <span v-if="motor.power" class="ds-chip">{{ motor.power }}</span>
            <span v-if="motor.voltage" class="ds-chip">{{ motor.voltage }}</span>
            <span v-if="motor.rpm" class="ds-chip">{{ motor.rpm }}</span>
            <span v-if="motor.amperage" class="ds-chip">{{ motor.amperage }}</span>
          </div>
          <p class="mt-4 text-xs font-semibold text-primary-600 dark:text-primary-400">Abrir ficha</p>
        </button>
      </div>

      <EmptyState
        v-if="!motorCatalogTree.length"
        title="Nenhum motor encontrado."
        text="Ajuste a busca ou cadastre um novo motor."
      />
    </div>

    <div v-else class="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-5">
    <aside class="space-y-3">
      <div class="ds-toolbar justify-between">
        <div>
          <h2 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Lista de motores</h2>
          <p class="text-xs text-gray-400 dark:text-gray-500">{{ filteredMotors.length }} de {{ motors.length }} motor{{ motors.length !== 1 ? 'es' : '' }}</p>
        </div>
        <AppButton
          v-if="isLoggedIn"
          variant="primary"
          size="sm"
          @click="startNewMotor"
        >Cadastrar motor</AppButton>
      </div>

      <div class="ds-toolbar grid grid-cols-1 gap-2">
        <input
          v-model="search"
          type="text"
          placeholder="Buscar numero do motor..."
          class="ds-input"
        />
      </div>

      <div class="ds-toolbar flex-wrap gap-1.5">
        <span class="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mr-1">Ordenar</span>
        <div class="ds-segmented flex-wrap">
          <button
            v-for="option in [
              { key: 'tag', label: 'Tag' },
              { key: 'name', label: 'Nome' },
              { key: 'destination', label: 'Local' },
              { key: 'status', label: 'Status' },
            ]"
            :key="option.key"
            type="button"
            class="ds-segmented-item"
            :class="{ 'ds-segmented-item-active': motorSortKey === option.key }"
            @click="setMotorSort(option.key)"
          >
            {{ option.label }} {{ motorSortArrow(option.key) }}
          </button>
        </div>
      </div>

      <div class="ds-list-panel">
        <button
          v-for="motor in paginatedMotors"
          :key="motor.id"
          class="ds-list-row text-left px-4 py-3 cursor-pointer"
          :class="selectedMotor?.id === motor.id ? 'ds-list-row-active' : ''"
          @click="selectMotor(motor)"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="font-semibold text-sm text-gray-900 dark:text-gray-100">{{ motor.tag }}</span>
            <StatusBadge domain="motor" :status="motor.status" :label="motorStatusLabel(motor.status)" />
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400 truncate">{{ motor.name || motor.manufacturer || 'Sem descrição' }}</p>
          <p class="text-[11px] text-gray-400 dark:text-gray-500 truncate">{{ motor.destinationName || 'Sem local' }}</p>
        </button>
        <EmptyState
          v-if="!filteredMotors.length"
          title="Nenhum motor encontrado."
          text="Ajuste os filtros ou cadastre um novo motor."
        />
        <div
          v-if="filteredMotors.length > MOTOR_PAGE_SIZE"
          class="px-3 py-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between gap-2"
        >
          <AppButton
            variant="ghost"
            size="xs"
            :disabled="motorPage <= 1"
            @click="motorPage--"
          >
            Anterior
          </AppButton>
          <span class="text-xs text-gray-400 dark:text-gray-500">{{ motorPage }} / {{ motorTotalPages }}</span>
          <AppButton
            variant="ghost"
            size="xs"
            :disabled="motorPage >= motorTotalPages"
            @click="motorPage++"
          >
            Próxima
          </AppButton>
        </div>
      </div>
    </aside>

    <section class="space-y-4">
      <div v-if="isLoggedIn && showForm" class="ds-panel p-4 space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ editingMotorId ? 'Editar motor' : 'Novo motor' }}</h3>
          <AppButton variant="ghost" size="xs" :disabled="motorSaving" @click="cancelMotorForm">Cancelar</AppButton>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            v-model="motorForm.tag"
            placeholder="Tag/patrimônio *"
            class="ds-input"
            :class="visibleMotorFormBlockReason ? 'border-amber-400 focus:border-amber-500 focus:ring-amber-500 dark:border-amber-700' : ''"
            @input="confirmCreateMotor = false"
          />
          <input v-model="motorForm.serial" placeholder="Série" class="ds-input" />
          <input v-model="motorForm.name" placeholder="Descrição/nome" class="ds-input" />
          <input v-model="motorForm.manufacturer" placeholder="Fabricante" class="ds-input" />
          <div class="flex overflow-hidden rounded-lg border border-gray-300 bg-white focus-within:border-primary-400 dark:border-gray-600 dark:bg-gray-800">
            <input v-model="motorForm.power" placeholder="Potencia" class="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-gray-900 outline-none placeholder-gray-400 dark:text-gray-100" />
            <select v-model="motorForm.powerUnit" class="border-l border-gray-200 bg-gray-50 px-2 text-sm font-semibold text-gray-700 outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
              <option v-for="unit in motorPowerUnits" :key="unit" :value="unit">{{ unit }}</option>
            </select>
          </div>
          <input v-model="motorForm.voltage" placeholder="Tensao (V)" class="ds-input" />
          <input v-model="motorForm.rpm" placeholder="Rotacao (RPM)" class="ds-input" />
          <input v-model="motorForm.amperage" placeholder="Amperagem (A)" class="ds-input" />
          <DestinationTreePicker
            v-if="!editingMotorId"
            v-model="motorForm.destinationId"
            placeholder="Buscar local do motor..."
          />
          <div v-else class="ds-input bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
            {{ selectedMotor?.destinationName || 'Sem local' }}
          </div>
          <select v-model="motorForm.status" class="ds-input">
            <option v-for="s in MOTOR_STATUSES" :key="s.id" :value="s.id">{{ s.label }}</option>
          </select>
        </div>
        <textarea v-model="motorForm.notes" rows="2" placeholder="Observações" class="ds-input"></textarea>
        <p v-if="visibleMotorFormBlockReason" class="text-xs text-amber-600 dark:text-amber-400">{{ visibleMotorFormBlockReason }}</p>
        <div class="flex justify-end">
          <ConfirmInline
            v-if="!editingMotorId && confirmCreateMotor"
            message="Criar este motor?"
            confirm-label="Sim"
            cancel-label="Não"
            @confirm="saveMotor"
            @cancel="confirmCreateMotor = false"
          />
          <AppButton
            v-else
            variant="primary"
            :disabled="motorSaving"
            :loading="motorSaving"
            @click="editingMotorId ? saveMotor() : requestCreateMotor()"
          >
            {{ editingMotorId ? 'Salvar' : 'Criar motor' }}
          </AppButton>
        </div>
      </div>

      <div v-if="selectedMotor" class="ds-panel overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-200 dark:border-white/[0.06] flex flex-wrap items-start justify-between gap-3 bg-gray-50/70 dark:bg-white/[0.02]">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">{{ selectedMotor.tag }}</h2>
              <StatusBadge domain="motor" :status="selectedMotor.status" :label="motorStatusLabel(selectedMotor.status)" />
            </div>
            <p class="text-sm text-gray-500 dark:text-gray-400">{{ selectedMotor.name || selectedMotor.manufacturer || 'Motor sem descrição' }}</p>
            <div class="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                class="inline-flex min-h-9 items-center gap-2 rounded-md border border-gray-200 px-3 text-xs font-semibold text-gray-700 transition-colors hover:border-primary-400 hover:text-primary-700 dark:border-gray-700 dark:text-gray-300 dark:hover:border-primary-500 dark:hover:text-primary-300"
                @click="showMotorMaterials"
              >
                Materiais
                <span class="text-gray-400 dark:text-gray-500">{{ selectedMotorMaterials.length }}</span>
              </button>
              <button
                type="button"
                class="inline-flex min-h-9 items-center gap-2 rounded-md border border-gray-200 px-3 text-xs font-semibold text-gray-700 transition-colors hover:border-primary-400 hover:text-primary-700 dark:border-gray-700 dark:text-gray-300 dark:hover:border-primary-500 dark:hover:text-primary-300"
                @click="showFinishedMotorOrders"
              >
                OS Finalizadas
                <span class="text-gray-400 dark:text-gray-500">{{ selectedFinishedWorkOrders.length }}</span>
              </button>
            </div>
          </div>
          <div class="flex flex-wrap items-center justify-end gap-2">
            <AppButton v-if="isLoggedIn" variant="primary" size="sm" @click="createWorkOrderForMotor">Abrir OS</AppButton>
            <AppButton v-if="isLoggedIn" variant="secondary" size="sm" @click="registerWorkOrderForMotor">Registrar OS</AppButton>
            <AppButton v-if="isLoggedIn" variant="secondary" size="sm" @click="startEditMotor(selectedMotor)">Editar</AppButton>
            <AppButton
              v-if="isLoggedIn && confirmDeleteMotorId !== selectedMotor.id"
              variant="danger"
              size="sm"
              @click="confirmDeleteMotorId = selectedMotor.id"
            >Excluir</AppButton>
            <ConfirmInline
              v-else-if="isLoggedIn"
              message="Excluir este motor?"
              @confirm="deleteSelectedMotor"
              @cancel="confirmDeleteMotorId = null"
            />
          </div>
        </div>

        <div class="p-5 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
          <div class="space-y-4">
            <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div class="ds-surface p-3"><p class="text-xs text-gray-400">Série</p><p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ selectedMotor.serial || '-' }}</p></div>
              <div class="ds-surface p-3"><p class="text-xs text-gray-400">Potência</p><p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ selectedMotor.power || '-' }}</p></div>
              <div class="ds-surface p-3"><p class="text-xs text-gray-400">Tensão</p><p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ selectedMotor.voltage || '-' }}</p></div>
              <div class="ds-surface p-3"><p class="text-xs text-gray-400">RPM</p><p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ selectedMotor.rpm || '-' }}</p></div>
              <div class="ds-surface p-3"><p class="text-xs text-gray-400">Amperagem</p><p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ selectedMotor.amperage || '-' }}</p></div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                class="ds-surface p-3 text-left hover:border-primary-400 dark:hover:border-primary-500 transition-colors"
                @click="eventSummaryOpen = true"
              >
                <p class="text-xs text-gray-400">Eventos</p>
                <div class="mt-2 flex items-end justify-between gap-3">
                  <div>
                    <p class="text-2xl font-semibold text-gray-900 dark:text-gray-100">{{ selectedMotorEventTotal }}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">eventos contabilizados</p>
                  </div>
                  <span class="text-xs font-semibold text-primary-600 dark:text-primary-400">Ver todos</span>
                </div>
              </button>
              <button
                type="button"
                class="ds-surface p-3 text-left hover:border-primary-400 dark:hover:border-primary-500 transition-colors"
                @click="locationTrailOpen = true"
              >
                <p class="text-xs text-gray-400">Lugares por onde passou</p>
                <div class="mt-2">
                  <p class="text-2xl font-semibold text-gray-900 dark:text-gray-100">{{ selectedMotorLocationTrail.length }}</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">{{ selectedMotorLocationTrail.length === 1 ? 'período de local' : 'períodos de local' }}</p>
                </div>
              </button>
            </div>

            <div>
              <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 class="ds-section-heading">OS abertas do motor</h3>
              </div>
              <div class="rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden">
                <div
                  v-for="wo in selectedOpenWorkOrders"
                  :key="wo.id"
                  class="w-full px-4 py-3 text-left"
                >
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="text-xs font-bold px-2 py-0.5 rounded bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-400">OS #{{ wo.number }}</span>
                      <span class="text-xs font-semibold px-2 py-0.5 rounded" :class="wo.maintenanceEndDate ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'">{{ workOrderStatusLabel(wo) }}</span>
                      <span v-if="workOrderMotorEventLabel(wo)" class="text-xs font-semibold px-2 py-0.5 rounded bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300">
                        {{ workOrderMotorEventLabel(wo) }}
                      </span>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-xs text-gray-400">{{ workOrderDateLabel(wo) }}</span>
                      <AppButton variant="secondary" size="xs" @click="showMotorOrders(wo)">Abrir a OS</AppButton>
                    </div>
                  </div>
                  <p class="mt-1 text-sm text-gray-700 dark:text-gray-300">{{ wo.title || wo.maintenanceNote || wo.note || 'OS sem observação' }}</p>
                  <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Local/oficina: {{ workOrderLocationLabel(wo) }} - Término: {{ workOrderEndLabel(wo) }}</p>
                </div>
                <EmptyState
                  v-if="!selectedOpenWorkOrders.length"
                  title="Nenhuma OS aberta."
                  text="Use Abrir OS para iniciar uma manutenção deste motor."
                />
              </div>
            </div>
          </div>

          <aside class="space-y-3">
            <div class="ds-surface p-4">
              <p class="text-xs text-gray-400">Local atual</p>
              <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ selectedMotor.destinationName || 'Sem local' }}</p>
            </div>
            <div class="ds-surface p-4">
              <p class="text-xs text-gray-400">Fabricante</p>
              <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ selectedMotor.manufacturer || '-' }}</p>
            </div>
            <div class="ds-surface p-4">
              <p class="text-xs text-gray-400">Observações</p>
              <p class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{{ selectedMotor.notes || '-' }}</p>
            </div>
          </aside>
        </div>
      </div>

    </section>
    </div>

  </div>

  <AppDialog
    v-if="selectedMotor && eventSummaryOpen"
    visible
    aria-label="Eventos contabilizados do motor"
    @close="eventSummaryOpen = false"
  >
    <div class="ds-panel w-full max-w-3xl overflow-hidden">
      <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
        <div>
          <p class="ds-page-kicker">Motor {{ selectedMotor.tag }}</p>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Eventos contabilizados</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ selectedMotorEventTotal }} evento{{ selectedMotorEventTotal === 1 ? '' : 's' }} no histórico deste motor.</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <AppButton variant="secondary" size="sm" :disabled="!selectedMotorEventRows.length" @click="exportSelectedMotorEventsCsv">Exportar CSV</AppButton>
          <AppButton variant="ghost" size="sm" @click="eventSummaryOpen = false">Fechar</AppButton>
        </div>
      </div>
      <div class="grid gap-4 p-5 lg:grid-cols-[1fr_1.1fr]">
        <div class="grid gap-2 sm:grid-cols-2">
          <button
            v-for="row in selectedMotorEventSummary"
            :key="row.id"
            type="button"
            class="rounded-lg border px-4 py-3 text-left transition-colors"
            :class="[
              row.count ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/70 opacity-70 dark:bg-gray-800/40',
              selectedEventSummaryType === row.id
                ? 'border-primary-500 bg-primary-50 dark:border-primary-500 dark:bg-primary-900/20'
                : 'border-gray-200 dark:border-gray-700'
            ]"
            @click="selectedEventSummaryType = row.id"
          >
            <p class="text-xs font-semibold uppercase tracking-wider text-gray-400">{{ row.label }}</p>
            <p class="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">{{ row.count }}</p>
            <p v-if="row.grouped" class="mt-1 text-xs text-gray-500 dark:text-gray-400">Conta Enrolado junto.</p>
          </button>
        </div>

        <div class="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
            <p class="text-xs font-semibold uppercase tracking-wider text-gray-400">Datas do evento</p>
            <p class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ selectedEventSummary?.label || 'Evento' }}</p>
          </div>
          <div v-if="selectedEventDateRows.length" class="max-h-80 space-y-2 overflow-auto p-3">
            <div
              v-for="{ event, order } in selectedEventDateRows"
              :key="event.id"
              class="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900"
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="min-w-0">
                  <p class="text-xs font-semibold uppercase tracking-wider text-gray-400">{{ formatDate(event.eventDate || event.createdAt) }}</p>
                  <p class="mt-0.5 text-sm font-semibold text-gray-900 dark:text-gray-100">{{ order?.number ? `OS #${order.number}` : 'Evento sem OS' }}</p>
                </div>
                <button
                  v-if="order?.number"
                  type="button"
                  class="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-700 transition-colors hover:border-primary-400 hover:text-primary-700 dark:border-gray-700 dark:text-gray-300 dark:hover:border-primary-500 dark:hover:text-primary-300"
                  @click="openWorkOrderPreview(order)"
                >
                  Ver OS
                </button>
              </div>
              <p v-if="order" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Solicitação: {{ workOrderDateLabel(order) }} · Término: {{ workOrderEndLabel(order) }}
              </p>
              <p v-if="event.toDestination || event.fromDestination" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {{ [event.fromDestination, event.toDestination].filter(Boolean).join(' -> ') }}
              </p>
              <p v-if="event.performedBy" class="mt-1 text-xs text-gray-500 dark:text-gray-400">Por: {{ event.performedBy }}</p>
              <p v-if="event.notes" class="mt-1 text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{{ event.notes }}</p>
            </div>
          </div>
          <p v-else class="p-4 text-sm text-gray-500 dark:text-gray-400">Nenhuma data registrada para este evento.</p>
        </div>
      </div>
    </div>
  </AppDialog>

  <AppDialog
    v-if="workOrderPreview"
    visible
    aria-label="Visualizador de ordem de serviço"
    @close="workOrderPreview = null"
  >
    <div class="ds-panel w-full max-w-4xl overflow-hidden">
      <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="ds-page-kicker">Visualizador de OS</p>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">OS #{{ workOrderPreview.number }}</h3>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ workOrderPreview.title || '-' }}</p>
          <div class="mt-2 flex flex-wrap items-center gap-2">
            <span class="text-xs font-semibold px-2 py-0.5 rounded" :class="workOrderPreview.maintenanceEndDate ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'">{{ workOrderStatusLabel(workOrderPreview) }}</span>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <AppButton variant="secondary" size="sm" @click="showMotorOrders(workOrderPreview); workOrderPreview = null">Abrir na OS de motor</AppButton>
          <AppButton variant="ghost" size="sm" @click="workOrderPreview = null">Fechar</AppButton>
        </div>
      </div>
      <div class="max-h-[72vh] overflow-auto p-5">
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div class="ds-surface p-3">
            <p class="text-xs text-gray-400">Solicitação</p>
            <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ workOrderDateLabel(workOrderPreview) }}</p>
          </div>
          <div class="ds-surface p-3">
            <p class="text-xs text-gray-400">Início</p>
            <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ workOrderStartLabel(workOrderPreview) }}</p>
          </div>
          <div class="ds-surface p-3">
            <p class="text-xs text-gray-400">Término</p>
            <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ workOrderEndLabel(workOrderPreview) }}</p>
          </div>
          <div class="ds-surface p-3">
            <p class="text-xs text-gray-400">Local/oficina</p>
            <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ workOrderLocationLabel(workOrderPreview) }}</p>
          </div>
        </div>

        <div class="mt-5 grid gap-5 lg:grid-cols-[1fr_19rem]">
          <div class="space-y-5">
            <section class="space-y-2">
              <h4 class="ds-section-heading">Observações</h4>
              <div class="rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden">
                <div class="px-3 py-2">
                  <p class="text-xs text-gray-400">Solicitação</p>
                  <p class="mt-1 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">{{ workOrderPreview.note || '-' }}</p>
                </div>
                <div class="px-3 py-2">
                  <p class="text-xs text-gray-400">Execução</p>
                  <p class="mt-1 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">{{ workOrderPreview.maintenanceNote || '-' }}</p>
                </div>
                <div class="px-3 py-2">
                  <p class="text-xs text-gray-400">Materiais adicionais</p>
                  <p class="mt-1 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">{{ workOrderPreview.maintenanceMaterials || '-' }}</p>
                </div>
                <div class="px-3 py-2">
                  <p class="text-xs text-gray-400">Evento do motor</p>
                  <p class="mt-1 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">{{ workOrderPreview.motorEventNotes || '-' }}</p>
                </div>
              </div>
            </section>

            <section v-if="(workOrderPreview.items || []).length" class="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div class="border-b border-gray-200 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:border-gray-700">Materiais vinculados</div>
              <div class="divide-y divide-gray-100 dark:divide-gray-800">
                <div v-for="mat in workOrderPreview.items" :key="mat.id" class="grid gap-1 px-3 py-2 text-sm sm:grid-cols-[1fr_auto]">
                  <div>
                    <p class="font-medium text-gray-900 dark:text-gray-100">{{ mat.itemName }}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">{{ [mat.itemGroup, mat.itemCategory].filter(Boolean).join(' / ') || '-' }}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">Variação: {{ workOrderItemVariationLabel(mat) }}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">Movimento: {{ mat.movementId || '-' }} · Adicionado: {{ formatDateTime(mat.addedAt) }}</p>
                  </div>
                  <p class="font-semibold text-gray-900 dark:text-gray-100">{{ mat.qty }} {{ mat.itemUnit }}</p>
                </div>
              </div>
            </section>
            <p v-else class="rounded-lg border border-dashed border-gray-200 p-3 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">Nenhum material vinculado.</p>
          </div>

          <aside class="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div class="border-b border-gray-200 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:border-gray-700">Ficha completa</div>
            <dl class="divide-y divide-gray-100 text-sm dark:divide-gray-800">
              <div class="grid grid-cols-[7.5rem_1fr] gap-3 px-3 py-2"><dt class="text-gray-400">Criada em</dt><dd class="text-gray-800 dark:text-gray-200">{{ formatDateTime(workOrderPreview.createdAt) }}</dd></div>
              <div class="grid grid-cols-[7.5rem_1fr] gap-3 px-3 py-2"><dt class="text-gray-400">Solicitante</dt><dd class="text-gray-800 dark:text-gray-200">{{ workOrderPreview.requestedBy || '-' }}</dd></div>
              <div v-if="!workOrderPreview.motorId" class="grid grid-cols-[7.5rem_1fr] gap-3 px-3 py-2"><dt class="text-gray-400">Equipamento</dt><dd class="text-gray-800 dark:text-gray-200">{{ workOrderPreview.equipment || '-' }}</dd></div>
              <div class="grid grid-cols-[7.5rem_1fr] gap-3 px-3 py-2"><dt class="text-gray-400">Destino</dt><dd class="text-gray-800 dark:text-gray-200">{{ workOrderPreview.destinationName || '-' }}</dd></div>
              <div class="grid grid-cols-[7.5rem_1fr] gap-3 px-3 py-2"><dt class="text-gray-400">Motor</dt><dd class="text-gray-800 dark:text-gray-200">{{ [workOrderPreview.motorTag, workOrderPreview.motorName].filter(Boolean).join(' - ') || '-' }}</dd></div>
              <div class="grid grid-cols-[7.5rem_1fr] gap-3 px-3 py-2"><dt class="text-gray-400">Status motor</dt><dd class="text-gray-800 dark:text-gray-200">{{ workOrderPreview.motorStatus ? motorStatusLabel(workOrderPreview.motorStatus) : '-' }}</dd></div>
              <div class="grid grid-cols-[7.5rem_1fr] gap-3 px-3 py-2"><dt class="text-gray-400">Origem</dt><dd class="text-gray-800 dark:text-gray-200">{{ workOrderPreview.motorOriginDestinationName || '-' }}</dd></div>
              <div class="grid grid-cols-[7.5rem_1fr] gap-3 px-3 py-2"><dt class="text-gray-400">Execução</dt><dd class="text-gray-800 dark:text-gray-200">{{ workOrderMaintenanceTypeLabel(workOrderPreview) }}</dd></div>
              <div class="grid grid-cols-[7.5rem_1fr] gap-3 px-3 py-2"><dt class="text-gray-400">Profissional</dt><dd class="text-gray-800 dark:text-gray-200">{{ workOrderPreview.maintenanceProfessional || '-' }}</dd></div>
              <div class="grid grid-cols-[7.5rem_1fr] gap-3 px-3 py-2"><dt class="text-gray-400">Destino int.</dt><dd class="text-gray-800 dark:text-gray-200">{{ workOrderPreview.maintenanceDestinationName || '-' }}</dd></div>
              <div class="grid grid-cols-[7.5rem_1fr] gap-3 px-3 py-2"><dt class="text-gray-400">Oficina ext.</dt><dd class="text-gray-800 dark:text-gray-200">{{ workOrderPreview.maintenanceExternalLocation || '-' }}</dd></div>
              <div class="grid grid-cols-[7.5rem_1fr] gap-3 px-3 py-2"><dt class="text-gray-400">Pedido</dt><dd class="text-gray-800 dark:text-gray-200">{{ workOrderPreview.maintenanceExternalOrderNumber || '-' }}</dd></div>
              <div class="grid grid-cols-[7.5rem_1fr] gap-3 px-3 py-2"><dt class="text-gray-400">Após OS</dt><dd class="text-gray-800 dark:text-gray-200">{{ workOrderPreview.motorStatusAfterMaintenance ? motorStatusLabel(workOrderPreview.motorStatusAfterMaintenance) : '-' }}</dd></div>
              <div class="grid grid-cols-[7.5rem_1fr] gap-3 px-3 py-2"><dt class="text-gray-400">Evento</dt><dd class="text-gray-800 dark:text-gray-200">{{ workOrderMotorEventLabel(workOrderPreview) || '-' }}</dd></div>
              <div class="grid grid-cols-[7.5rem_1fr] gap-3 px-3 py-2"><dt class="text-gray-400">Data evento</dt><dd class="text-gray-800 dark:text-gray-200">{{ formatDate(workOrderPreview.motorEventDate) }}</dd></div>
              <div class="grid grid-cols-[7.5rem_1fr] gap-3 px-3 py-2"><dt class="text-gray-400">Executado</dt><dd class="text-gray-800 dark:text-gray-200">{{ workOrderPreview.motorEventPerformedBy || '-' }}</dd></div>
              <div class="grid grid-cols-[7.5rem_1fr] gap-3 px-3 py-2"><dt class="text-gray-400">Destino ev.</dt><dd class="text-gray-800 dark:text-gray-200">{{ workOrderPreview.motorEventToDestination || '-' }}</dd></div>
            </dl>
          </aside>
        </div>
      </div>
    </div>
  </AppDialog>

  <AppDialog
    v-if="selectedMotor && locationTrailOpen"
    visible
    aria-label="Histórico de locais do motor"
    @close="locationTrailOpen = false"
  >
    <div class="ds-panel w-full max-w-2xl overflow-hidden">
      <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
        <div>
          <p class="ds-page-kicker">Motor {{ selectedMotor.tag }}</p>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Lugares por onde passou</h3>
        </div>
        <AppButton variant="ghost" size="sm" @click="locationTrailOpen = false">Fechar</AppButton>
      </div>
      <div class="p-5">
        <div v-if="selectedMotorLocationTrail.length" class="space-y-2">
          <div
            v-for="(entry, index) in selectedMotorLocationTrail"
            :key="`${entry.location}-${entry.startDate}-${entry.endDate}`"
            class="grid grid-cols-[auto_1fr] gap-3 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2"
          >
            <span class="mt-0.5 text-xs font-bold px-2 py-0.5 rounded bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-400">{{ index + 1 }}</span>
            <div class="min-w-0">
              <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ entry.location }}</p>
              <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {{ formatLocationPeriod(entry) }}
                <span v-if="entry.endOrderNumber"> · até OS #{{ entry.endOrderNumber }}</span>
                <span v-else-if="entry.startOrderNumber"> · desde OS #{{ entry.startOrderNumber }}</span>
              </p>
            </div>
          </div>
        </div>
        <p v-else class="text-sm text-gray-500 dark:text-gray-400">Nenhum período de local registrado para este motor.</p>
      </div>
    </div>
  </AppDialog>
</template>
