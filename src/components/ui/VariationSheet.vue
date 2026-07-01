<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { stockAlertStatus, useItems } from '../../composables/useItems.js'
import { useDestinations } from '../../composables/useDestinations.js'
import { useToast } from '../../composables/useToast.js'
import { extrasListToObject, validateVariationForm, variationFormForEdit } from '../../utils/variationForm.js'
import { summarizeVariationMovements } from '../../utils/variationMovementStats.js'
import DestinationTreePicker from './DestinationTreePicker.vue'

const props = defineProps({
  item: { type: Object, required: true },
  variation: { type: Object, required: true },
  movements: { type: Array, default: () => [] },
  workOrders: { type: Array, default: () => [] },
  canManage: { type: Boolean, default: false },
  canAdjust: { type: Boolean, default: false },
  canEditDetails: { type: Boolean, default: false },
  initialTab: { type: String, default: 'data' },
})

const emit = defineEmits(['close', 'quick-movement', 'adjust-stock', 'open-work-order'])
const { getDestFullName } = useDestinations()
const { editVariation } = useItems()
const { success, error } = useToast()

const activeTab = ref(props.initialTab)
const dialogRef = ref(null)
const adjustOpen = ref(false)
const adjustValue = ref('')
const editForm = ref(variationFormForEdit(props.item, props.variation))
const editSaving = ref(false)

onMounted(async () => {
  await nextTick()
  if (dialogRef.value && !dialogRef.value.open) dialogRef.value.showModal()
})
onUnmounted(() => dialogRef.value?.close())

const status = computed(() => stockAlertStatus(props.variation, props.item))

const statusConfig = {
  zero: { label: 'Sem estoque', pillClass: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' },
  critical: { label: 'Crítico', pillClass: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' },
  alert: { label: 'Alerta', pillClass: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-500' },
  ok: { label: 'OK', pillClass: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' },
}

const hierarchy = computed(() =>
  [props.item.group, props.item.category, props.item.subcategory].filter(Boolean).join(' › ')
)

const variationTags = computed(() => {
  const attrs = (props.item.attributes || [])
    .map(key => ({ key, value: props.variation.values?.[key] || '' }))
    .filter(tag => tag.value)
  const extras = Object.entries(props.variation.extras || {})
    .map(([key, value]) => ({ key, value }))
    .filter(tag => tag.value)
  return [...attrs, ...extras]
})

const sortedMovements = computed(() =>
  props.movements
    .filter(m => m.variationId === props.variation.id)
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
)

const recentSupplier = computed(() =>
  sortedMovements.value.find(m => m.type === 'entrada' && String(m.supplier || '').trim())?.supplier || '-'
)

const movementStats = computed(() => summarizeVariationMovements(sortedMovements.value))

const lastUnitCost = computed(() =>
  sortedMovements.value.find(m =>
    m.type === 'entrada' &&
    m.unitCost !== null &&
    m.unitCost !== undefined &&
    m.unitCost !== '' &&
    Number.isFinite(Number(m.unitCost))
  )?.unitCost ?? null
)

const lastWithdrawalBy = computed(() =>
  sortedMovements.value.find(m => m.type === 'saida' && String(m.requestedBy || '').trim())?.requestedBy || '-'
)

const linkedDestinations = computed(() =>
  (props.variation.destinations || [])
    .map(id => getDestFullName(id))
    .filter(Boolean)
)
const linkedLocations = computed(() => {
  if (props.variation.locations?.length) return props.variation.locations
  return [props.variation.location || props.item.location].filter(Boolean)
})

const relatedOrders = computed(() => props.workOrders.filter(order =>
  (order.items || []).some(row => row.variationId === props.variation.id)
))

function resetEditForm() {
  editForm.value = variationFormForEdit(props.item, props.variation)
}

watch(() => props.variation.id, () => {
  activeTab.value = props.initialTab === 'info' || (props.initialTab === 'edit' && !props.canEditDetails)
    ? 'data'
    : props.initialTab
  resetEditForm()
}, { immediate: true })

watch(() => props.initialTab, tab => {
  activeTab.value = tab === 'info' || (tab === 'edit' && !props.canEditDetails) ? 'data' : tab
})

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('pt-BR')
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === '') return '-'
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatQuantity(value) {
  if (value === null || value === undefined) return '-'
  return `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ${props.item.unit}`
}

function movementResponsible(movement) {
  return movement.type === 'entrada'
    ? movement.supplier || '-'
    : movement.requestedBy || '-'
}

function movementPlace(movement) {
  return movement.destination || movement.location || '-'
}

function submitAdjust() {
  const delta = Math.round(Number(adjustValue.value))
  if (!Number.isFinite(delta) || delta === 0) return
  emit('adjust-stock', delta)
  adjustValue.value = ''
  adjustOpen.value = false
}

function startEdit() {
  if (!props.canEditDetails) return
  resetEditForm()
  activeTab.value = 'edit'
}

function addExtraRow() {
  editForm.value.extrasList.push({ key: '', value: '' })
}

function removeExtraRow(index) {
  editForm.value.extrasList.splice(index, 1)
}

async function saveEdit() {
  if (editSaving.value) return
  const validationError = validateVariationForm(props.item, editForm.value)
  if (validationError) { error(validationError); return }

  editSaving.value = true
  try {
    const result = await editVariation(props.variation.id, {
      values: { ...editForm.value.values },
      stock: props.variation.stock,
      minStock: editForm.value.minStock,
      extras: extrasListToObject(editForm.value.extrasList),
      location: editForm.value.locations[0] || '',
      locations: [...editForm.value.locations],
      destinations: [...editForm.value.destinations],
    })
    if (!result.ok) { error(result.error); return }
    success('Variação atualizada.')
    activeTab.value = 'data'
  } catch (e) {
    error(e.message)
  } finally {
    editSaving.value = false
  }
}
</script>

<template>
  <dialog
    ref="dialogRef"
    class="fixed inset-0 z-50 m-0 h-screen w-screen max-w-none bg-transparent p-0 backdrop:bg-black/50"
    aria-modal="true"
    aria-label="Ficha operacional da variação"
    @cancel.prevent="emit('close')"
  >
    <div class="flex min-h-full items-center justify-center p-4" @click.self="emit('close')">
    <section class="flex w-full max-w-5xl max-h-[88vh] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
      <header class="flex shrink-0 items-start justify-between gap-4 border-b border-gray-200 p-4 dark:border-gray-700">
        <div class="min-w-0">
          <p class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Ficha da variação</p>
          <h2 class="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-100 truncate">{{ item.name }}</h2>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate">{{ hierarchy }}</p>
          <div class="mt-3 flex flex-wrap gap-1.5">
            <span
              v-for="tag in variationTags"
              :key="`${tag.key}:${tag.value}`"
              class="ds-attribute-tag inline-flex items-center gap-0.5 rounded border px-2 py-0.5 text-[11px]"
            >
              <span class="font-medium opacity-60">{{ tag.key }}:</span>
              <span>{{ tag.value }}</span>
            </span>
            <span v-if="!variationTags.length" class="text-xs text-gray-400 dark:text-gray-500">Sem atributos específicos.</span>
          </div>
        </div>
        <button
          type="button"
          class="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
          title="Fechar"
          @click="emit('close')"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </header>

      <div class="min-h-0 flex-1 overflow-auto">
        <section class="grid grid-cols-2 gap-3 border-b border-gray-200 p-4 dark:border-gray-700 lg:grid-cols-6">
          <div class="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
            <p class="text-xs text-gray-500 dark:text-gray-400">Estoque atual</p>
            <p class="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-100">{{ variation.stock }} {{ item.unit }}</p>
          </div>
          <div class="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
            <p class="text-xs text-gray-500 dark:text-gray-400">Mínimo</p>
            <p class="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-100">{{ variation.minStock || '-' }}</p>
          </div>
          <div class="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
            <p class="text-xs text-gray-500 dark:text-gray-400">Status</p>
            <span class="mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold" :class="statusConfig[status].pillClass">{{ statusConfig[status].label }}</span>
          </div>
          <div class="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
            <p class="text-xs text-gray-500 dark:text-gray-400">Último fornecedor</p>
            <p class="mt-1 truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{{ recentSupplier }}</p>
          </div>
          <div class="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
            <p class="text-xs text-gray-500 dark:text-gray-400">Último custo</p>
            <p class="mt-1 truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{{ formatCurrency(lastUnitCost) }}</p>
          </div>
          <div class="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
            <p class="text-xs text-gray-500 dark:text-gray-400">OS vinculadas</p>
            <p class="mt-1 truncate text-xl font-semibold text-gray-900 dark:text-gray-100">{{ relatedOrders.length }}</p>
          </div>
        </section>

        <section v-if="canManage" class="flex flex-wrap items-center gap-2 border-b border-gray-200 p-4 dark:border-gray-700">
          <button
            type="button"
            class="inline-flex min-h-11 items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700"
            @click="emit('quick-movement', 'entrada')"
          >
            Entrada
          </button>
          <button
            type="button"
            class="inline-flex min-h-11 items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
            @click="emit('quick-movement', 'saida')"
          >
            Saída
          </button>
          <button
            v-if="canAdjust && !adjustOpen"
            type="button"
            class="inline-flex items-center gap-2 rounded-lg bg-gray-800 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600"
            @click="adjustOpen = true"
          >
            Ajustar
          </button>
          <div v-if="canAdjust && adjustOpen" class="flex items-center gap-2">
            <input
              v-model="adjustValue"
              type="number"
              step="1"
              placeholder="+/-"
              class="w-24 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              @keydown.enter.prevent="submitAdjust"
              @keydown.escape.prevent="adjustOpen = false"
            />
            <button type="button" class="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700" @click="submitAdjust">Salvar</button>
            <button type="button" class="rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700" @click="adjustOpen = false">Cancelar</button>
          </div>
        </section>

        <nav class="flex items-center gap-1 overflow-x-auto border-b border-gray-200 px-4 pt-3 dark:border-gray-700">
          <button
            type="button"
            class="shrink-0 rounded-t-lg px-3 py-2 text-sm font-semibold transition-colors"
            :class="activeTab === 'data'
              ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
              : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'"
            :aria-pressed="activeTab === 'data'"
            @click="activeTab = 'data'"
          >
            Dados
          </button>
          <button
            v-if="canEditDetails"
            type="button"
            class="shrink-0 rounded-t-lg px-3 py-2 text-sm font-semibold transition-colors"
            :class="activeTab === 'edit'
              ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
              : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'"
            :aria-pressed="activeTab === 'edit'"
            @click="startEdit"
          >
            Editar
          </button>
          <button
            type="button"
            class="shrink-0 rounded-t-lg px-3 py-2 text-sm font-semibold transition-colors"
            :class="activeTab === 'movements'
              ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
              : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'"
            :aria-pressed="activeTab === 'movements'"
            @click="activeTab = 'movements'"
          >
            Movimentos
          </button>
        </nav>

        <section v-if="activeTab === 'data'" class="space-y-4 p-4">
          <div>
            <h3 class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Dados de movimentação</h3>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Médias calculadas pelo histórico, sem considerar ajustes de estoque.</p>
          </div>

          <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
              <p class="text-xs text-gray-500 dark:text-gray-400">Pedido médio</p>
              <p class="mt-2 text-xl font-semibold tabular-nums text-gray-900 dark:text-gray-100">{{ formatQuantity(movementStats.averageEntryQty) }}</p>
              <p class="mt-1 text-[11px] text-gray-400 dark:text-gray-500">Por entrada registrada</p>
            </div>
            <div class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
              <p class="text-xs text-gray-500 dark:text-gray-400">Saída média</p>
              <p class="mt-2 text-xl font-semibold tabular-nums text-gray-900 dark:text-gray-100">{{ formatQuantity(movementStats.averageExitQty) }}</p>
              <p class="mt-1 text-[11px] text-gray-400 dark:text-gray-500">Por saída registrada</p>
            </div>
            <div class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
              <p class="text-xs text-gray-500 dark:text-gray-400">Custo médio</p>
              <p class="mt-2 text-xl font-semibold tabular-nums text-gray-900 dark:text-gray-100">{{ formatCurrency(movementStats.averageUnitCost) }}</p>
              <p class="mt-1 text-[11px] text-gray-400 dark:text-gray-500">Entre entradas com custo</p>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
              <p class="text-xs text-gray-500 dark:text-gray-400">Menor preço encontrado</p>
              <p class="mt-2 text-lg font-semibold tabular-nums text-gray-900 dark:text-gray-100">{{ formatCurrency(movementStats.lowestPrice?.unitCost) }}</p>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ movementStats.lowestPrice ? (movementStats.lowestPrice.supplier || 'Fornecedor não informado') : 'Sem custo registrado' }}</p>
            </div>
            <div class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
              <p class="text-xs text-gray-500 dark:text-gray-400">Maior preço encontrado</p>
              <p class="mt-2 text-lg font-semibold tabular-nums text-gray-900 dark:text-gray-100">{{ formatCurrency(movementStats.highestPrice?.unitCost) }}</p>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ movementStats.highestPrice ? (movementStats.highestPrice.supplier || 'Fornecedor não informado') : 'Sem custo registrado' }}</p>
            </div>
          </div>

          <div class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Fornecedores</h3>
              <span class="text-xs tabular-nums text-gray-400 dark:text-gray-500">{{ movementStats.suppliers.length }}</span>
            </div>
            <div v-if="movementStats.suppliers.length" class="mt-3 flex flex-wrap gap-2">
              <span
                v-for="supplier in movementStats.suppliers"
                :key="supplier"
                class="ds-attribute-tag rounded border px-2 py-1 text-xs font-medium"
              >
                {{ supplier }}
              </span>
            </div>
            <p v-else class="mt-3 text-sm text-gray-500 dark:text-gray-400">Nenhum fornecedor registrado para esta variação.</p>
          </div>

          <div class="grid grid-cols-1 gap-3 border-t border-gray-200 pt-4 dark:border-gray-700 md:grid-cols-3">
            <div class="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
              <h3 class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Destinos vinculados</h3>
              <div v-if="linkedDestinations.length" class="mt-3 flex flex-wrap gap-1.5">
                <span v-for="dest in linkedDestinations" :key="dest" class="rounded bg-primary-50 px-2 py-1 text-xs text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">{{ dest }}</span>
              </div>
              <p v-else class="mt-3 text-sm text-gray-500 dark:text-gray-400">Nenhum destino vinculado.</p>
            </div>
            <div class="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
              <h3 class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Resumo</h3>
              <dl class="mt-3 space-y-2 text-sm">
                <div class="flex justify-between gap-3">
                  <dt class="shrink-0 text-gray-500 dark:text-gray-400">Locais</dt>
                  <dd v-if="linkedLocations.length" class="flex flex-wrap justify-end gap-1">
                    <span v-for="location in linkedLocations" :key="location" class="ds-attribute-tag rounded border px-2 py-0.5 text-xs font-semibold">{{ location }}</span>
                  </dd>
                  <dd v-else class="font-medium text-gray-900 dark:text-gray-100">-</dd>
                </div>
                <div class="flex justify-between gap-3">
                  <dt class="text-gray-500 dark:text-gray-400">Último a retirar</dt>
                  <dd class="font-medium text-gray-900 dark:text-gray-100">{{ lastWithdrawalBy }}</dd>
                </div>
                <div class="flex justify-between gap-3">
                  <dt class="text-gray-500 dark:text-gray-400">Última</dt>
                  <dd class="font-medium text-gray-900 dark:text-gray-100">{{ sortedMovements[0] ? formatDate(sortedMovements[0].date) : '-' }}</dd>
                </div>
              </dl>
            </div>
            <div class="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
              <h3 class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Ordens relacionadas</h3>
              <div v-if="relatedOrders.length" class="mt-2 space-y-1">
                <button
                  v-for="order in relatedOrders.slice(0, 5)"
                  :key="order.id"
                  type="button"
                  class="min-h-11 w-full rounded-md px-2 py-2 text-left text-xs transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
                  @click="emit('open-work-order', order)"
                >
                  <span class="block font-semibold text-gray-900 dark:text-gray-100">OS #{{ order.number }}</span>
                  <span class="mt-0.5 block truncate text-gray-500 dark:text-gray-400">{{ order.title || order.destinationName || 'Manutenção' }}</span>
                </button>
              </div>
              <p v-else class="mt-2 text-xs text-gray-500 dark:text-gray-400">Nenhuma OS usou esta variação.</p>
            </div>
          </div>
        </section>

        <section v-else-if="activeTab === 'edit'" class="space-y-5 p-4">
          <div>
            <h3 class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Editar variação</h3>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">O saldo é alterado por Ajustar para manter o histórico de estoque.</p>
          </div>

          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <h4 class="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Destinos vinculados</h4>
              <DestinationTreePicker
                v-model="editForm.destinations"
                multiple
                :linked-ids="editForm.destinations"
                placeholder="Adicionar destino..."
              />
            </div>
            <div>
              <h4 class="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Locais</h4>
              <DestinationTreePicker
                v-model="editForm.locations"
                multiple
                source="locations"
                placeholder="Adicionar local..."
              />
            </div>
          </div>

          <div v-if="item.attributes?.length">
            <h4 class="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Atributos</h4>
            <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label v-for="attribute in item.attributes" :key="attribute" class="block">
                <span class="mb-1 block text-xs text-gray-500 dark:text-gray-400">{{ attribute }}</span>
                <input
                  v-model="editForm.values[attribute]"
                  type="text"
                  :placeholder="attribute"
                  class="min-h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
              </label>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label class="block">
              <span class="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Estoque mínimo</span>
              <input
                v-model.number="editForm.minStock"
                type="number"
                min="0"
                step="1"
                class="min-h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm tabular-nums text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </label>
          </div>

          <div>
            <div class="mb-2 flex items-center justify-between gap-3">
              <h4 class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Campos extras</h4>
              <button
                type="button"
                class="min-h-9 rounded-lg px-3 text-xs font-semibold text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/20"
                @click="addExtraRow"
              >
                Adicionar campo
              </button>
            </div>
            <div v-if="editForm.extrasList.length" class="space-y-2">
              <div v-for="(row, index) in editForm.extrasList" :key="index" class="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,12rem)_1fr_auto]">
                <input
                  v-model="row.key"
                  type="text"
                  placeholder="Campo"
                  class="min-h-10 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
                <input
                  v-model="row.value"
                  type="text"
                  placeholder="Valor"
                  class="min-h-10 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
                <button
                  type="button"
                  class="min-h-10 rounded-lg px-3 text-sm font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                  @click="removeExtraRow(index)"
                >
                  Remover
                </button>
              </div>
            </div>
            <p v-else class="rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">Nenhum campo extra.</p>
          </div>

        </section>

        <section v-else class="p-3">
          <h3 class="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Movimentos</h3>
          <div>
            <div v-if="!sortedMovements.length" class="rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
              Nenhuma movimentação registrada para esta variação.
            </div>
            <div v-else class="overflow-hidden rounded-lg border border-gray-200 bg-gray-50/70 dark:border-gray-700 dark:bg-gray-800/40">
              <article
                v-for="movement in sortedMovements.slice(0, 8)"
                :key="movement.id"
                class="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 border-b border-gray-200 px-3 py-2 last:border-b-0 dark:border-gray-700 sm:grid-cols-[auto_minmax(0,1fr)_auto]"
              >
                <span
                  class="inline-flex w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  :class="movement.type === 'entrada'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'"
                >
                  {{ movement.type === 'entrada' ? 'Entrada' : 'Saída' }}
                </span>
                <div class="min-w-0">
                  <div class="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                    <p class="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{{ movement.qty }} {{ item.unit }}</p>
                    <p v-if="movement.type === 'entrada' && movement.unitCost != null" class="text-xs font-medium tabular-nums text-gray-700 dark:text-gray-300">
                      {{ formatCurrency(movement.unitCost) }}
                    </p>
                    <p class="truncate text-xs text-gray-500 dark:text-gray-400">{{ movementResponsible(movement) }} / {{ movementPlace(movement) }}</p>
                  </div>
                  <p v-if="movement.note" class="truncate text-xs text-gray-600 dark:text-gray-300">{{ movement.note }}</p>
                </div>
                <div class="col-span-2 flex items-center justify-between gap-3 text-xs tabular-nums text-gray-500 dark:text-gray-400 sm:col-span-1 sm:block sm:text-right">
                  <p>{{ formatDate(movement.date) }}</p>
                  <p>Estoque: {{ movement.stockBefore }} → {{ movement.stockAfter }}</p>
                </div>
              </article>
            </div>
          </div>
        </section>
      </div>
      <footer v-if="activeTab === 'edit' && canEditDetails" class="flex shrink-0 flex-wrap justify-end gap-2 border-t border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
        <button
          type="button"
          class="min-h-10 rounded-lg bg-gray-100 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          :disabled="editSaving"
          @click="activeTab = 'data'"
        >
          Cancelar
        </button>
        <button
          type="button"
          class="min-h-10 rounded-lg bg-primary-700 px-4 text-sm font-semibold hover:bg-primary-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-primary-600 dark:hover:bg-primary-500"
          style="color: var(--ds-primary-text)"
          :disabled="editSaving"
          @click="saveEdit"
        >
          {{ editSaving ? 'Salvando...' : 'Salvar alterações' }}
        </button>
      </footer>
    </section>
    </div>
  </dialog>
</template>
