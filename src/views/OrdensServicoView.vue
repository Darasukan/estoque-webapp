<script setup>
import { ref, computed, watch, nextTick, inject } from 'vue'
import { useWorkOrders } from '../composables/useWorkOrders.js'
import { useItems } from '../composables/useItems.js'
import { useDestinations } from '../composables/useDestinations.js'
import { usePeople } from '../composables/usePeople.js'
import { useMovements } from '../composables/useMovements.js'
import { useToast } from '../composables/useToast.js'

const isLoggedIn = inject('isLoggedIn')
const {
  workOrders, report,
  loadData, loadReport,
  addWorkOrder, editWorkOrder, deleteWorkOrder,
  addMaterial, removeMaterial
} = useWorkOrders()

const { items, variations, getVariationsForItem } = useItems()
const { groupedDestinations, getDestFullName } = useDestinations()
const { activePeople } = usePeople()
const { movements } = useMovements()
const { success, error: showError } = useToast()

// ===== Sub-tabs =====
const activeSubTab = ref('ordens') // 'ordens' | 'resumo'

// ===== OS List =====
const searchQuery = ref('')
const expandedOrderId = ref(null)
const showNewForm = ref(false)
const editingOrderId = ref(null)
const confirmDeleteId = ref(null)

// ===== New/Edit OS form =====
const osForm = ref({ title: '', destinationId: '', requestedBy: '', note: '' })
const destDropdownOpen = ref(false)
const destSearch = ref('')
const personDropdownOpen = ref(false)

function resetOsForm() {
  osForm.value = { title: '', destinationId: '', requestedBy: '', note: '' }
  destDropdownOpen.value = false
  destSearch.value = ''
  personDropdownOpen.value = false
}

// ===== "Add Material" flow inside an OS =====
const addingMaterialToId = ref(null)
const matStep = ref(1) // 1: search | 2: pick variation | 3: qty
const matSearch = ref('')
const matSelectedItem = ref(null)
const matSelectedVariation = ref(null)
const matQty = ref('')
const matSearchEl = ref(null)
const matQtyEl = ref(null)
const confirmRemoveItemId = ref(null) // work_order_item id to confirm removal

function startAddMaterial(orderId) {
  addingMaterialToId.value = orderId
  matStep.value = 1
  matSearch.value = ''
  matSelectedItem.value = null
  matSelectedVariation.value = null
  matQty.value = ''
  nextTick(() => matSearchEl.value?.focus())
}

function cancelAddMaterial() {
  addingMaterialToId.value = null
}

// ===== Destination list helpers =====
const orderedDestinations = computed(() => {
  const list = []
  for (const g of groupedDestinations.value) {
    list.push(g.parent)
    for (const c of g.children) list.push(c)
  }
  return list
})

const filteredDests = computed(() => {
  const q = destSearch.value.trim().toLowerCase()
  if (!q) return orderedDestinations.value
  return orderedDestinations.value.filter(d => getDestFullName(d.id).toLowerCase().includes(q))
})

// ===== Item search for material =====
const matSearchNorm = computed(() => matSearch.value.trim().toLowerCase())
const matItemResults = computed(() => {
  const q = matSearchNorm.value
  if (!q) return []
  return items.value.filter(item => {
    return item.name.toLowerCase().includes(q) ||
      (item.group || '').toLowerCase().includes(q) ||
      (item.category || '').toLowerCase().includes(q) ||
      (item.subcategory || '').toLowerCase().includes(q)
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
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return workOrders.value
  return workOrders.value.filter(o =>
    o.title.toLowerCase().includes(q) ||
    (o.destinationName || '').toLowerCase().includes(q) ||
    (o.requestedBy || '').toLowerCase().includes(q) ||
    String(o.number).includes(q)
  )
})

// ===== Actions =====
async function handleCreateOS() {
  if (!osForm.value.title.trim()) { showError('Título é obrigatório'); return }
  try {
    await addWorkOrder(osForm.value)
    success('Ordem de serviço criada')
    showNewForm.value = false
    resetOsForm()
  } catch (e) { showError(e.message) }
}

async function handleEditOS(id) {
  if (!osForm.value.title.trim()) { showError('Título é obrigatório'); return }
  try {
    await editWorkOrder(id, osForm.value)
    success('Ordem de serviço atualizada')
    editingOrderId.value = null
    resetOsForm()
  } catch (e) { showError(e.message) }
}

function startEditOS(order) {
  editingOrderId.value = order.id
  osForm.value = {
    title: order.title,
    destinationId: order.destinationId,
    requestedBy: order.requestedBy,
    note: order.note,
  }
}

function cancelEdit() {
  editingOrderId.value = null
  resetOsForm()
}

async function handleDeleteOS(id) {
  try {
    await deleteWorkOrder(id)
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
    // Update local variation stock
    const liveVar = variations.value.find(v => v.id === matSelectedVariation.value.id)
    if (liveVar) liveVar.stock = result.newStock
    // Add implicit movement to movements list
    if (result.movement) {
      movements.value.unshift(result.movement)
    }
    success('Material adicionado à OS')
    cancelAddMaterial()
  } catch (e) { showError(e.message) }
}

async function handleRemoveMaterial(workOrderId, woiId) {
  try {
    const result = await removeMaterial(workOrderId, woiId)
    // Update local variation stock
    if (result.variationId && result.newStock !== null) {
      const liveVar = variations.value.find(v => v.id === result.variationId)
      if (liveVar) liveVar.stock = result.newStock
    }
    // Remove implicit movement locally
    if (result.removedMovementId) {
      const idx = movements.value.findIndex(m => m.id === result.removedMovementId)
      if (idx !== -1) movements.value.splice(idx, 1)
    }
    success('Material removido da OS')
    confirmRemoveItemId.value = null
  } catch (e) { showError(e.message) }
}

// ===== Report =====
const expandedReportDest = ref(null)

watch(activeSubTab, (tab) => {
  if (tab === 'resumo') loadReport()
})

// ===== Helpers =====
function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function variationLabel(v) {
  const vals = v.variationValues || v.values || {}
  const parts = Object.entries(vals).map(([k, val]) => `${k}: ${val}`).filter(Boolean)
  return parts.length ? parts.join(' · ') : '—'
}

function hierarchyLabel(item) {
  return [item.group, item.category, item.subcategory].filter(Boolean).join(' › ')
}

function toggleOrder(id) {
  expandedOrderId.value = expandedOrderId.value === id ? null : id
}

function selectDest(dest) {
  osForm.value.destinationId = dest.id
  destDropdownOpen.value = false
  destSearch.value = ''
}

function selectPerson(p) {
  osForm.value.requestedBy = p.name
  personDropdownOpen.value = false
}

function selectMatItem(item) {
  matSelectedItem.value = item
  matStep.value = 2
}

function selectMatVariation(v) {
  matSelectedVariation.value = v
  matStep.value = 3
  nextTick(() => matQtyEl.value?.focus())
}

function matBackToStep1() {
  matSelectedItem.value = null
  matSelectedVariation.value = null
  matStep.value = 1
  nextTick(() => matSearchEl.value?.focus())
}

function matBackToStep2() {
  matSelectedVariation.value = null
  matStep.value = 2
}

function destDisplayName(destId) {
  if (!destId) return '—'
  return getDestFullName(destId) || destId
}
</script>

<template>
  <div class="space-y-4">

    <!-- Header -->
    <div>
      <h1 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Ordens de Serviço</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Gerencie OS vinculadas a destinos e rastreie materiais utilizados</p>
    </div>

    <!-- Sub-tabs -->
    <div class="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700">
      <button
        v-for="tab in [
          { id: 'ordens', label: 'Ordens de Serviço', icon: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.251 2.251 0 011.65.762m-5.8 0c-.376.023-.75.05-1.124.08C8.845 4.013 8 4.974 8 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z' },
          { id: 'resumo', label: 'Resumo por Destino', icon: 'M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605' }
        ]"
        :key="tab.id"
        class="flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors relative"
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

    <!-- ================================================= -->
    <!-- TAB: Ordens de Serviço                            -->
    <!-- ================================================= -->
    <template v-if="activeSubTab === 'ordens'">

      <!-- Search + New button -->
      <div class="flex items-center gap-3">
        <div class="relative flex-1">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Buscar por título, destino, responsável ou número..."
            class="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <button
          v-if="isLoggedIn"
          class="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors whitespace-nowrap"
          @click="showNewForm = !showNewForm; if (showNewForm) resetOsForm()"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Nova OS
        </button>
      </div>

      <!-- New OS form -->
      <div v-if="showNewForm" class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Nova Ordem de Serviço</h3>

        <!-- Title -->
        <div>
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Título / Descrição *</label>
          <input v-model="osForm.title" type="text" class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent" placeholder="Descrição da ordem de serviço" @keydown.enter="handleCreateOS" />
        </div>

        <!-- Destination -->
        <div class="relative">
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Destino (Máquina)</label>
          <button
            type="button"
            class="w-full text-left px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            @click="destDropdownOpen = !destDropdownOpen"
          >
            {{ osForm.destinationId ? destDisplayName(osForm.destinationId) : 'Selecionar destino...' }}
          </button>
          <div v-if="destDropdownOpen" class="absolute z-20 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            <input v-model="destSearch" type="text" placeholder="Filtrar..." class="w-full px-3 py-2 text-sm border-b border-gray-200 dark:border-gray-700 bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none" />
            <button
              v-for="d in filteredDests"
              :key="d.id"
              class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              :class="d.parentId ? 'pl-6' : ''"
              @click="selectDest(d)"
            >{{ getDestFullName(d.id) }}</button>
            <div v-if="!filteredDests.length" class="px-3 py-2 text-sm text-gray-400">Nenhum destino encontrado</div>
          </div>
        </div>

        <!-- Requested by -->
        <div class="relative">
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Responsável / Solicitante</label>
          <button
            type="button"
            class="w-full text-left px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            @click="personDropdownOpen = !personDropdownOpen"
          >
            {{ osForm.requestedBy || 'Selecionar responsável...' }}
          </button>
          <div v-if="personDropdownOpen" class="absolute z-20 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            <button
              v-for="p in activePeople"
              :key="p.id"
              class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              @click="selectPerson(p)"
            >{{ p.name }}</button>
            <div v-if="!activePeople.length" class="px-3 py-2 text-sm text-gray-400">Nenhuma pessoa cadastrada</div>
          </div>
        </div>

        <!-- Note -->
        <div>
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Observações</label>
          <textarea v-model="osForm.note" rows="2" class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent" placeholder="Notas adicionais..."></textarea>
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-2 pt-1">
          <button class="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors" @click="handleCreateOS">Criar OS</button>
          <button class="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" @click="showNewForm = false; resetOsForm()">Cancelar</button>
        </div>
      </div>

      <!-- Orders list -->
      <div v-if="filteredOrders.length === 0" class="text-center py-12 text-gray-400 dark:text-gray-500">
        <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" stroke-width="1" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.251 2.251 0 011.65.762m-5.8 0c-.376.023-.75.05-1.124.08C8.845 4.013 8 4.974 8 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" /></svg>
        <p class="text-sm">{{ searchQuery ? 'Nenhuma OS encontrada' : 'Nenhuma ordem de serviço cadastrada' }}</p>
      </div>

      <div v-else class="space-y-2">
        <div
          v-for="order in filteredOrders"
          :key="order.id"
          class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
        >
          <!-- Order header row -->
          <div
            class="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
            @click="toggleOrder(order.id)"
          >
            <!-- Expand chevron -->
            <svg
              class="w-4 h-4 text-gray-400 transition-transform flex-shrink-0"
              :class="expandedOrderId === order.id ? 'rotate-90' : ''"
              fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
            ><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>

            <!-- Number badge -->
            <span class="text-xs font-bold px-2 py-0.5 rounded bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-400 whitespace-nowrap">
              OS #{{ order.number }}
            </span>

            <!-- Title -->
            <span class="text-sm font-medium text-gray-900 dark:text-gray-100 flex-1 truncate">{{ order.title }}</span>

            <!-- Destination -->
            <span v-if="order.destinationName" class="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
              {{ order.destinationName }}
            </span>

            <!-- Material count -->
            <span class="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
              {{ (order.items || []).length }} {{ (order.items || []).length === 1 ? 'material' : 'materiais' }}
            </span>

            <!-- Date -->
            <span class="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">{{ formatDate(order.createdAt) }}</span>
          </div>

          <!-- Expanded detail -->
          <div v-if="expandedOrderId === order.id" class="border-t border-gray-200 dark:border-gray-700 px-4 py-3 space-y-3">

            <!-- Edit form or details -->
            <template v-if="editingOrderId === order.id">
              <div class="space-y-3">
                <div>
                  <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Título *</label>
                  <input v-model="osForm.title" type="text" class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent" @keydown.enter="handleEditOS(order.id)" />
                </div>
                <div class="relative">
                  <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Destino</label>
                  <button type="button" class="w-full text-left px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" @click="destDropdownOpen = !destDropdownOpen">
                    {{ osForm.destinationId ? destDisplayName(osForm.destinationId) : 'Selecionar destino...' }}
                  </button>
                  <div v-if="destDropdownOpen" class="absolute z-20 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    <input v-model="destSearch" type="text" placeholder="Filtrar..." class="w-full px-3 py-2 text-sm border-b border-gray-200 dark:border-gray-700 bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none" />
                    <button v-for="d in filteredDests" :key="d.id" class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700" :class="d.parentId ? 'pl-6' : ''" @click="selectDest(d)">{{ getDestFullName(d.id) }}</button>
                  </div>
                </div>
                <div class="relative">
                  <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Responsável</label>
                  <button type="button" class="w-full text-left px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" @click="personDropdownOpen = !personDropdownOpen">
                    {{ osForm.requestedBy || 'Selecionar...' }}
                  </button>
                  <div v-if="personDropdownOpen" class="absolute z-20 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    <button v-for="p in activePeople" :key="p.id" class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700" @click="selectPerson(p)">{{ p.name }}</button>
                  </div>
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Observações</label>
                  <textarea v-model="osForm.note" rows="2" class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"></textarea>
                </div>
                <div class="flex gap-2">
                  <button class="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg" @click="handleEditOS(order.id)">Salvar</button>
                  <button class="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg" @click="cancelEdit">Cancelar</button>
                </div>
              </div>
            </template>

            <template v-else>
              <!-- OS info -->
              <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <span class="text-xs text-gray-400 dark:text-gray-500">Destino</span>
                  <p class="text-gray-900 dark:text-gray-100">{{ order.destinationName || '—' }}</p>
                </div>
                <div>
                  <span class="text-xs text-gray-400 dark:text-gray-500">Responsável</span>
                  <p class="text-gray-900 dark:text-gray-100">{{ order.requestedBy || '—' }}</p>
                </div>
                <div>
                  <span class="text-xs text-gray-400 dark:text-gray-500">Data</span>
                  <p class="text-gray-900 dark:text-gray-100">{{ formatDate(order.createdAt) }}</p>
                </div>
                <div>
                  <span class="text-xs text-gray-400 dark:text-gray-500">Observações</span>
                  <p class="text-gray-900 dark:text-gray-100">{{ order.note || '—' }}</p>
                </div>
              </div>

              <!-- Action buttons -->
              <div v-if="isLoggedIn" class="flex items-center gap-2">
                <button class="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" @click="startEditOS(order)">
                  <svg class="w-3.5 h-3.5 inline mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>
                  Editar
                </button>
                <button class="px-3 py-1.5 text-xs font-medium text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors" @click="startAddMaterial(order.id)">
                  <svg class="w-3.5 h-3.5 inline mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                  Adicionar Material
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

              <!-- Add material flow -->
              <div v-if="addingMaterialToId === order.id" class="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-3">
                <div class="flex items-center justify-between">
                  <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Adicionar Material</h4>
                  <button class="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" @click="cancelAddMaterial">✕ Fechar</button>
                </div>

                <!-- Step 1: Search item -->
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

                <!-- Step 2: Pick variation -->
                <template v-else-if="matStep === 2">
                  <div class="flex items-center gap-2 mb-2">
                    <button class="text-xs text-primary-600 dark:text-primary-400 hover:underline" @click="matBackToStep1">← Voltar</button>
                    <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ matSelectedItem.name }}</span>
                  </div>
                  <div v-if="matItemVariations.length" class="space-y-1 max-h-48 overflow-y-auto">
                    <button
                      v-for="v in matItemVariations"
                      :key="v.id"
                      class="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between"
                      @click="selectMatVariation(v)"
                    >
                      <span class="text-gray-900 dark:text-gray-100">{{ variationLabel(v) }}</span>
                      <span class="text-xs" :class="v.stock > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'">
                        Estoque: {{ v.stock }} {{ matSelectedItem.unit }}
                      </span>
                    </button>
                  </div>
                  <p v-else class="text-sm text-gray-400">Nenhuma variação encontrada</p>
                </template>

                <!-- Step 3: Qty -->
                <template v-else-if="matStep === 3">
                  <div class="flex items-center gap-2 mb-2">
                    <button class="text-xs text-primary-600 dark:text-primary-400 hover:underline" @click="matBackToStep2">← Voltar</button>
                    <span class="text-sm text-gray-900 dark:text-gray-100">{{ matSelectedItem.name }} · {{ variationLabel(matSelectedVariation) }}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <div class="flex-1">
                      <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Quantidade ({{ matSelectedItem.unit }})</label>
                      <input
                        ref="matQtyEl"
                        v-model="matQty"
                        type="number"
                        min="0.01"
                        step="any"
                        class="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        :class="matExceedsStock ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'"
                        @keydown.enter="handleAddMaterial"
                      />
                      <p v-if="matExceedsStock" class="text-xs text-red-500 mt-1">Estoque insuficiente (disponível: {{ matSelectedVariation.stock }})</p>
                    </div>
                    <button
                      :disabled="!matParsedQty || matExceedsStock"
                      class="mt-5 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
                      @click="handleAddMaterial"
                    >Adicionar</button>
                  </div>
                </template>
              </div>

              <!-- Materials list -->
              <div v-if="order.items && order.items.length">
                <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Materiais Utilizados</h4>
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
              <div v-else class="text-sm text-gray-400 dark:text-gray-500 italic">Nenhum material adicionado a esta OS</div>
            </template>
          </div>
        </div>
      </div>
    </template>

    <!-- ================================================= -->
    <!-- TAB: Resumo por Destino                           -->
    <!-- ================================================= -->
    <template v-if="activeSubTab === 'resumo'">

      <div v-if="!report.length" class="text-center py-12 text-gray-400 dark:text-gray-500">
        <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" stroke-width="1" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" /></svg>
        <p class="text-sm">Nenhum dado de destino encontrado</p>
      </div>

      <div v-else class="space-y-2">
        <div
          v-for="dest in report"
          :key="dest.destinationName"
          class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
        >
          <!-- Destination header -->
          <div
            class="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
            @click="expandedReportDest = expandedReportDest === dest.destinationName ? null : dest.destinationName"
          >
            <svg
              class="w-4 h-4 text-gray-400 transition-transform flex-shrink-0"
              :class="expandedReportDest === dest.destinationName ? 'rotate-90' : ''"
              fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
            ><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>

            <span class="text-sm font-medium text-gray-900 dark:text-gray-100 flex-1">{{ dest.destinationName }}</span>
            <span class="text-xs text-gray-400 dark:text-gray-500">
              {{ dest.orders.length }} OS · {{ dest.looseSaidas.length }} saídas avulsas · {{ dest.materialTotals.length }} materiais
            </span>
          </div>

          <!-- Expanded -->
          <div v-if="expandedReportDest === dest.destinationName" class="border-t border-gray-200 dark:border-gray-700 px-4 py-3 space-y-4">

            <!-- Total materials summary -->
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

            <!-- Linked work orders -->
            <div v-if="dest.orders.length">
              <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Ordens de Serviço</h4>
              <div class="space-y-2">
                <div v-for="wo in dest.orders" :key="wo.id" class="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-3">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="text-xs font-bold px-1.5 py-0.5 rounded bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-400">OS #{{ wo.number }}</span>
                    <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ wo.title }}</span>
                    <span class="text-xs text-gray-400 ml-auto">{{ formatDate(wo.createdAt) }}</span>
                  </div>
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
                  <p v-else class="text-xs text-gray-400 italic mt-1">Sem materiais</p>
                </div>
              </div>
            </div>

            <!-- Loose saidas -->
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
                      <td class="py-1.5 pr-3 text-gray-600 dark:text-gray-400">{{ s.requestedBy || '—' }}</td>
                      <td class="py-1.5 text-gray-400 dark:text-gray-500 text-xs">{{ formatDate(s.date) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <p v-if="!dest.materialTotals.length" class="text-sm text-gray-400 italic">Nenhum material registrado para este destino</p>
          </div>
        </div>
      </div>
    </template>

  </div>
</template>
