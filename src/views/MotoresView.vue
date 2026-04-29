<script setup>
import { computed, inject, onMounted, ref, watch } from 'vue'
import { useMotors, MOTOR_EVENT_TYPES, MOTOR_STATUSES, motorEventLabel, motorStatusLabel } from '../composables/useMotors.js'
import { useDestinations } from '../composables/useDestinations.js'
import { useWorkOrders } from '../composables/useWorkOrders.js'
import { usePeople } from '../composables/usePeople.js'
import { useToast } from '../composables/useToast.js'
import OrdensServicoView from './OrdensServicoView.vue'
import AppButton from '../components/ui/AppButton.vue'
import ConfirmInline from '../components/ui/ConfirmInline.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import StatusBadge from '../components/ui/StatusBadge.vue'

const isLoggedIn = inject('isLoggedIn')

const {
  motors,
  motorEvents,
  loadData,
  addMotor,
  editMotor,
  removeMotor,
  loadEvents,
  addMotorEvent,
  editMotorEvent,
  removeMotorEvent,
} = useMotors()
const { groupedDestinations, getDestFullName } = useDestinations()
const { workOrders } = useWorkOrders()
const { activePeople } = usePeople()
const { success, error } = useToast()

const search = ref('')
const statusFilter = ref('')
const selectedMotorId = ref('')
const showForm = ref(false)
const editingMotorId = ref(null)
const eventFormOpen = ref(false)
const osPanelOpen = ref(false)
const osPrefillMotor = ref(null)
const confirmDeleteMotorId = ref(null)
const editingEventId = ref(null)
const confirmDeleteEventId = ref(null)

const motorForm = ref(emptyMotorForm())
const eventForm = ref(emptyEventForm())
const editEventForm = ref(emptyEventForm())

function emptyMotorForm() {
  return {
    tag: '',
    serial: '',
    name: '',
    manufacturer: '',
    power: '',
    voltage: '',
    rpm: '',
    destinationId: '',
    status: 'ativo',
    notes: '',
  }
}

function emptyEventForm() {
  return {
    eventType: 'revisado',
    eventDate: new Date().toISOString().slice(0, 10),
    workOrderId: '',
    toDestinationId: '',
    toDestination: '',
    performedBy: '',
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
  const q = search.value.trim().toLowerCase()
  return motors.value.filter(m => {
    if (statusFilter.value && m.status !== statusFilter.value) return false
    if (!q) return true
    const haystack = [
      m.tag, m.serial, m.name, m.manufacturer, m.power, m.voltage, m.rpm,
      m.destinationName, m.status, m.notes,
    ].join(' ').toLowerCase()
    return haystack.includes(q)
  })
})

const selectedMotor = computed(() =>
  motors.value.find(m => m.id === selectedMotorId.value) || filteredMotors.value[0] || null
)

const selectedEvents = computed(() =>
  selectedMotor.value ? (motorEvents.value[selectedMotor.value.id] || []) : []
)

const selectedWorkOrders = computed(() =>
  selectedMotor.value ? workOrders.value.filter(wo => wo.motorId === selectedMotor.value.id) : []
)

const motorStats = computed(() => ({
  total: motors.value.length,
  active: motors.value.filter(m => m.status === 'ativo').length,
  maintenance: motors.value.filter(m => m.status === 'em_manutencao').length,
  reserve: motors.value.filter(m => m.status === 'reserva').length,
  inactive: motors.value.filter(m => m.status === 'inativo').length,
}))

watch(selectedMotor, (motor) => {
  if (motor) loadEvents(motor.id).catch(() => {})
}, { immediate: true })

onMounted(() => loadData())

function selectMotor(motor) {
  selectedMotorId.value = motor.id
  eventFormOpen.value = false
  osPanelOpen.value = false
  osPrefillMotor.value = null
  confirmDeleteMotorId.value = null
  editingEventId.value = null
  confirmDeleteEventId.value = null
}

function startNewMotor() {
  editingMotorId.value = null
  motorForm.value = emptyMotorForm()
  showForm.value = true
}

function startEditMotor(motor) {
  editingMotorId.value = motor.id
  motorForm.value = {
    tag: motor.tag,
    serial: motor.serial,
    name: motor.name,
    manufacturer: motor.manufacturer,
    power: motor.power,
    voltage: motor.voltage,
    rpm: motor.rpm,
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
}

async function saveMotor() {
  if (!motorForm.value.tag.trim()) { error('Tag/patrimonio e obrigatorio.'); return }
  try {
    const saved = editingMotorId.value
      ? await editMotor(editingMotorId.value, motorForm.value)
      : await addMotor(motorForm.value)
    selectedMotorId.value = saved.id
    success(editingMotorId.value ? 'Motor atualizado.' : 'Motor cadastrado.')
    cancelMotorForm()
  } catch (e) {
    error(e.message)
  }
}

async function deleteSelectedMotor() {
  if (!selectedMotor.value) return
  try {
    await removeMotor(selectedMotor.value.id)
    success('Motor excluido.')
    selectedMotorId.value = ''
    confirmDeleteMotorId.value = null
    eventFormOpen.value = false
    osPanelOpen.value = false
    osPrefillMotor.value = null
  } catch (e) {
    error(e.message)
  }
}

function openEventForm(type = 'revisado') {
  eventForm.value = { ...emptyEventForm(), eventType: type }
  eventFormOpen.value = true
}

async function saveEvent() {
  if (!selectedMotor.value) return
  try {
    await addMotorEvent(selectedMotor.value.id, eventForm.value)
    success('Evento registrado.')
    eventFormOpen.value = false
  } catch (e) {
    error(e.message)
  }
}

function startEditEvent(ev) {
  editingEventId.value = ev.id
  confirmDeleteEventId.value = null
  editEventForm.value = {
    eventType: ev.eventType,
    eventDate: ev.eventDate?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    workOrderId: ev.workOrderId || '',
    toDestinationId: '',
    toDestination: ev.toDestination || '',
    performedBy: ev.performedBy || '',
    notes: ev.notes || '',
  }
}

function cancelEditEvent() {
  editingEventId.value = null
  editEventForm.value = emptyEventForm()
}

async function saveEditEvent(ev) {
  if (!selectedMotor.value) return
  try {
    await editMotorEvent(selectedMotor.value.id, ev.id, editEventForm.value)
    success('Evento atualizado.')
    cancelEditEvent()
  } catch (e) {
    error(e.message)
  }
}

async function deleteEvent(ev) {
  if (!selectedMotor.value) return
  try {
    await removeMotorEvent(selectedMotor.value.id, ev.id)
    success('Evento excluido.')
    confirmDeleteEventId.value = null
    if (editingEventId.value === ev.id) cancelEditEvent()
  } catch (e) {
    error(e.message)
  }
}

function createWorkOrderForMotor() {
  if (!selectedMotor.value) return
  osPrefillMotor.value = selectedMotor.value
  osPanelOpen.value = true
}

function formatDate(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('pt-BR')
}

function workOrderStatusLabel(order) {
  return order.maintenanceEndDate && order.maintenanceEndTime ? 'Finalizada' : 'Aberta'
}

function workOrderLocationLabel(order) {
  return order.maintenanceLocationName ||
    order.maintenanceDestinationName ||
    order.maintenanceExternalLocation ||
    order.destinationName ||
    '-'
}
</script>

<template>
  <div v-if="selectedMotor && osPanelOpen" class="ds-page-stack">
    <div class="ds-page-header">
      <div>
        <p class="ds-page-kicker">OS de Motor</p>
        <h1 class="ds-page-title">{{ selectedMotor.tag }}</h1>
        <p class="ds-page-subtitle">Ordens, materiais e eventos vinculados a este motor.</p>
      </div>
      <AppButton variant="secondary" @click="osPanelOpen = false; osPrefillMotor = null">Voltar ao motor</AppButton>
    </div>

    <OrdensServicoView
      mode="motor"
      embedded
      :scoped-motor-id="selectedMotor.id"
      :prefill-motor="osPrefillMotor"
      @prefill-consumed="osPrefillMotor = null"
    />
  </div>

  <div v-else class="ds-page-stack">
    <div class="ds-page-header">
      <div>
        <p class="ds-page-kicker">Ativos físicos</p>
        <h1 class="ds-page-title">Motores</h1>
        <p class="ds-page-subtitle">Ficha técnica, localização atual, histórico vitalício e OS de motor em um só lugar.</p>
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

    <div class="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-5">
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
        >Novo</AppButton>
      </div>

      <div class="ds-toolbar grid grid-cols-1 sm:grid-cols-[1fr_150px] gap-2">
        <input
          v-model="search"
          type="text"
          placeholder="Buscar tag, série, local..."
          class="ds-input"
        />
        <select v-model="statusFilter" class="ds-input">
          <option value="">Todos</option>
          <option v-for="s in MOTOR_STATUSES" :key="s.id" :value="s.id">{{ s.label }}</option>
        </select>
      </div>

      <div class="ds-list-panel">
        <button
          v-for="motor in filteredMotors"
          :key="motor.id"
          class="ds-list-row text-left px-4 py-3"
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
      </div>
    </aside>

    <section class="space-y-4">
      <div v-if="showForm" class="ds-panel p-4 space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ editingMotorId ? 'Editar motor' : 'Novo motor' }}</h3>
          <AppButton variant="ghost" size="xs" @click="cancelMotorForm">Cancelar</AppButton>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input v-model="motorForm.tag" placeholder="Tag/patrimônio *" class="ds-input" />
          <input v-model="motorForm.serial" placeholder="Série" class="ds-input" />
          <input v-model="motorForm.name" placeholder="Descrição/nome" class="ds-input" />
          <input v-model="motorForm.manufacturer" placeholder="Fabricante" class="ds-input" />
          <input v-model="motorForm.power" placeholder="Potência" class="ds-input" />
          <input v-model="motorForm.voltage" placeholder="Tensão" class="ds-input" />
          <input v-model="motorForm.rpm" placeholder="RPM" class="ds-input" />
          <select v-if="!editingMotorId" v-model="motorForm.destinationId" class="ds-input">
            <option value="">Sem local</option>
            <option v-for="d in orderedDestinations" :key="d.id" :value="d.id">{{ getDestFullName(d.id) }}</option>
          </select>
          <div v-else class="ds-input bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
            {{ selectedMotor?.destinationName || 'Sem local' }}
          </div>
          <select v-model="motorForm.status" class="ds-input">
            <option v-for="s in MOTOR_STATUSES" :key="s.id" :value="s.id">{{ s.label }}</option>
          </select>
        </div>
        <textarea v-model="motorForm.notes" rows="2" placeholder="Observações" class="ds-input"></textarea>
        <div class="flex justify-end">
          <AppButton variant="primary" @click="saveMotor">Salvar</AppButton>
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
            <div class="mt-2 flex flex-wrap gap-1.5">
              <span class="ds-chip">{{ selectedMotor.destinationName || 'Sem local' }}</span>
              <span v-if="selectedMotor.serial" class="ds-chip">Série {{ selectedMotor.serial }}</span>
              <span v-if="selectedWorkOrders.length" class="ds-chip">{{ selectedWorkOrders.length }} OS</span>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <AppButton v-if="isLoggedIn" variant="secondary" size="sm" @click="startEditMotor(selectedMotor)">Editar</AppButton>
            <AppButton v-if="isLoggedIn" variant="primary" size="sm" @click="createWorkOrderForMotor">Criar OS de Motor</AppButton>
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
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div class="ds-surface p-3"><p class="text-xs text-gray-400">Série</p><p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ selectedMotor.serial || '-' }}</p></div>
              <div class="ds-surface p-3"><p class="text-xs text-gray-400">Potência</p><p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ selectedMotor.power || '-' }}</p></div>
              <div class="ds-surface p-3"><p class="text-xs text-gray-400">Tensão</p><p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ selectedMotor.voltage || '-' }}</p></div>
              <div class="ds-surface p-3"><p class="text-xs text-gray-400">RPM</p><p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ selectedMotor.rpm || '-' }}</p></div>
            </div>

            <div class="grid grid-cols-3 gap-3">
              <div class="ds-surface p-3"><p class="text-xs text-gray-400">Rebobinado</p><p class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ selectedMotor.eventCounts?.rebobinado || 0 }}</p></div>
              <div class="ds-surface p-3"><p class="text-xs text-gray-400">Reformado</p><p class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ selectedMotor.eventCounts?.reformado || 0 }}</p></div>
              <div class="ds-surface p-3"><p class="text-xs text-gray-400">Revisado</p><p class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ selectedMotor.eventCounts?.revisado || 0 }}</p></div>
            </div>

            <div>
              <h3 class="ds-section-heading mb-2">Histórico do motor</h3>
              <div class="rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden">
                <div v-for="ev in selectedEvents" :key="ev.id" class="px-4 py-3">
                  <div class="flex items-center justify-between gap-3">
                    <p class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ motorEventLabel(ev.eventType) }}</p>
                    <span class="text-xs text-gray-400">{{ formatDate(ev.eventDate) }}</span>
                  </div>
                  <p class="text-xs text-gray-500 dark:text-gray-400">
                    <span v-if="ev.performedBy">{{ ev.performedBy }}</span>
                    <span v-if="ev.workOrderId"> · OS vinculada</span>
                    <span v-if="ev.fromDestination || ev.toDestination"> · {{ ev.fromDestination || '-' }} -> {{ ev.toDestination || '-' }}</span>
                  </p>
                  <p v-if="ev.notes" class="text-sm text-gray-600 dark:text-gray-300 mt-1">{{ ev.notes }}</p>
                </div>
                <EmptyState
                  v-if="!selectedEvents.length"
                  title="Sem eventos registrados."
                  text="Eventos entram pela OS de Motor."
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
            <div class="ds-surface p-4">
              <div class="flex items-center justify-between gap-2 mb-2">
                <p class="text-xs font-semibold uppercase text-gray-400">OS do motor</p>
                <AppButton
                  v-if="isLoggedIn"
                  variant="ghost"
                  size="xs"
                  @click="osPanelOpen = true; osPrefillMotor = null"
                >Abrir</AppButton>
              </div>
              <div v-for="wo in selectedWorkOrders" :key="wo.id" class="py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                <div class="flex items-center justify-between gap-2">
                  <p class="text-sm font-medium text-gray-900 dark:text-gray-100">OS #{{ wo.number }}</p>
                  <span class="text-[11px] rounded-full px-2 py-0.5" :class="wo.maintenanceEndDate && wo.maintenanceEndTime ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'">{{ workOrderStatusLabel(wo) }}</span>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400">{{ wo.serviceType }} · {{ wo.requestDate }}</p>
                <p class="text-[11px] text-gray-400 dark:text-gray-500">Local/oficina: {{ workOrderLocationLabel(wo) }}</p>
                <div v-if="wo.items?.length" class="mt-1 space-y-0.5">
                  <p v-for="mat in wo.items" :key="mat.id" class="text-[11px] text-gray-500 dark:text-gray-400">
                    {{ mat.itemName }} - {{ mat.qty }} {{ mat.itemUnit }}
                  </p>
                </div>
              </div>
              <EmptyState
                v-if="!selectedWorkOrders.length"
                title="Nenhuma OS vinculada."
                text="Crie uma OS de motor para registrar serviços e materiais."
              />
            </div>
          </aside>
        </div>
      </div>

    </section>
    </div>

    <datalist id="motor-people-options">
      <option v-for="p in activePeople" :key="p.id" :value="p.name" />
    </datalist>
  </div>
</template>
