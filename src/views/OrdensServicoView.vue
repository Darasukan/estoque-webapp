<script setup>
import { ref, computed, watch, nextTick, inject } from 'vue'
import { useWorkOrders } from '../composables/useWorkOrders.js'
import { useItems } from '../composables/useItems.js'
import { useDestinations } from '../composables/useDestinations.js'
import { usePeople } from '../composables/usePeople.js'
import { useMovements } from '../composables/useMovements.js'
import { useMotors, MOTOR_EVENT_TYPES } from '../composables/useMotors.js'
import { useToast } from '../composables/useToast.js'

const props = defineProps({
  mode: { type: String, default: 'general' },
  embedded: { type: Boolean, default: false },
  prefillMotor: { type: Object, default: null },
  scopedMotorId: { type: String, default: '' },
})
const emit = defineEmits(['prefill-consumed'])
const isLoggedIn = inject('isLoggedIn')
const {
  workOrders, report,
  loadReport,
  addWorkOrder, editWorkOrder, deleteWorkOrder,
  addMaterial, removeMaterial
} = useWorkOrders()

const { items, variations, getVariationsForItem } = useItems()
const { groupedDestinations, getDestFullName } = useDestinations()
const { activePeople } = usePeople()
const { movements } = useMovements()
const { motors, addMotorEvent } = useMotors()
const { success, error: showError } = useToast()

const serviceTypes = ['Elétrica', 'Mecânica', 'Outros']
const isMotorMode = computed(() => props.mode === 'motor')
const pageTitle = computed(() => isMotorMode.value ? 'OS de Motor' : 'Ordens de Serviço')
const pageSubtitle = computed(() =>
  isMotorMode.value
    ? 'Manutenção de motores com histórico do ativo e baixa de peças do estoque'
    : 'Manutenção geral, sem vínculo obrigatório com motor'
)
const newButtonLabel = computed(() => isMotorMode.value ? 'Nova OS de Motor' : 'Nova OS')
const formTitle = computed(() => isMotorMode.value ? 'Nova OS de Motor' : 'Nova Ordem de Serviço')
const emptyOrdersText = computed(() =>
  isMotorMode.value ? 'Nenhuma OS de motor cadastrada' : 'Nenhuma ordem de serviço geral cadastrada'
)
const scopedMotor = computed(() => props.scopedMotorId ? motors.value.find(m => m.id === props.scopedMotorId) || null : null)

function focusRef(target) {
  const el = Array.isArray(target?.value) ? target.value[0] : target?.value
  if (el && typeof el.focus === 'function') el.focus()
}

// ===== Sub-tabs =====
const activeSubTab = ref('ordens')

// ===== OS List =====
const searchQuery = ref('')
const expandedOrderId = ref(null)
const showNewForm = ref(false)
const editingOrderId = ref(null)
const confirmDeleteId = ref(null)

function pad(n) {
  return String(n).padStart(2, '0')
}

function todayDate() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function currentTime() {
  const d = new Date()
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function emptyMotorEventForm(order = null) {
  return {
    eventType: 'revisado',
    eventDate: todayDate(),
    performedBy: order?.maintenanceProfessional || '',
    toDestinationId: '',
    toDestination: '',
    notes: '',
  }
}

function splitIsoDateTime(iso) {
  if (!iso) return { date: todayDate(), time: currentTime() }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { date: todayDate(), time: currentTime() }
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
}

function valueFromOrder(order, camelKey, snakeKey = '') {
  return order?.[camelKey] || (snakeKey ? order?.[snakeKey] : '') || ''
}

function inferEquipment(order) {
  const explicit = valueFromOrder(order, 'equipment') || valueFromOrder(order, 'destinationName', 'destination_name')
  if (explicit) return explicit
  const title = valueFromOrder(order, 'title')
  const match = title.match(/^[^-]+-\s*(.+)$/)
  return match?.[1]?.trim() || ''
}

function createEmptyOsForm(order = null) {
  if (order) {
    const fallback = splitIsoDateTime(order.createdAt)
    return {
      number: order.number || '',
      requestedBy: valueFromOrder(order, 'requestedBy', 'requested_by'),
      requestDate: valueFromOrder(order, 'requestDate', 'request_date') || fallback.date,
      requestTime: valueFromOrder(order, 'requestTime', 'request_time') || fallback.time,
      equipment: inferEquipment(order),
      motorId: valueFromOrder(order, 'motorId', 'motor_id'),
      destinationId: valueFromOrder(order, 'destinationId', 'destination_id'),
      serviceType: valueFromOrder(order, 'serviceType', 'service_type') || 'Outros',
      note: valueFromOrder(order, 'note'),
      maintenanceStartDate: valueFromOrder(order, 'maintenanceStartDate', 'maintenance_start_date'),
      maintenanceStartTime: valueFromOrder(order, 'maintenanceStartTime', 'maintenance_start_time'),
      maintenanceEndDate: valueFromOrder(order, 'maintenanceEndDate', 'maintenance_end_date'),
      maintenanceEndTime: valueFromOrder(order, 'maintenanceEndTime', 'maintenance_end_time'),
      maintenanceProfessional: valueFromOrder(order, 'maintenanceProfessional', 'maintenance_professional'),
      maintenanceMaterials: valueFromOrder(order, 'maintenanceMaterials', 'maintenance_materials'),
      maintenanceNote: valueFromOrder(order, 'maintenanceNote', 'maintenance_note'),
    }
  }

  return {
    number: '',
    requestedBy: '',
    requestDate: todayDate(),
    requestTime: currentTime(),
    equipment: '',
    motorId: '',
    destinationId: '',
    serviceType: 'Outros',
    note: '',
    maintenanceStartDate: '',
    maintenanceStartTime: '',
    maintenanceEndDate: '',
    maintenanceEndTime: '',
    maintenanceProfessional: '',
    maintenanceMaterials: '',
    maintenanceNote: '',
  }
}

// ===== New/Edit OS form =====
const osForm = ref(createEmptyOsForm())
const motorEventOrderId = ref(null)
const motorEventForm = ref(emptyMotorEventForm())

function resetOsForm() {
  osForm.value = createEmptyOsForm()
  applyScopedMotorToOsForm()
}

// ===== "Add Material" flow inside an OS =====
const addingMaterialToId = ref(null)
const matStep = ref(1)
const matSearch = ref('')
const matSelectedItem = ref(null)
const matSelectedVariation = ref(null)
const matQty = ref('')
const matSearchEl = ref(null)
const matQtyEl = ref(null)
const confirmRemoveItemId = ref(null)

function startAddMaterial(orderId) {
  addingMaterialToId.value = orderId
  matStep.value = 1
  matSearch.value = ''
  matSelectedItem.value = null
  matSelectedVariation.value = null
  matQty.value = '1'
  nextTick(() => focusRef(matSearchEl))
}

function cancelAddMaterial() {
  addingMaterialToId.value = null
}

// ===== Destination helpers =====
const orderedDestinations = computed(() => {
  const list = []
  for (const g of groupedDestinations.value) {
    list.push(g.parent)
    for (const c of g.children) list.push(c)
  }
  return list
})

const destinationOptions = computed(() =>
  orderedDestinations.value.map(d => ({ id: d.id, name: getDestFullName(d.id) }))
)

const motorOptions = computed(() =>
  motors.value
    .filter(m => !props.scopedMotorId || m.id === props.scopedMotorId)
    .map(m => ({
    id: m.id,
    label: `${m.tag}${m.name ? ` - ${m.name}` : ''}${m.destinationName ? ` (${m.destinationName})` : ''}`,
    motor: m,
  }))
)

const selectedOsMotor = computed(() =>
  motors.value.find(m => m.id === osForm.value.motorId) || null
)

function applyMotorToOsForm(motor = selectedOsMotor.value) {
  if (!motor) return
  osForm.value.motorId = motor.id
  osForm.value.equipment = motor.tag
  osForm.value.destinationId = motor.destinationId || ''
  if (!osForm.value.note.trim() && motor.name) osForm.value.note = `Motor: ${motor.name}`
}

function applyScopedMotorToOsForm() {
  if (isMotorMode.value && scopedMotor.value) applyMotorToOsForm(scopedMotor.value)
}

function normalizeText(value) {
  return String(value || '')
    .replace(/[›»]/g, '>')
    .trim()
    .toLowerCase()
}

function findDestinationIdByEquipment(equipment) {
  const q = normalizeText(equipment)
  if (!q) return ''
  return destinationOptions.value.find(d => normalizeText(d.name) === q)?.id || ''
}

function destinationIdForEquipment(form, equipment) {
  const matched = findDestinationIdByEquipment(equipment)
  if (matched) return matched
  const currentDestName = form.destinationId ? getDestFullName(form.destinationId) : ''
  return normalizeText(currentDestName) === normalizeText(equipment) ? form.destinationId : ''
}

watch(() => props.prefillMotor, (motor) => {
  if (!motor || !isMotorMode.value) return
  showNewForm.value = true
  editingOrderId.value = null
  osForm.value = createEmptyOsForm()
  applyMotorToOsForm(motor)
  emit('prefill-consumed')
}, { immediate: true })

watch(scopedMotor, () => {
  if (!showNewForm.value && !editingOrderId.value) return
  applyScopedMotorToOsForm()
}, { immediate: true })

watch(isMotorMode, () => {
  showNewForm.value = false
  editingOrderId.value = null
  resetOsForm()
})

// ===== Item search for material =====
const matSearchNorm = computed(() => matSearch.value.trim().toLowerCase())
const matItemResults = computed(() => {
  const q = matSearchNorm.value
  if (!q) return []
  return items.value.filter(item => {
    if (item.name.toLowerCase().includes(q) ||
      (item.group || '').toLowerCase().includes(q) ||
      (item.category || '').toLowerCase().includes(q) ||
      (item.subcategory || '').toLowerCase().includes(q)) return true

    return getVariationsForItem(item.id).some(v =>
      Object.values(v.values || {}).some(val => String(val || '').toLowerCase().includes(q)) ||
      Object.values(v.extras || {}).some(val => String(val || '').toLowerCase().includes(q)) ||
      (v.location || '').toLowerCase().includes(q)
    )
  }).slice(0, 30)
})

const matItemVariations = computed(() =>
  matSelectedItem.value ? getVariationsForItem(matSelectedItem.value.id) : []
)

const matParsedQty = computed(() => {
  const n = Number(matQty.value)
  return isFinite(n) && n > 0 ? n : null
})

const matExceedsStock = computed(() =>
  matParsedQty.value !== null &&
  matSelectedVariation.value !== null &&
  matParsedQty.value > matSelectedVariation.value.stock
)

// ===== Filtered OS list =====
const filteredOrders = computed(() => {
  const baseOrders = workOrders.value.filter(o => {
    if (!isMotorMode.value) return !o.motorId
    if (!o.motorId) return false
    return !props.scopedMotorId || o.motorId === props.scopedMotorId
  })
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return baseOrders
  return baseOrders.filter(o => {
    const haystack = [
      o.number,
      orderDisplayTitle(o),
      o.motorTag,
      o.motorName,
      o.destinationName,
      o.requestedBy,
      o.serviceType,
      o.note,
      o.maintenanceProfessional,
      o.maintenanceMaterials,
      o.maintenanceNote,
    ].join(' ').toLowerCase()
    return haystack.includes(q)
  })
})

function validateOsForm() {
  const numberText = String(osForm.value.number || '').trim()
  if (numberText && (!Number.isInteger(Number(numberText)) || Number(numberText) <= 0)) { showError('Número da ordem inválido'); return false }
  if (!osForm.value.requestedBy.trim()) { showError('Solicitante é obrigatório'); return false }
  if (!osForm.value.requestDate) { showError('Data é obrigatória'); return false }
  if (!osForm.value.requestTime) { showError('Horário é obrigatório'); return false }
  if (isMotorMode.value && !osForm.value.motorId) { showError('Motor é obrigatório'); return false }
  if (!osForm.value.equipment.trim()) { showError('Equipamento é obrigatório'); return false }
  if (!serviceTypes.includes(osForm.value.serviceType)) { showError('Tipo da OS é obrigatório'); return false }

  const hasStartDate = !!osForm.value.maintenanceStartDate
  const hasStartTime = !!osForm.value.maintenanceStartTime
  const hasEndDate = !!osForm.value.maintenanceEndDate
  const hasEndTime = !!osForm.value.maintenanceEndTime
  if (hasStartDate !== hasStartTime) { showError('Informe data e horário de início da manutenção'); return false }
  if (hasEndDate !== hasEndTime) { showError('Informe data e horário de término da manutenção'); return false }
  if ((hasEndDate || hasEndTime) && !(hasStartDate && hasStartTime)) { showError('Informe início antes do término da manutenção'); return false }
  if (hasStartDate && hasEndDate) {
    const start = new Date(`${osForm.value.maintenanceStartDate}T${osForm.value.maintenanceStartTime}`)
    const end = new Date(`${osForm.value.maintenanceEndDate}T${osForm.value.maintenanceEndTime}`)
    if (end < start) { showError('Término não pode ser antes do início da manutenção'); return false }
  }
  return true
}

function buildOrderTitle(form) {
  return `${form.serviceType || 'Outros'} - ${form.equipment.trim() || 'Sem equipamento'}`
}

function buildOsPayload() {
  const form = osForm.value
  const equipment = form.equipment.trim()
  const numberText = String(form.number || '').trim()

  return {
    number: numberText ? Number(numberText) : '',
    title: buildOrderTitle(form),
    motorId: isMotorMode.value ? form.motorId : '',
    destinationId: destinationIdForEquipment(form, equipment),
    requestedBy: form.requestedBy.trim(),
    requestDate: form.requestDate,
    requestTime: form.requestTime,
    equipment,
    serviceType: form.serviceType,
    note: form.note.trim(),
    maintenanceStartDate: form.maintenanceStartDate,
    maintenanceStartTime: form.maintenanceStartTime,
    maintenanceEndDate: form.maintenanceEndDate,
    maintenanceEndTime: form.maintenanceEndTime,
    maintenanceProfessional: form.maintenanceProfessional.trim(),
    maintenanceMaterials: form.maintenanceMaterials.trim(),
    maintenanceNote: form.maintenanceNote.trim(),
  }
}

// ===== Actions =====
async function handleCreateOS() {
  if (!validateOsForm()) return
  try {
    await addWorkOrder(buildOsPayload())
    success('Ordem de serviço criada')
    showNewForm.value = false
    resetOsForm()
  } catch (e) { showError(e.message) }
}

async function handleEditOS(id) {
  if (!validateOsForm()) return
  try {
    await editWorkOrder(id, buildOsPayload())
    success('Ordem de serviço atualizada')
    editingOrderId.value = null
    resetOsForm()
  } catch (e) { showError(e.message) }
}

function startEditOS(order) {
  showNewForm.value = false
  editingOrderId.value = order.id
  osForm.value = createEmptyOsForm(order)
}

function cancelEdit() {
  editingOrderId.value = null
  resetOsForm()
}

async function handleDeleteOS(id) {
  try {
    const result = await deleteWorkOrder(id)
    for (const movementId of result?.removedMovementIds || []) {
      const idx = movements.value.findIndex(m => m.id === movementId)
      if (idx !== -1) movements.value.splice(idx, 1)
    }
    for (const restored of result?.restoredStock || []) {
      const liveVar = variations.value.find(v => v.id === restored.variationId)
      if (liveVar) liveVar.stock = restored.newStock
    }
    success('Ordem de serviço excluída')
    confirmDeleteId.value = null
    if (expandedOrderId.value === id) expandedOrderId.value = null
  } catch (e) { showError(e.message) }
}

async function handleAddMaterial() {
  if (!matParsedQty.value || !matSelectedVariation.value || !addingMaterialToId.value) return
  if (matExceedsStock.value) { showError('Estoque insuficiente'); return }

  try {
    const result = await addMaterial(addingMaterialToId.value, matSelectedVariation.value.id, matParsedQty.value)
    const liveVar = variations.value.find(v => v.id === matSelectedVariation.value.id)
    if (liveVar) liveVar.stock = result.newStock
    if (result.movement) movements.value.unshift(result.movement)
    success('Material adicionado à OS')
    cancelAddMaterial()
  } catch (e) { showError(e.message) }
}

async function handleRemoveMaterial(workOrderId, woiId) {
  try {
    const result = await removeMaterial(workOrderId, woiId)
    if (result.variationId && result.newStock !== null) {
      const liveVar = variations.value.find(v => v.id === result.variationId)
      if (liveVar) liveVar.stock = result.newStock
    }
    if (result.removedMovementId) {
      const idx = movements.value.findIndex(m => m.id === result.removedMovementId)
      if (idx !== -1) movements.value.splice(idx, 1)
    }
    success('Material removido da OS')
    confirmRemoveItemId.value = null
  } catch (e) { showError(e.message) }
}

function startMotorEvent(order, type = 'revisado') {
  motorEventOrderId.value = order.id
  motorEventForm.value = { ...emptyMotorEventForm(order), eventType: type }
}

function cancelMotorEvent() {
  motorEventOrderId.value = null
  motorEventForm.value = emptyMotorEventForm()
}

async function handleMotorEvent(order) {
  if (!order.motorId) return
  try {
    await addMotorEvent(order.motorId, {
      ...motorEventForm.value,
      workOrderId: order.id,
    })
    success('Evento do motor registrado')
    cancelMotorEvent()
  } catch (e) { showError(e.message) }
}

// ===== Report =====
const expandedReportDest = ref(null)

watch(activeSubTab, (tab) => {
  if (tab === 'resumo') loadReport()
})

// ===== Helpers =====
function formatDate(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatDateOnly(value) {
  if (!value) return '-'
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-')
    return `${day}/${month}/${year}`
  }
  return formatDate(value).split(' ')[0]
}

function formatTimeOnly(value) {
  return value || '-'
}

function formatDateTimeParts(date, time, fallback) {
  if (date && time) return `${formatDateOnly(date)} ${formatTimeOnly(time)}`
  if (date) return formatDateOnly(date)
  if (time) return formatTimeOnly(time)
  return formatDate(fallback)
}

function maintenancePeriod(order) {
  const start = formatDateTimeParts(order.maintenanceStartDate, order.maintenanceStartTime, '')
  const end = formatDateTimeParts(order.maintenanceEndDate, order.maintenanceEndTime, '')
  if (start === '-' && end === '-') return '-'
  if (end === '-') return `${start} até em aberto`
  return `${start} até ${end}`
}

function orderDisplayTitle(order) {
  return order.equipment || order.destinationName || order.title || 'Sem equipamento'
}

function serviceTypeClass(type) {
  if (type === 'Elétrica') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/35 dark:text-amber-300'
  if (type === 'Mecânica') return 'bg-sky-100 text-sky-800 dark:bg-sky-900/35 dark:text-sky-300'
  return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
}

function variationLabel(v) {
  const vals = v.variationValues || v.values || {}
  const parts = Object.entries(vals).map(([k, val]) => `${k}: ${val}`).filter(Boolean)
  return parts.length ? parts.join(' - ') : '-'
}

function hierarchyLabel(item) {
  return [item.group, item.category, item.subcategory].filter(Boolean).join(' > ')
}

function toggleOrder(id) {
  expandedOrderId.value = expandedOrderId.value === id ? null : id
}

function selectMatItem(item) {
  matSelectedItem.value = item
  matStep.value = 2
}

function selectMatVariation(v) {
  matSelectedVariation.value = v
  matStep.value = 3
  matQty.value = '1'
  nextTick(() => focusRef(matQtyEl))
}

function matBackToStep1() {
  matSelectedItem.value = null
  matSelectedVariation.value = null
  matStep.value = 1
  nextTick(() => focusRef(matSearchEl))
}

function matBackToStep2() {
  matSelectedVariation.value = null
  matStep.value = 2
}
</script>

<template>
  <div class="space-y-4">
    <datalist id="os-people-options">
      <option v-for="p in activePeople" :key="p.id" :value="p.name" />
    </datalist>
    <datalist id="os-equipment-options">
      <option v-for="d in destinationOptions" :key="d.id" :value="d.name" />
    </datalist>

    <!-- Header -->
    <div v-if="!embedded">
      <h1 class="text-xl font-semibold text-gray-900 dark:text-gray-100">{{ pageTitle }}</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{{ pageSubtitle }}</p>
    </div>

    <!-- Sub-tabs -->
    <div class="hidden">
      <button
        v-for="tab in [
          { id: 'ordens', label: 'Ordens de Serviço', icon: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.251 2.251 0 011.65.762m-5.8 0c-.376.023-.75.05-1.124.08C8.845 4.013 8 4.974 8 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z' },
          { id: 'resumo', label: 'Resumo por Equipamento', icon: 'M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605' }
        ]"
        :key="tab.id"
        class="flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors relative whitespace-nowrap"
        :class="activeSubTab === tab.id
          ? 'text-primary-700 dark:text-primary-400'
          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'"
        @click="activeSubTab = tab.id"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" :d="tab.icon" />
        </svg>
        {{ tab.label }}
        <span
          v-if="activeSubTab === tab.id"
          class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 dark:bg-primary-400 rounded-full"
        ></span>
      </button>
    </div>

    <!-- TAB: Ordens de Serviço -->
    <template v-if="activeSubTab === 'ordens'">
      <div class="flex flex-col sm:flex-row sm:items-center gap-3">
        <div class="relative flex-1">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Buscar por número, solicitante, equipamento, tipo ou profissional..."
            class="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <button
          v-if="isLoggedIn"
          class="flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors whitespace-nowrap"
          @click="showNewForm = !showNewForm; editingOrderId = null; if (showNewForm) resetOsForm()"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          {{ newButtonLabel }}
        </button>
      </div>

      <!-- New OS form -->
      <div v-if="showNewForm" class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
        <div class="flex items-center justify-between gap-3">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ formTitle }}</h3>
          <span class="text-xs text-gray-400">Campos com * são obrigatórios</span>
        </div>

        <div class="space-y-3">
          <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Abertura da OS</h4>
          <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Nº da Ordem</label>
              <input v-model="osForm.number" type="number" min="1" placeholder="Automático" class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Data *</label>
              <input v-model="osForm.requestDate" type="date" class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Horário *</label>
              <input v-model="osForm.requestTime" type="time" class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Tipo *</label>
              <div class="grid grid-cols-3 rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
                <button
                  v-for="type in serviceTypes"
                  :key="type"
                  type="button"
                  class="px-2 py-2 text-xs font-medium transition-colors"
                  :class="osForm.serviceType === type ? 'bg-primary-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'"
                  @click="osForm.serviceType = type"
                >{{ type }}</button>
              </div>
            </div>
            <div class="md:col-span-2">
              <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Solicitante *</label>
              <input v-model="osForm.requestedBy" list="os-people-options" type="text" placeholder="Nome do solicitante" class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
            </div>
            <div class="md:col-span-2">
              <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Equipamento *</label>
              <input v-model="osForm.equipment" list="os-equipment-options" type="text" placeholder="Máquina, linha, setor ou equipamento" class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
            </div>
            <div v-if="isMotorMode" class="md:col-span-2">
              <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Motor *</label>
              <select v-model="osForm.motorId" class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent" @change="applyMotorToOsForm()">
                <option value="">Sem motor</option>
                <option v-for="opt in motorOptions" :key="opt.id" :value="opt.id">{{ opt.label }}</option>
              </select>
            </div>
            <div class="md:col-span-4">
              <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Observações</label>
              <textarea v-model="osForm.note" rows="2" class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent" placeholder="Observações da abertura"></textarea>
            </div>
          </div>
        </div>

        <div class="space-y-3 border-t border-gray-200 dark:border-gray-700 pt-4">
          <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Manutenção</h4>
          <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Data início</label>
              <input v-model="osForm.maintenanceStartDate" type="date" class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Horário início</label>
              <input v-model="osForm.maintenanceStartTime" type="time" class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Data término</label>
              <input v-model="osForm.maintenanceEndDate" type="date" class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Horário término</label>
              <input v-model="osForm.maintenanceEndTime" type="time" class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
            </div>
            <div class="md:col-span-2">
              <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Profissional</label>
              <input v-model="osForm.maintenanceProfessional" list="os-people-options" type="text" placeholder="Nome do profissional" class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
            </div>
            <div class="md:col-span-2">
              <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Materiais adicionais</label>
              <textarea v-model="osForm.maintenanceMaterials" rows="2" class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent" placeholder="Materiais fora do catálogo, peças ou ferramentas"></textarea>
            </div>
            <div class="md:col-span-4">
              <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Observações da manutenção</label>
              <textarea v-model="osForm.maintenanceNote" rows="2" class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent" placeholder="Serviço executado, pendências, testes"></textarea>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 pt-1">
          <button class="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors" @click="handleCreateOS">Criar OS</button>
          <button class="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" @click="showNewForm = false; resetOsForm()">Cancelar</button>
        </div>
      </div>

      <!-- Orders list -->
      <div v-if="filteredOrders.length === 0" class="text-center py-12 text-gray-400 dark:text-gray-500">
        <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" stroke-width="1" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.251 2.251 0 011.65.762m-5.8 0c-.376.023-.75.05-1.124.08C8.845 4.013 8 4.974 8 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" /></svg>
        <p class="text-sm">{{ searchQuery ? 'Nenhuma OS encontrada' : emptyOrdersText }}</p>
      </div>

      <div v-else class="space-y-2">
        <div
          v-for="order in filteredOrders"
          :key="order.id"
          class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
        >
          <div
            class="flex flex-wrap items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
            @click="toggleOrder(order.id)"
          >
            <svg
              class="w-4 h-4 text-gray-400 transition-transform flex-shrink-0"
              :class="expandedOrderId === order.id ? 'rotate-90' : ''"
              fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
            ><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>

            <span class="text-xs font-bold px-2 py-0.5 rounded bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-400 whitespace-nowrap">
              OS #{{ order.number }}
            </span>
            <span class="text-xs font-semibold px-2 py-0.5 rounded whitespace-nowrap" :class="serviceTypeClass(order.serviceType)">
              {{ order.serviceType || 'Outros' }}
            </span>
            <span v-if="order.motorTag" class="text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 whitespace-nowrap">
              Motor {{ order.motorTag }}
            </span>
            <span class="text-sm font-medium text-gray-900 dark:text-gray-100 flex-1 min-w-[180px] truncate">{{ orderDisplayTitle(order) }}</span>
            <span class="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{{ order.requestedBy || 'Sem solicitante' }}</span>
            <span class="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">{{ formatDateTimeParts(order.requestDate, order.requestTime, order.createdAt) }}</span>
            <span class="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
              {{ (order.items || []).length }} {{ (order.items || []).length === 1 ? 'material' : 'materiais' }}
            </span>
          </div>

          <div v-if="expandedOrderId === order.id" class="border-t border-gray-200 dark:border-gray-700 px-4 py-3 space-y-4">
            <template v-if="editingOrderId === order.id">
              <div class="space-y-4">
                <div class="space-y-3">
                  <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Abertura da OS</h4>
                  <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Nº da Ordem</label>
                      <input v-model="osForm.number" type="number" min="1" class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Data *</label>
                      <input v-model="osForm.requestDate" type="date" class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Horário *</label>
                      <input v-model="osForm.requestTime" type="time" class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Tipo *</label>
                      <div class="grid grid-cols-3 rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
                        <button
                          v-for="type in serviceTypes"
                          :key="type"
                          type="button"
                          class="px-2 py-2 text-xs font-medium transition-colors"
                          :class="osForm.serviceType === type ? 'bg-primary-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'"
                          @click="osForm.serviceType = type"
                        >{{ type }}</button>
                      </div>
                    </div>
                    <div class="md:col-span-2">
                      <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Solicitante *</label>
                      <input v-model="osForm.requestedBy" list="os-people-options" type="text" class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                    </div>
                    <div class="md:col-span-2">
                      <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Equipamento *</label>
                      <input v-model="osForm.equipment" list="os-equipment-options" type="text" class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                    </div>
                    <div v-if="isMotorMode" class="md:col-span-2">
                      <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Motor *</label>
                      <select v-model="osForm.motorId" class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent" @change="applyMotorToOsForm()">
                        <option value="">Sem motor</option>
                        <option v-for="opt in motorOptions" :key="opt.id" :value="opt.id">{{ opt.label }}</option>
                      </select>
                    </div>
                    <div class="md:col-span-4">
                      <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Observações</label>
                      <textarea v-model="osForm.note" rows="2" class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"></textarea>
                    </div>
                  </div>
                </div>

                <div class="space-y-3 border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Manutenção</h4>
                  <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Data início</label>
                      <input v-model="osForm.maintenanceStartDate" type="date" class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Horário início</label>
                      <input v-model="osForm.maintenanceStartTime" type="time" class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Data término</label>
                      <input v-model="osForm.maintenanceEndDate" type="date" class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Horário término</label>
                      <input v-model="osForm.maintenanceEndTime" type="time" class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                    </div>
                    <div class="md:col-span-2">
                      <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Profissional</label>
                      <input v-model="osForm.maintenanceProfessional" list="os-people-options" type="text" class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                    </div>
                    <div class="md:col-span-2">
                      <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Materiais adicionais</label>
                      <textarea v-model="osForm.maintenanceMaterials" rows="2" class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"></textarea>
                    </div>
                    <div class="md:col-span-4">
                      <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Observações da manutenção</label>
                      <textarea v-model="osForm.maintenanceNote" rows="2" class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"></textarea>
                    </div>
                  </div>
                </div>

                <div class="flex gap-2">
                  <button class="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg" @click="handleEditOS(order.id)">Salvar</button>
                  <button class="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg" @click="cancelEdit">Cancelar</button>
                </div>
              </div>
            </template>

            <template v-else>
              <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm">
                <div class="space-y-3">
                  <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Abertura da OS</h4>
                  <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <span class="text-xs text-gray-400 dark:text-gray-500">Solicitante</span>
                      <p class="text-gray-900 dark:text-gray-100">{{ order.requestedBy || '-' }}</p>
                    </div>
                    <div>
                      <span class="text-xs text-gray-400 dark:text-gray-500">Data</span>
                      <p class="text-gray-900 dark:text-gray-100">{{ formatDateOnly(order.requestDate) }}</p>
                    </div>
                    <div>
                      <span class="text-xs text-gray-400 dark:text-gray-500">Horário</span>
                      <p class="text-gray-900 dark:text-gray-100">{{ formatTimeOnly(order.requestTime) }}</p>
                    </div>
                    <div>
                      <span class="text-xs text-gray-400 dark:text-gray-500">Equipamento</span>
                      <p class="text-gray-900 dark:text-gray-100">{{ orderDisplayTitle(order) }}</p>
                    </div>
                    <div v-if="order.motorTag">
                      <span class="text-xs text-gray-400 dark:text-gray-500">Motor</span>
                      <p class="text-gray-900 dark:text-gray-100">{{ order.motorTag }}{{ order.motorName ? ` - ${order.motorName}` : '' }}</p>
                    </div>
                    <div>
                      <span class="text-xs text-gray-400 dark:text-gray-500">Tipo</span>
                      <p class="text-gray-900 dark:text-gray-100">{{ order.serviceType || 'Outros' }}</p>
                    </div>
                    <div>
                      <span class="text-xs text-gray-400 dark:text-gray-500">Nº da Ordem</span>
                      <p class="text-gray-900 dark:text-gray-100">#{{ order.number }}</p>
                    </div>
                    <div class="col-span-2 md:col-span-3">
                      <span class="text-xs text-gray-400 dark:text-gray-500">Observações</span>
                      <p class="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{{ order.note || '-' }}</p>
                    </div>
                  </div>
                </div>

                <div class="space-y-3">
                  <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Manutenção</h4>
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <span class="text-xs text-gray-400 dark:text-gray-500">Período</span>
                      <p class="text-gray-900 dark:text-gray-100">{{ maintenancePeriod(order) }}</p>
                    </div>
                    <div>
                      <span class="text-xs text-gray-400 dark:text-gray-500">Profissional</span>
                      <p class="text-gray-900 dark:text-gray-100">{{ order.maintenanceProfessional || '-' }}</p>
                    </div>
                    <div class="col-span-2">
                      <span class="text-xs text-gray-400 dark:text-gray-500">Materiais adicionais</span>
                      <p class="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{{ order.maintenanceMaterials || '-' }}</p>
                    </div>
                    <div class="col-span-2">
                      <span class="text-xs text-gray-400 dark:text-gray-500">Observações</span>
                      <p class="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{{ order.maintenanceNote || '-' }}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div v-if="isLoggedIn" class="flex flex-wrap items-center gap-2">
                <button class="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" @click="startEditOS(order)">
                  <svg class="w-3.5 h-3.5 inline mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>
                  Editar
                </button>
                <button v-if="isMotorMode && order.motorId" class="px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors" @click="startMotorEvent(order)">
                  Registrar evento do motor
                </button>
                <button
                  v-if="confirmDeleteId !== order.id"
                  class="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  @click="confirmDeleteId = order.id"
                >
                  <svg class="w-3.5 h-3.5 inline mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                  Excluir
                </button>
                <template v-else>
                  <span class="text-xs text-red-600 dark:text-red-400">Confirmar exclusão?</span>
                  <button class="px-2 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded" @click="handleDeleteOS(order.id)">Sim</button>
                  <button class="px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" @click="confirmDeleteId = null">Não</button>
                </template>
              </div>

              <div v-if="motorEventOrderId === order.id" class="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-3 space-y-3">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <select v-model="motorEventForm.eventType" class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                    <option v-for="t in MOTOR_EVENT_TYPES" :key="t.id" :value="t.id">{{ t.label }}</option>
                  </select>
                  <input v-model="motorEventForm.eventDate" type="date" class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                  <input v-model="motorEventForm.performedBy" list="os-people-options" placeholder="Executado por" class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                  <select v-model="motorEventForm.toDestinationId" class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                    <option value="">Sem mudanca de local</option>
                    <option v-for="d in orderedDestinations" :key="d.id" :value="d.id">{{ getDestFullName(d.id) }}</option>
                  </select>
                </div>
                <textarea v-model="motorEventForm.notes" rows="2" placeholder="Observacoes do evento" class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"></textarea>
                <div class="flex justify-end gap-2">
                  <button class="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" @click="cancelMotorEvent">Cancelar</button>
                  <button class="px-3 py-1.5 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors" @click="handleMotorEvent(order)">Salvar evento</button>
                </div>
              </div>

              <div class="flex items-center justify-between gap-3 border-t border-gray-200 dark:border-gray-700 pt-3">
                <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Materiais utilizados com baixa no estoque</h4>
                <button
                  v-if="isLoggedIn"
                  class="px-3 py-1.5 text-xs font-medium text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                  @click="startAddMaterial(order.id)"
                >
                  <svg class="w-3.5 h-3.5 inline mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                  Buscar catálogo
                </button>
              </div>

              <!-- Add material flow -->
              <div v-if="addingMaterialToId === order.id" class="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-3">
                <div class="flex items-center justify-between">
                  <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Adicionar material do catálogo</h4>
                  <button class="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" @click="cancelAddMaterial">Fechar</button>
                </div>

                <template v-if="matStep === 1">
                  <input
                    ref="matSearchEl"
                    v-model="matSearch"
                    type="text"
                    placeholder="Buscar item por nome, grupo ou categoria..."
                    class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <div v-if="matSearchNorm && matItemResults.length" class="space-y-1 max-h-48 overflow-y-auto">
                    <button
                      v-for="item in matItemResults"
                      :key="item.id"
                      class="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      @click="selectMatItem(item)"
                    >
                      <span class="font-medium text-gray-900 dark:text-gray-100">{{ item.name }}</span>
                      <span class="text-xs text-gray-400 ml-2">{{ hierarchyLabel(item) }}</span>
                    </button>
                  </div>
                  <p v-else-if="matSearchNorm && !matItemResults.length" class="text-sm text-gray-400">Nenhum item encontrado</p>
                </template>

                <template v-else-if="matStep === 2">
                  <div class="flex items-center gap-2 mb-2">
                    <button class="text-xs text-primary-600 dark:text-primary-400 hover:underline" @click="matBackToStep1">Voltar</button>
                    <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ matSelectedItem.name }}</span>
                  </div>
                  <div v-if="matItemVariations.length" class="space-y-1 max-h-48 overflow-y-auto">
                    <button
                      v-for="v in matItemVariations"
                      :key="v.id"
                      class="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between gap-3"
                      @click="selectMatVariation(v)"
                    >
                      <span class="text-gray-900 dark:text-gray-100">{{ variationLabel(v) }}</span>
                      <span class="text-xs whitespace-nowrap" :class="v.stock > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'">
                        Estoque: {{ v.stock }} {{ matSelectedItem.unit }}
                      </span>
                    </button>
                  </div>
                  <p v-else class="text-sm text-gray-400">Nenhuma variação encontrada</p>
                </template>

                <template v-else-if="matStep === 3">
                  <div class="flex items-center gap-2 mb-2">
                    <button class="text-xs text-primary-600 dark:text-primary-400 hover:underline" @click="matBackToStep2">Voltar</button>
                    <span class="text-sm text-gray-900 dark:text-gray-100">{{ matSelectedItem.name }} - {{ variationLabel(matSelectedVariation) }}</span>
                  </div>
                  <div class="flex flex-col sm:flex-row sm:items-end gap-2">
                    <div class="flex-1">
                      <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Quantidade ({{ matSelectedItem.unit }})</label>
                      <input
                        ref="matQtyEl"
                        v-model="matQty"
                        type="number"
                        min="1"
                        step="1"
                        class="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        :class="matExceedsStock ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'"
                        @keydown.enter="handleAddMaterial"
                      />
                      <p v-if="matExceedsStock" class="text-xs text-red-500 mt-1">Estoque insuficiente (disponível: {{ matSelectedVariation.stock }})</p>
                    </div>
                    <button
                      :disabled="!matParsedQty || matExceedsStock"
                      class="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
                      @click="handleAddMaterial"
                    >Adicionar</button>
                  </div>
                </template>
              </div>

              <!-- Materials list -->
              <div v-if="order.items && order.items.length">
                <div class="overflow-x-auto">
                  <table class="w-full text-sm">
                    <thead>
                      <tr class="text-left text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                        <th class="pb-2 pr-3">Item</th>
                        <th class="pb-2 pr-3">Variação</th>
                        <th class="pb-2 pr-3 text-right">Qtd</th>
                        <th class="pb-2 pr-3">Unid</th>
                        <th class="pb-2 pr-3">Data</th>
                        <th v-if="isLoggedIn" class="pb-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="mat in order.items" :key="mat.id" class="border-t border-gray-100 dark:border-gray-700/50">
                        <td class="py-2 pr-3 text-gray-900 dark:text-gray-100">{{ mat.itemName }}</td>
                        <td class="py-2 pr-3 text-gray-600 dark:text-gray-400">{{ variationLabel(mat) }}</td>
                        <td class="py-2 pr-3 text-right font-medium text-gray-900 dark:text-gray-100">{{ mat.qty }}</td>
                        <td class="py-2 pr-3 text-gray-500 dark:text-gray-400">{{ mat.itemUnit }}</td>
                        <td class="py-2 pr-3 text-gray-400 dark:text-gray-500 text-xs">{{ formatDate(mat.addedAt) }}</td>
                        <td v-if="isLoggedIn" class="py-2 text-right">
                          <button
                            v-if="confirmRemoveItemId !== mat.id"
                            class="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400"
                            @click="confirmRemoveItemId = mat.id"
                          >Remover</button>
                          <span v-else class="inline-flex items-center gap-1">
                            <button class="text-xs text-white bg-red-600 hover:bg-red-700 px-2 py-0.5 rounded" @click="handleRemoveMaterial(order.id, mat.id)">Sim</button>
                            <button class="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-2 py-0.5" @click="confirmRemoveItemId = null">Não</button>
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div v-else class="text-sm text-gray-400 dark:text-gray-500 italic">Nenhum material do estoque vinculado a esta OS</div>
            </template>
          </div>
        </div>
      </div>
    </template>

    <!-- TAB: Resumo por Equipamento -->
    <template v-if="activeSubTab === 'resumo'">
      <div v-if="!report.length" class="text-center py-12 text-gray-400 dark:text-gray-500">
        <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" stroke-width="1" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" /></svg>
        <p class="text-sm">Nenhum dado de equipamento encontrado</p>
      </div>

      <div v-else class="space-y-2">
        <div
          v-for="dest in report"
          :key="dest.destinationName"
          class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
        >
          <div
            class="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
            @click="expandedReportDest = expandedReportDest === dest.destinationName ? null : dest.destinationName"
          >
            <svg
              class="w-4 h-4 text-gray-400 transition-transform flex-shrink-0"
              :class="expandedReportDest === dest.destinationName ? 'rotate-90' : ''"
              fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
            ><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>

            <span class="text-sm font-medium text-gray-900 dark:text-gray-100 flex-1">{{ dest.destinationName }}</span>
            <span class="text-xs text-gray-400 dark:text-gray-500">
              {{ dest.orders.length }} OS - {{ dest.looseSaidas.length }} saídas avulsas - {{ dest.materialTotals.length }} materiais
            </span>
          </div>

          <div v-if="expandedReportDest === dest.destinationName" class="border-t border-gray-200 dark:border-gray-700 px-4 py-3 space-y-4">
            <div v-if="dest.materialTotals.length">
              <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Total de Materiais</h4>
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="text-left text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                      <th class="pb-2 pr-3">Item</th>
                      <th class="pb-2 pr-3">Variação</th>
                      <th class="pb-2 pr-3 text-right">Qtd Total</th>
                      <th class="pb-2">Unid</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(mt, idx) in dest.materialTotals" :key="idx" class="border-t border-gray-100 dark:border-gray-700/50">
                      <td class="py-1.5 pr-3 text-gray-900 dark:text-gray-100">{{ mt.itemName }}</td>
                      <td class="py-1.5 pr-3 text-gray-600 dark:text-gray-400">{{ variationLabel(mt) }}</td>
                      <td class="py-1.5 pr-3 text-right font-semibold text-gray-900 dark:text-gray-100">{{ mt.qty }}</td>
                      <td class="py-1.5 text-gray-500 dark:text-gray-400">{{ mt.itemUnit }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div v-if="dest.orders.length">
              <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Ordens de Serviço</h4>
              <div class="space-y-2">
                <div v-for="wo in dest.orders" :key="wo.id" class="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-3">
                  <div class="flex flex-wrap items-center gap-2 mb-1">
                    <span class="text-xs font-bold px-1.5 py-0.5 rounded bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-400">OS #{{ wo.number }}</span>
                    <span class="text-xs font-semibold px-1.5 py-0.5 rounded" :class="serviceTypeClass(wo.serviceType)">{{ wo.serviceType || 'Outros' }}</span>
                    <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ orderDisplayTitle(wo) }}</span>
                    <span class="text-xs text-gray-400 ml-auto">{{ formatDateTimeParts(wo.requestDate, wo.requestTime, wo.createdAt) }}</span>
                  </div>
                  <p v-if="wo.maintenanceProfessional" class="text-xs text-gray-500 dark:text-gray-400 mb-2">Profissional: {{ wo.maintenanceProfessional }}</p>
                  <div v-if="wo.items && wo.items.length" class="mt-2">
                    <table class="w-full text-xs">
                      <tbody>
                        <tr v-for="it in wo.items" :key="it.id" class="border-t border-gray-200/50 dark:border-gray-700/30">
                          <td class="py-1 pr-2 text-gray-700 dark:text-gray-300">{{ it.itemName }}</td>
                          <td class="py-1 pr-2 text-gray-500 dark:text-gray-400">{{ variationLabel(it) }}</td>
                          <td class="py-1 pr-2 text-right font-medium text-gray-700 dark:text-gray-300">{{ it.qty }}</td>
                          <td class="py-1 text-gray-400">{{ it.itemUnit }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p v-else class="text-xs text-gray-400 italic mt-1">Sem materiais do estoque</p>
                </div>
              </div>
            </div>

            <div v-if="dest.looseSaidas.length">
              <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Saídas Avulsas (sem OS)</h4>
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="text-left text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                      <th class="pb-2 pr-3">Item</th>
                      <th class="pb-2 pr-3">Variação</th>
                      <th class="pb-2 pr-3 text-right">Qtd</th>
                      <th class="pb-2 pr-3">Unid</th>
                      <th class="pb-2 pr-3">Solicitante</th>
                      <th class="pb-2">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="s in dest.looseSaidas" :key="s.id" class="border-t border-gray-100 dark:border-gray-700/50">
                      <td class="py-1.5 pr-3 text-gray-900 dark:text-gray-100">{{ s.itemName }}</td>
                      <td class="py-1.5 pr-3 text-gray-600 dark:text-gray-400">{{ variationLabel(s) }}</td>
                      <td class="py-1.5 pr-3 text-right font-medium text-gray-900 dark:text-gray-100">{{ s.qty }}</td>
                      <td class="py-1.5 pr-3 text-gray-500 dark:text-gray-400">{{ s.itemUnit }}</td>
                      <td class="py-1.5 pr-3 text-gray-600 dark:text-gray-400">{{ s.requestedBy || '-' }}</td>
                      <td class="py-1.5 text-gray-400 dark:text-gray-500 text-xs">{{ formatDate(s.date) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <p v-if="!dest.materialTotals.length" class="text-sm text-gray-400 italic">Nenhum material registrado para este equipamento</p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
