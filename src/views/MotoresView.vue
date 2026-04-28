<script setup>
import { computed, inject, onMounted, ref, watch } from 'vue'
import { useMotors, MOTOR_EVENT_TYPES, MOTOR_STATUSES, motorEventLabel, motorStatusLabel } from '../composables/useMotors.js'
import { useDestinations } from '../composables/useDestinations.js'
import { useWorkOrders } from '../composables/useWorkOrders.js'
import { usePeople } from '../composables/usePeople.js'
import { useToast } from '../composables/useToast.js'
import OrdensServicoView from './OrdensServicoView.vue'

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
</script>

<template>
  <div class="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-5">
    <aside class="space-y-3">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">Motores</h2>
          <p class="text-xs text-gray-400 dark:text-gray-500">{{ motors.length }} motor{{ motors.length !== 1 ? 'es' : '' }}</p>
        </div>
        <button
          v-if="isLoggedIn"
          class="px-3 py-2 text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          @click="startNewMotor"
        >Novo</button>
      </div>

      <div class="grid grid-cols-[1fr_150px] gap-2">
        <input
          v-model="search"
          type="text"
          placeholder="Buscar tag, serie, local..."
          class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />
        <select v-model="statusFilter" class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
          <option value="">Todos</option>
          <option v-for="s in MOTOR_STATUSES" :key="s.id" :value="s.id">{{ s.label }}</option>
        </select>
      </div>

      <div class="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800">
        <button
          v-for="motor in filteredMotors"
          :key="motor.id"
          class="w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
          :class="selectedMotor?.id === motor.id ? 'bg-primary-50 dark:bg-primary-900/20' : ''"
          @click="selectMotor(motor)"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="font-semibold text-sm text-gray-900 dark:text-gray-100">{{ motor.tag }}</span>
            <span
              class="text-[11px] px-2 py-0.5 rounded-full"
              :class="{
                'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300': motor.status === 'ativo',
                'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300': motor.status === 'em_manutencao',
                'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300': motor.status === 'reserva',
                'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300': motor.status === 'inativo',
              }"
            >{{ motorStatusLabel(motor.status) }}</span>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400 truncate">{{ motor.name || motor.manufacturer || 'Sem descricao' }}</p>
          <p class="text-[11px] text-gray-400 dark:text-gray-500 truncate">{{ motor.destinationName || 'Sem local' }}</p>
        </button>
        <div v-if="!filteredMotors.length" class="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
          Nenhum motor encontrado.
        </div>
      </div>
    </aside>

    <section class="space-y-4">
      <div v-if="showForm" class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ editingMotorId ? 'Editar motor' : 'Novo motor' }}</h3>
          <button class="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300" @click="cancelMotorForm">Cancelar</button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input v-model="motorForm.tag" placeholder="Tag/patrimonio *" class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
          <input v-model="motorForm.serial" placeholder="Serie" class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
          <input v-model="motorForm.name" placeholder="Descricao/nome" class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
          <input v-model="motorForm.manufacturer" placeholder="Fabricante" class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
          <input v-model="motorForm.power" placeholder="Potencia" class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
          <input v-model="motorForm.voltage" placeholder="Tensao" class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
          <input v-model="motorForm.rpm" placeholder="RPM" class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
          <select v-model="motorForm.destinationId" class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
            <option value="">Sem local</option>
            <option v-for="d in orderedDestinations" :key="d.id" :value="d.id">{{ getDestFullName(d.id) }}</option>
          </select>
          <select v-model="motorForm.status" class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
            <option v-for="s in MOTOR_STATUSES" :key="s.id" :value="s.id">{{ s.label }}</option>
          </select>
        </div>
        <textarea v-model="motorForm.notes" rows="2" placeholder="Observacoes" class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"></textarea>
        <div class="flex justify-end">
          <button class="px-4 py-2 text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors" @click="saveMotor">Salvar</button>
        </div>
      </div>

      <div v-if="selectedMotor" class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">{{ selectedMotor.tag }}</h2>
            <p class="text-sm text-gray-500 dark:text-gray-400">{{ selectedMotor.name || 'Motor sem descricao' }}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button v-if="isLoggedIn" class="px-3 py-2 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200" @click="startEditMotor(selectedMotor)">Editar</button>
            <button v-if="isLoggedIn" class="px-3 py-2 text-sm rounded-lg bg-primary-600 text-white" @click="createWorkOrderForMotor">Criar OS de Motor</button>
            <button v-if="isLoggedIn" class="px-3 py-2 text-sm rounded-lg bg-amber-600 text-white" @click="openEventForm('revisado')">Registrar evento</button>
            <button
              v-if="isLoggedIn && confirmDeleteMotorId !== selectedMotor.id"
              class="px-3 py-2 text-sm rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300"
              @click="confirmDeleteMotorId = selectedMotor.id"
            >Excluir</button>
            <template v-else-if="isLoggedIn">
              <span class="self-center text-xs text-red-600 dark:text-red-400">Excluir este motor?</span>
              <button class="px-3 py-2 text-sm rounded-lg bg-red-600 text-white" @click="deleteSelectedMotor">Sim</button>
              <button class="px-3 py-2 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200" @click="confirmDeleteMotorId = null">Nao</button>
            </template>
          </div>
        </div>

        <div class="p-5 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
          <div class="space-y-4">
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div class="rounded-lg bg-gray-50 dark:bg-gray-900/40 p-3"><p class="text-xs text-gray-400">Serie</p><p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ selectedMotor.serial || '-' }}</p></div>
              <div class="rounded-lg bg-gray-50 dark:bg-gray-900/40 p-3"><p class="text-xs text-gray-400">Potencia</p><p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ selectedMotor.power || '-' }}</p></div>
              <div class="rounded-lg bg-gray-50 dark:bg-gray-900/40 p-3"><p class="text-xs text-gray-400">Tensao</p><p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ selectedMotor.voltage || '-' }}</p></div>
              <div class="rounded-lg bg-gray-50 dark:bg-gray-900/40 p-3"><p class="text-xs text-gray-400">RPM</p><p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ selectedMotor.rpm || '-' }}</p></div>
            </div>

            <div class="grid grid-cols-3 gap-3">
              <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p class="text-xs text-gray-400">Rebobinado</p><p class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ selectedMotor.eventCounts?.rebobinado || 0 }}</p></div>
              <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p class="text-xs text-gray-400">Reformado</p><p class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ selectedMotor.eventCounts?.reformado || 0 }}</p></div>
              <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p class="text-xs text-gray-400">Revisado</p><p class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ selectedMotor.eventCounts?.revisado || 0 }}</p></div>
            </div>

            <div v-if="eventFormOpen" class="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-900/10 p-4 space-y-3">
              <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                <select v-model="eventForm.eventType" class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                  <option v-for="t in MOTOR_EVENT_TYPES" :key="t.id" :value="t.id">{{ t.label }}</option>
                </select>
                <input v-model="eventForm.eventDate" type="date" class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                <input v-model="eventForm.performedBy" list="motor-people-options" placeholder="Executado por" class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select v-model="eventForm.workOrderId" class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                  <option value="">Sem OS vinculada</option>
                  <option v-for="wo in selectedWorkOrders" :key="wo.id" :value="wo.id">OS #{{ wo.number }} - {{ wo.title }}</option>
                </select>
                <select v-model="eventForm.toDestinationId" class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                  <option value="">Sem mudanca de local</option>
                  <option v-for="d in orderedDestinations" :key="d.id" :value="d.id">{{ getDestFullName(d.id) }}</option>
                </select>
              </div>
              <textarea v-model="eventForm.notes" rows="2" placeholder="Observacoes do evento" class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"></textarea>
              <div class="flex justify-end gap-2">
                <button class="px-3 py-2 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200" @click="eventFormOpen = false">Cancelar</button>
                <button class="px-3 py-2 text-sm rounded-lg bg-amber-600 text-white" @click="saveEvent">Salvar evento</button>
              </div>
            </div>

            <div>
              <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Historico</h3>
              <div class="rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden">
                <div v-for="ev in selectedEvents" :key="ev.id" class="px-4 py-3">
                  <div v-if="editingEventId === ev.id" class="space-y-3">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <select v-model="editEventForm.eventType" class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                        <option v-for="t in MOTOR_EVENT_TYPES" :key="t.id" :value="t.id">{{ t.label }}</option>
                      </select>
                      <input v-model="editEventForm.eventDate" type="date" class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                      <input v-model="editEventForm.performedBy" list="motor-people-options" placeholder="Executado por" class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <select v-model="editEventForm.workOrderId" class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                        <option value="">Sem OS vinculada</option>
                        <option v-for="wo in selectedWorkOrders" :key="wo.id" :value="wo.id">OS #{{ wo.number }} - {{ wo.title }}</option>
                      </select>
                      <select v-model="editEventForm.toDestinationId" class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                        <option value="">Manter local registrado</option>
                        <option v-for="d in orderedDestinations" :key="d.id" :value="d.id">{{ getDestFullName(d.id) }}</option>
                      </select>
                    </div>
                    <textarea v-model="editEventForm.notes" rows="2" placeholder="Observacoes do evento" class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"></textarea>
                    <div class="flex justify-end gap-2">
                      <button class="px-3 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200" @click="cancelEditEvent">Cancelar</button>
                      <button class="px-3 py-1.5 text-xs rounded-lg bg-primary-600 text-white" @click="saveEditEvent(ev)">Salvar</button>
                    </div>
                  </div>
                  <template v-else>
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
                    <div v-if="isLoggedIn" class="flex justify-end gap-2 mt-2">
                      <button class="text-xs text-gray-500 hover:text-primary-600 dark:hover:text-primary-400" @click="startEditEvent(ev)">Editar</button>
                      <template v-if="confirmDeleteEventId === ev.id">
                        <span class="text-xs text-red-500">Excluir?</span>
                        <button class="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline" @click="deleteEvent(ev)">Sim</button>
                        <button class="text-xs text-gray-500 hover:underline" @click="confirmDeleteEventId = null">Nao</button>
                      </template>
                      <button v-else class="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400" @click="confirmDeleteEventId = ev.id">Excluir</button>
                    </div>
                  </template>
                </div>
                <div v-if="!selectedEvents.length" class="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">Sem eventos registrados.</div>
              </div>
            </div>
          </div>

          <aside class="space-y-3">
            <div class="rounded-lg bg-gray-50 dark:bg-gray-900/40 p-4">
              <p class="text-xs text-gray-400">Local atual</p>
              <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ selectedMotor.destinationName || 'Sem local' }}</p>
            </div>
            <div class="rounded-lg bg-gray-50 dark:bg-gray-900/40 p-4">
              <p class="text-xs text-gray-400">Fabricante</p>
              <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ selectedMotor.manufacturer || '-' }}</p>
            </div>
            <div class="rounded-lg bg-gray-50 dark:bg-gray-900/40 p-4">
              <p class="text-xs text-gray-400">Observacoes</p>
              <p class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{{ selectedMotor.notes || '-' }}</p>
            </div>
            <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div class="flex items-center justify-between gap-2 mb-2">
                <p class="text-xs font-semibold uppercase text-gray-400">OS do motor</p>
                <button
                  v-if="isLoggedIn"
                  class="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                  @click="osPanelOpen = true; osPrefillMotor = null"
                >Abrir</button>
              </div>
              <div v-for="wo in selectedWorkOrders" :key="wo.id" class="py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                <p class="text-sm font-medium text-gray-900 dark:text-gray-100">OS #{{ wo.number }}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">{{ wo.serviceType }} · {{ wo.requestDate }}</p>
                <div v-if="wo.items?.length" class="mt-1 space-y-0.5">
                  <p v-for="mat in wo.items" :key="mat.id" class="text-[11px] text-gray-500 dark:text-gray-400">
                    {{ mat.itemName }} - {{ mat.qty }} {{ mat.itemUnit }}
                  </p>
                </div>
              </div>
              <p v-if="!selectedWorkOrders.length" class="text-sm text-gray-400 dark:text-gray-500">Nenhuma OS vinculada.</p>
            </div>
          </aside>
        </div>
      </div>

      <div v-if="selectedMotor && osPanelOpen" class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">OS de Motor - {{ selectedMotor.tag }}</h3>
            <p class="text-xs text-gray-500 dark:text-gray-400">Serviços e materiais consumidos neste motor</p>
          </div>
          <button class="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300" @click="osPanelOpen = false; osPrefillMotor = null">Fechar</button>
        </div>
        <OrdensServicoView
          mode="motor"
          embedded
          :scoped-motor-id="selectedMotor.id"
          :prefill-motor="osPrefillMotor"
          @prefill-consumed="osPrefillMotor = null"
        />
      </div>
    </section>

    <datalist id="motor-people-options">
      <option v-for="p in activePeople" :key="p.id" :value="p.name" />
    </datalist>
  </div>
</template>
