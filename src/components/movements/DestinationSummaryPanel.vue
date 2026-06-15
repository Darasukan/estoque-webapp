<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  summaryTotals: { type: Object, required: true },
  destinationSummaries: { type: Array, required: true },
  filteredDestinationSummaries: { type: Array, required: true },
  summarySearch: { type: String, required: true },
  expandedSummaryDestId: { type: String, default: null },
  formatDate: { type: Function, required: true },
})

const emit = defineEmits(['update:summarySearch', 'update:expandedSummaryDestId'])

const historyDestination = ref(null)
const historySearch = ref('')
const historyDateFrom = ref('')
const historyDateTo = ref('')
const historyGroup = ref('')
const historyCategory = ref('')
const historyItem = ref('')

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function movementAttributesText(movement) {
  return [
    ...Object.entries(movement.variationValues || {}).map(([key, value]) => `${key}: ${value}`),
    ...Object.entries(movement.variationExtras || {}).map(([key, value]) => `${key}: ${value}`),
  ].filter(Boolean).join(' / ')
}

function resetHistoryFilters() {
  historySearch.value = ''
  historyDateFrom.value = ''
  historyDateTo.value = ''
  historyGroup.value = ''
  historyCategory.value = ''
  historyItem.value = ''
}

function openHistory(dest) {
  historyDestination.value = dest
  resetHistoryFilters()
  emit('update:expandedSummaryDestId', null)
}

function closeHistory() {
  historyDestination.value = null
}

function onHistoryKeydown(event) {
  if (event.key === 'Escape' && historyDestination.value) {
    event.preventDefault()
    closeHistory()
  }
}

function movementMatchesHistorySearch(movement) {
  const q = normalize(historySearch.value)
  if (!q) return true
  return [
    movement.itemName,
    movement.itemGroup,
    movement.itemCategory,
    movement.itemSubcategory,
    movement.requestedBy,
    movement.destination,
    movement.docRef,
    movement.operatorName,
    movement.note,
    ...Object.values(movement.variationValues || {}),
    ...Object.values(movement.variationExtras || {}),
  ].some(value => normalize(value).includes(q))
}

function movementMatchesHistoryDate(movement) {
  if (historyDateFrom.value && new Date(movement.date) < new Date(historyDateFrom.value)) return false
  if (historyDateTo.value) {
    const to = new Date(historyDateTo.value)
    to.setDate(to.getDate() + 1)
    if (new Date(movement.date) >= to) return false
  }
  return true
}

function uniqueSorted(list) {
  return [...new Set(list.filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base', numeric: true }))
}

const historyRows = computed(() => {
  if (!historyDestination.value) return []
  return [...(historyDestination.value.saidas || [])]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
})

const historyGroupOptions = computed(() =>
  uniqueSorted(historyRows.value.map(row => row.itemGroup || 'Sem grupo'))
)

const historyCategoryOptions = computed(() =>
  uniqueSorted(historyRows.value
    .filter(row => !historyGroup.value || (row.itemGroup || 'Sem grupo') === historyGroup.value)
    .map(row => row.itemCategory || 'Sem categoria'))
)

const historyItemOptions = computed(() =>
  uniqueSorted(historyRows.value
    .filter(row => !historyGroup.value || (row.itemGroup || 'Sem grupo') === historyGroup.value)
    .filter(row => !historyCategory.value || (row.itemCategory || 'Sem categoria') === historyCategory.value)
    .map(row => row.itemName || 'Sem item'))
)

const filteredHistoryRows = computed(() =>
  historyRows.value.filter(row =>
    movementMatchesHistorySearch(row) &&
    movementMatchesHistoryDate(row) &&
    (!historyGroup.value || (row.itemGroup || 'Sem grupo') === historyGroup.value) &&
    (!historyCategory.value || (row.itemCategory || 'Sem categoria') === historyCategory.value) &&
    (!historyItem.value || (row.itemName || 'Sem item') === historyItem.value)
  )
)

const historyTotals = computed(() => ({
  moves: filteredHistoryRows.value.length,
  qty: filteredHistoryRows.value.reduce((sum, row) => sum + Number(row.qty || 0), 0),
}))

const hasHistoryFilters = computed(() =>
  historySearch.value.trim() ||
  historyDateFrom.value ||
  historyDateTo.value ||
  historyGroup.value ||
  historyCategory.value ||
  historyItem.value
)

watch(historyGroup, () => {
  historyCategory.value = ''
  historyItem.value = ''
})

watch(historyCategory, () => {
  historyItem.value = ''
})

onMounted(() => {
  window.addEventListener('keydown', onHistoryKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onHistoryKeydown)
})
</script>

<template>
  <div class="relative max-w-lg">
    <svg class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
    <input
      :value="summarySearch"
      type="text"
      placeholder="Buscar destino ou material..."
      class="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      @input="emit('update:summarySearch', $event.target.value)"
    />
  </div>

  <div v-if="destinationSummaries.length === 0" class="py-12 text-center text-gray-400 dark:text-gray-500">
    <svg class="mx-auto mb-3 h-12 w-12 opacity-50" fill="none" stroke="currentColor" stroke-width="1" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" d="M9 6.75V15m6-6v8.25m.5-13.5h-7A2.25 2.25 0 0 0 6.25 6v12A2.25 2.25 0 0 0 8.5 20.25h7A2.25 2.25 0 0 0 17.75 18V6a2.25 2.25 0 0 0-2.25-2.25Z" />
    </svg>
    <p class="text-sm">Nenhum destino cadastrado.</p>
  </div>

  <div v-else-if="filteredDestinationSummaries.length === 0" class="py-12 text-center text-sm text-gray-400 dark:text-gray-500">
    Nenhuma saida encontrada por destino.
  </div>

  <div v-else class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
    <button
      v-for="dest in filteredDestinationSummaries"
      :key="dest.id"
      type="button"
      class="group rounded-lg border border-gray-200 bg-white p-4 text-left transition-colors hover:border-primary-400 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-primary-500 dark:hover:bg-gray-700/40"
      :class="dest.isChild ? 'border-l-4 border-l-primary-200 dark:border-l-primary-800' : ''"
      @click="openHistory(dest)"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{{ dest.fullName }}</p>
          <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">
            {{ dest.lastDate ? 'Ultima saida: ' + formatDate(dest.lastDate) : 'Sem saida registrada' }}
          </p>
        </div>
        <svg class="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-300 transition-colors group-hover:text-primary-500 dark:text-gray-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
      </div>
    </button>
  </div>

  <Teleport to="body">
    <div
      v-if="historyDestination"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3"
      @click.self="closeHistory"
    >
      <section class="flex h-[92vh] w-[96vw] max-w-none flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        <header class="flex flex-wrap items-start justify-between gap-3 border-b border-gray-200 p-4 dark:border-gray-700">
          <div class="min-w-0">
            <p class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Historico por destino</p>
            <h3 class="mt-1 truncate text-lg font-semibold text-gray-900 dark:text-gray-100">{{ historyDestination.fullName }}</h3>
            <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {{ historyTotals.moves }} saida{{ historyTotals.moves === 1 ? '' : 's' }} no filtro atual
              <span v-if="historyTotals.qty"> - {{ historyTotals.qty }} materiais</span>
            </p>
          </div>
          <button
            type="button"
            class="rounded-lg px-3 py-2 text-sm font-semibold text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            @click="closeHistory"
          >
            Fechar
          </button>
        </header>

        <div class="border-b border-gray-200 p-4 dark:border-gray-700">
          <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(16rem,1.5fr)_10rem_10rem_minmax(11rem,1fr)_minmax(11rem,1fr)_minmax(11rem,1fr)_auto] xl:items-end">
            <label class="block">
              <span class="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Buscar</span>
              <input
                v-model="historySearch"
                type="search"
                placeholder="Item, pessoa, doc..."
                class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">De</span>
              <input
                v-model="historyDateFrom"
                type="date"
                class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Ate</span>
              <input
                v-model="historyDateTo"
                type="date"
                class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Grupo</span>
              <select
                v-model="historyGroup"
                class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="">Todos</option>
                <option v-for="option in historyGroupOptions" :key="option" :value="option">{{ option }}</option>
              </select>
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Categoria</span>
              <select
                v-model="historyCategory"
                class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="">Todas</option>
                <option v-for="option in historyCategoryOptions" :key="option" :value="option">{{ option }}</option>
              </select>
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Item</span>
              <select
                v-model="historyItem"
                class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="">Todos</option>
                <option v-for="option in historyItemOptions" :key="option" :value="option">{{ option }}</option>
              </select>
            </label>
            <button
              type="button"
              class="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              :disabled="!hasHistoryFilters"
              @click="resetHistoryFilters"
            >
              Limpar
            </button>
          </div>
        </div>

        <div class="min-h-0 flex-1 overflow-auto">
          <table v-if="filteredHistoryRows.length" class="w-full min-w-[68rem] text-sm">
            <thead class="sticky top-0 border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
              <tr>
                <th class="px-4 py-3 text-left font-semibold">Data</th>
                <th class="px-4 py-3 text-left font-semibold">Item / variacao</th>
                <th class="px-4 py-3 text-center font-semibold">Qtd.</th>
                <th class="px-4 py-3 text-left font-semibold">Retirado por</th>
                <th class="px-4 py-3 text-left font-semibold">Doc / obs</th>
                <th class="px-4 py-3 text-left font-semibold">Operador</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
              <tr v-for="movement in filteredHistoryRows" :key="movement.id" class="hover:bg-gray-50/70 dark:hover:bg-gray-800/40">
                <td class="whitespace-nowrap px-4 py-3">
                  <p class="font-medium text-gray-900 dark:text-gray-100">{{ formatDate(movement.date) }}</p>
                </td>
                <td class="px-4 py-3">
                  <p class="font-semibold text-gray-900 dark:text-gray-100">{{ movement.itemName }}</p>
                  <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ [movement.itemGroup, movement.itemCategory, movement.itemSubcategory].filter(Boolean).join(' > ') }}</p>
                  <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ movementAttributesText(movement) || 'Sem atributos' }}</p>
                </td>
                <td class="whitespace-nowrap px-4 py-3 text-center font-semibold text-red-600 dark:text-red-400">
                  -{{ movement.qty }} {{ movement.itemUnit }}
                </td>
                <td class="px-4 py-3 text-gray-600 dark:text-gray-300">
                  {{ movement.requestedBy || '-' }}
                </td>
                <td class="px-4 py-3 text-gray-600 dark:text-gray-300">
                  <p>{{ movement.docRef || '-' }}</p>
                  <p v-if="movement.note" class="mt-0.5 text-xs italic text-gray-500 dark:text-gray-400">{{ movement.note }}</p>
                </td>
                <td class="px-4 py-3 text-gray-600 dark:text-gray-300">
                  {{ movement.operatorName || '-' }}
                </td>
              </tr>
            </tbody>
          </table>

          <div v-else class="p-10 text-center text-sm text-gray-500 dark:text-gray-400">
            Nenhuma saida encontrada para os filtros selecionados.
          </div>
        </div>
      </section>
    </div>
  </Teleport>
</template>
