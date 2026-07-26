<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppDialog from '../ui/AppDialog.vue'
import AppButton from '../ui/AppButton.vue'
import EmptyState from '../ui/EmptyState.vue'

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
  <section class="ds-panel overflow-hidden">
    <header class="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--ds-border)] px-5 py-4">
      <div>
        <h2 class="text-lg font-semibold tracking-tight text-[var(--ds-text)]">Saídas por destino</h2>
        <p class="mt-0.5 text-xs text-[var(--ds-text-muted)]">Consulte o que foi enviado e quem retirou em cada local.</p>
      </div>
      <div class="flex items-center divide-x divide-[var(--ds-border-subtle)] rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface)]">
        <div class="px-4 py-2">
          <strong class="block text-lg font-semibold tabular-nums text-[var(--ds-text)]">{{ summaryTotals.destinations }}</strong>
          <span class="block text-[11px] text-[var(--ds-text-muted)]">destinos</span>
        </div>
        <div class="px-4 py-2">
          <strong class="block text-lg font-semibold tabular-nums text-[var(--ds-text)]">{{ summaryTotals.saidas }}</strong>
          <span class="block text-[11px] text-[var(--ds-text-muted)]">saídas</span>
        </div>
      </div>
    </header>

    <div class="border-b border-[var(--ds-border)] bg-[var(--ds-surface)] p-4">
      <div class="relative max-w-xl">
        <svg aria-hidden="true" class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ds-text-muted)]" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.2-5.2m0 0A7.5 7.5 0 1 0 5.2 5.2a7.5 7.5 0 0 0 10.6 10.6Z" />
        </svg>
        <input
          :value="summarySearch"
          type="search"
          placeholder="Buscar destino ou material..."
          class="ds-input !pl-9"
          @input="emit('update:summarySearch', $event.target.value)"
        />
      </div>
    </div>

    <div v-if="filteredDestinationSummaries.length" class="grid gap-3 p-4 md:grid-cols-2">
      <button
        v-for="dest in filteredDestinationSummaries"
        :key="dest.id"
        type="button"
        class="group flex min-h-[84px] items-center justify-between gap-4 rounded-lg border border-[var(--ds-border)] bg-[var(--ds-panel)] px-4 py-3 text-left transition-[background-color,border-color] hover:border-[var(--ds-control-border)] hover:bg-[var(--ds-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-brand)]"
        @click="openHistory(dest)"
      >
        <div class="min-w-0">
          <p class="truncate text-sm font-semibold text-[var(--ds-text)]">{{ dest.fullName }}</p>
          <p class="mt-1 text-xs text-[var(--ds-text-muted)]">
            {{ dest.saidas.length }} saída{{ dest.saidas.length === 1 ? '' : 's' }}
            <span aria-hidden="true"> · </span>
            {{ dest.materials.length }} {{ dest.materials.length === 1 ? 'material' : 'materiais' }}
          </p>
          <p class="mt-0.5 text-[11px] text-[var(--ds-text-subtle)]">
            {{ dest.lastDate ? `Última saída em ${formatDate(dest.lastDate)}` : 'Sem saída registrada' }}
          </p>
        </div>
        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--ds-border)] text-[var(--ds-text-muted)] transition-colors group-hover:bg-[var(--ds-panel)] group-hover:text-[var(--ds-text)]" aria-hidden="true">→</span>
      </button>
    </div>

    <EmptyState
      v-else-if="destinationSummaries.length"
      title="Nenhuma saída encontrada."
      text="Ajuste a busca para localizar outro destino ou material."
    />
    <EmptyState
      v-else
      title="Nenhum destino cadastrado."
      text="Os destinos com movimentações aparecerão neste relatório."
    />
  </section>

  <AppDialog
    v-if="historyDestination"
    visible
    aria-label="Histórico de saídas por destino"
    @close="closeHistory"
  >
      <section class="ds-panel flex h-[88vh] w-[96vw] max-w-7xl flex-col overflow-hidden">
        <header class="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--ds-border)] px-5 py-4">
          <div class="min-w-0">
            <p class="text-[11px] font-semibold uppercase tracking-wider text-[var(--ds-text-muted)]">Histórico de saídas</p>
            <h3 class="mt-1 truncate text-xl font-semibold tracking-tight text-[var(--ds-text)]">{{ historyDestination.fullName }}</h3>
            <p class="mt-0.5 text-xs text-[var(--ds-text-muted)]">Movimentações enviadas para este destino.</p>
          </div>
          <div class="flex items-center gap-3">
            <div class="hidden items-center divide-x divide-[var(--ds-border-subtle)] rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface)] sm:flex">
              <div class="px-4 py-2">
                <strong class="block text-lg font-semibold tabular-nums text-[var(--ds-text)]">{{ filteredHistoryRows.length }}</strong>
                <span class="block text-[11px] text-[var(--ds-text-muted)]">saídas exibidas</span>
              </div>
              <div class="px-4 py-2">
                <strong class="block text-lg font-semibold tabular-nums text-[var(--ds-text)]">{{ historyDestination.materials.length }}</strong>
                <span class="block text-[11px] text-[var(--ds-text-muted)]">materiais</span>
              </div>
            </div>
            <AppButton variant="ghost" size="sm" @click="closeHistory">Fechar</AppButton>
          </div>
        </header>

        <div class="border-b border-[var(--ds-border)] bg-[var(--ds-surface)] p-4">
          <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(16rem,1.5fr)_9rem_9rem_repeat(3,minmax(9rem,1fr))_auto] xl:items-end">
            <label class="block">
              <span class="ds-label">Buscar</span>
              <input
                v-model="historySearch"
                type="search"
                placeholder="Item, pessoa ou documento..."
                class="ds-input"
              />
            </label>
            <label class="block">
              <span class="ds-label">De</span>
              <input
                v-model="historyDateFrom"
                type="date"
                class="ds-input"
              />
            </label>
            <label class="block">
              <span class="ds-label">Até</span>
              <input
                v-model="historyDateTo"
                type="date"
                class="ds-input"
              />
            </label>
            <label class="block">
              <span class="ds-label">Grupo</span>
              <select
                v-model="historyGroup"
                class="ds-input"
              >
                <option value="">Todos</option>
                <option v-for="option in historyGroupOptions" :key="option" :value="option">{{ option }}</option>
              </select>
            </label>
            <label class="block">
              <span class="ds-label">Categoria</span>
              <select
                v-model="historyCategory"
                class="ds-input"
              >
                <option value="">Todas</option>
                <option v-for="option in historyCategoryOptions" :key="option" :value="option">{{ option }}</option>
              </select>
            </label>
            <label class="block">
              <span class="ds-label">Item</span>
              <select
                v-model="historyItem"
                class="ds-input"
              >
                <option value="">Todos</option>
                <option v-for="option in historyItemOptions" :key="option" :value="option">{{ option }}</option>
              </select>
            </label>
            <AppButton
              variant="ghost"
              size="sm"
              :disabled="!hasHistoryFilters"
              @click="resetHistoryFilters"
            >
              Limpar
            </AppButton>
          </div>
        </div>

        <div class="min-h-0 flex-1 overflow-auto">
          <table v-if="filteredHistoryRows.length" class="ds-table min-w-[68rem]">
            <thead>
              <tr>
                <th>Data</th>
                <th>Item / variação</th>
                <th class="text-center">Qtd.</th>
                <th>Retirado por</th>
                <th>Documento / observação</th>
                <th>Operador</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="movement in filteredHistoryRows" :key="movement.id">
                <td class="whitespace-nowrap">
                  <p class="font-medium text-[var(--ds-text)]">{{ formatDate(movement.date) }}</p>
                </td>
                <td>
                  <p class="font-semibold text-[var(--ds-text)]">{{ movement.itemName }}</p>
                  <p class="mt-0.5 text-xs text-[var(--ds-text-muted)]">{{ [movement.itemGroup, movement.itemCategory, movement.itemSubcategory].filter(Boolean).join(' › ') }}</p>
                  <p class="mt-0.5 text-xs text-[var(--ds-text-muted)]">{{ movementAttributesText(movement) || 'Sem atributos' }}</p>
                </td>
                <td class="whitespace-nowrap text-center font-semibold tabular-nums text-[var(--ds-danger)]">
                  -{{ movement.qty }} {{ movement.itemUnit }}
                </td>
                <td>
                  {{ movement.requestedBy || '-' }}
                </td>
                <td>
                  <p>{{ movement.docRef || '-' }}</p>
                  <p v-if="movement.note" class="mt-0.5 text-xs text-[var(--ds-text-muted)]">{{ movement.note }}</p>
                </td>
                <td>
                  {{ movement.operatorName || '-' }}
                </td>
              </tr>
            </tbody>
          </table>

          <EmptyState
            v-else
            title="Nenhuma saída encontrada."
            text="Ajuste ou limpe os filtros para consultar outras movimentações."
          />
        </div>
      </section>
  </AppDialog>
</template>
