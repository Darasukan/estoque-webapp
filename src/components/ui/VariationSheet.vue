<script setup>
import { computed, ref, watch } from 'vue'
import { stockAlertStatus } from '../../composables/useItems.js'
import { useDestinations } from '../../composables/useDestinations.js'

const props = defineProps({
  item: { type: Object, required: true },
  variation: { type: Object, required: true },
  movements: { type: Array, default: () => [] },
  canManage: { type: Boolean, default: false },
  canAdjust: { type: Boolean, default: false },
  canEditDetails: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'quick-movement', 'adjust-stock', 'update-extras'])
const { getDestFullName } = useDestinations()

const activeTab = ref('info')
const adjustOpen = ref(false)
const adjustValue = ref('')
const editingExtras = ref(false)
const extraRows = ref([])

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

const entryCostMovements = computed(() =>
  sortedMovements.value.filter(m =>
    m.type === 'entrada' &&
    m.unitCost !== null &&
    m.unitCost !== undefined &&
    m.unitCost !== '' &&
    Number.isFinite(Number(m.unitCost))
  )
)

const lastUnitCost = computed(() =>
  entryCostMovements.value.length ? Number(entryCostMovements.value[0].unitCost) : null
)

const averageUnitCost = computed(() => {
  if (!entryCostMovements.value.length) return null
  const total = entryCostMovements.value.reduce((sum, m) => sum + Number(m.unitCost), 0)
  return total / entryCostMovements.value.length
})

const lastWithdrawalBy = computed(() =>
  sortedMovements.value.find(m => m.type === 'saida' && String(m.requestedBy || '').trim())?.requestedBy || '-'
)

const linkedDestinations = computed(() =>
  (props.variation.destinations || [])
    .map(id => getDestFullName(id))
    .filter(Boolean)
)

const extraInfoRows = computed(() =>
  Object.entries(props.variation.extras || {})
    .map(([key, value]) => ({ key, value }))
    .filter(row => row.key || row.value)
)

function resetExtraRows() {
  extraRows.value = extraInfoRows.value.length
    ? extraInfoRows.value.map(row => ({ ...row }))
    : [{ key: '', value: '' }]
}

watch(() => props.variation.id, () => {
  editingExtras.value = false
  resetExtraRows()
}, { immediate: true })

watch(() => props.variation.extras, () => {
  if (!editingExtras.value) resetExtraRows()
}, { deep: true })

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

function startEditExtras() {
  resetExtraRows()
  editingExtras.value = true
}

function addExtraRow() {
  extraRows.value.push({ key: '', value: '' })
}

function removeExtraRow(index) {
  extraRows.value.splice(index, 1)
  if (!extraRows.value.length) addExtraRow()
}

function saveExtras() {
  const extras = {}
  for (const row of extraRows.value) {
    const key = String(row.key || '').trim()
    if (!key) continue
    extras[key] = String(row.value || '').trim()
  }
  emit('update-extras', extras)
  editingExtras.value = false
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" @click.self="emit('close')">
    <section class="w-full max-w-5xl max-h-[88vh] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
      <header class="flex items-start justify-between gap-4 border-b border-gray-200 p-4 dark:border-gray-700">
        <div class="min-w-0">
          <p class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Ficha da variação</p>
          <h2 class="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-100 truncate">{{ item.name }}</h2>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate">{{ hierarchy }}</p>
          <div class="mt-3 flex flex-wrap gap-1.5">
            <span
              v-for="tag in variationTags"
              :key="`${tag.key}:${tag.value}`"
              class="inline-flex items-center gap-0.5 rounded border border-primary-100 bg-primary-50 px-2 py-0.5 text-[11px] text-primary-700 dark:border-primary-800 dark:bg-primary-900/30 dark:text-primary-300"
            >
              <span class="font-medium opacity-60">{{ tag.key }}:</span>
              <span>{{ tag.value }}</span>
            </span>
            <span v-if="!variationTags.length" class="text-xs text-gray-400 dark:text-gray-500">Sem atributos específicos.</span>
          </div>
        </div>
        <button
          type="button"
          class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
          title="Fechar"
          @click="emit('close')"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </header>

      <div class="max-h-[calc(88vh-5rem)] overflow-auto">
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
            <p class="text-xs text-gray-500 dark:text-gray-400">Média custos</p>
            <p class="mt-1 truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{{ formatCurrency(averageUnitCost) }}</p>
          </div>
        </section>

        <section v-if="canManage" class="flex flex-wrap items-center gap-2 border-b border-gray-200 p-4 dark:border-gray-700">
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700"
            @click="emit('quick-movement', 'entrada')"
          >
            Entrada
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
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

        <nav class="flex items-center gap-1 border-b border-gray-200 px-4 pt-3 dark:border-gray-700">
          <button
            type="button"
            class="rounded-t-lg px-3 py-2 text-sm font-semibold transition-colors"
            :class="activeTab === 'info'
              ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
              : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'"
            @click="activeTab = 'info'"
          >
            Informações extras
          </button>
          <button
            type="button"
            class="rounded-t-lg px-3 py-2 text-sm font-semibold transition-colors"
            :class="activeTab === 'movements'
              ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
              : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'"
            @click="activeTab = 'movements'"
          >
            Movimentos
          </button>
        </nav>

        <section v-if="activeTab === 'info'" class="grid grid-cols-1 gap-4 p-4 lg:grid-cols-[18rem_1fr]">
          <aside class="space-y-3">
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
                  <dt class="text-gray-500 dark:text-gray-400">Local</dt>
                  <dd class="font-medium text-gray-900 dark:text-gray-100">{{ variation.location || item.location || '-' }}</dd>
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
          </aside>

          <div>
            <div class="mb-3 flex items-center justify-between gap-3">
              <h3 class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Informações extras</h3>
              <button
                v-if="canEditDetails && !editingExtras"
                type="button"
                class="rounded-lg bg-gray-800 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600"
                @click="startEditExtras"
              >
                Editar
              </button>
            </div>

            <div v-if="editingExtras" class="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
              <div class="space-y-2">
                <div v-for="(row, index) in extraRows" :key="index" class="grid grid-cols-[minmax(0,12rem)_1fr_auto] gap-2">
                  <input
                    v-model="row.key"
                    type="text"
                    placeholder="Campo"
                    class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                  />
                  <input
                    v-model="row.value"
                    type="text"
                    placeholder="Valor"
                    class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                  />
                  <button
                    type="button"
                    class="rounded-lg px-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                    title="Remover"
                    @click="removeExtraRow(index)"
                  >
                    Remover
                  </button>
                </div>
              </div>
              <div class="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" class="rounded-lg bg-gray-200 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600" @click="addExtraRow">Adicionar campo</button>
                <button type="button" class="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700" @click="saveExtras">Salvar</button>
                <button type="button" class="rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700" @click="editingExtras = false">Cancelar</button>
              </div>
            </div>

            <div v-else-if="extraInfoRows.length" class="grid grid-cols-1 gap-2 md:grid-cols-2">
              <div
                v-for="row in extraInfoRows"
                :key="row.key"
                class="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50"
              >
                <p class="text-xs text-gray-500 dark:text-gray-400">{{ row.key }}</p>
                <p class="mt-1 break-words text-sm font-semibold text-gray-900 dark:text-gray-100">{{ row.value || '-' }}</p>
              </div>
            </div>

            <div v-else class="rounded-lg border border-dashed border-gray-200 p-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
              Nenhuma informação extra cadastrada para esta variação.
              <button
                v-if="canEditDetails"
                type="button"
                class="ml-2 font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                @click="startEditExtras"
              >
                Adicionar agora
              </button>
            </div>
          </div>
        </section>

        <section v-else class="p-4">
          <h3 class="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Movimentos</h3>
          <div>
            <div v-if="!sortedMovements.length" class="rounded-lg border border-dashed border-gray-200 p-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
              Nenhuma movimentação registrada para esta variação.
            </div>
            <div v-else class="space-y-2">
              <article
                v-for="movement in sortedMovements.slice(0, 8)"
                :key="movement.id"
                class="rounded-lg border border-gray-200 bg-gray-50/70 p-3 dark:border-gray-700 dark:bg-gray-800/40"
              >
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span
                      class="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      :class="movement.type === 'entrada'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'"
                    >
                      {{ movement.type === 'entrada' ? 'Entrada' : 'Saída' }}
                    </span>
                    <p class="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">{{ movement.qty }} {{ item.unit }}</p>
                    <p v-if="movement.type === 'entrada' && movement.unitCost != null" class="mt-1 text-xs font-medium text-gray-700 dark:text-gray-300">
                      Custo: {{ formatCurrency(movement.unitCost) }}
                    </p>
                    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ movementResponsible(movement) }} / {{ movementPlace(movement) }}</p>
                    <p v-if="movement.note" class="mt-1 text-xs text-gray-600 dark:text-gray-300">{{ movement.note }}</p>
                  </div>
                  <div class="text-right text-xs text-gray-500 dark:text-gray-400">
                    <p>{{ formatDate(movement.date) }}</p>
                    <p class="mt-1">Estoque: {{ movement.stockBefore }} → {{ movement.stockAfter }}</p>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>
      </div>
    </section>
  </div>
</template>
