<script setup>
import { computed, inject, ref, watch } from 'vue'
import { useClosings } from '../composables/useClosings.js'
import { useToast } from '../composables/useToast.js'

const isAdmin = inject('isAdmin')
const { closings, closingDetails, createClosing, deleteClosing, loadClosing } = useClosings()
const { success, error } = useToast()

const now = new Date()
const selectedMonth = ref(now.getMonth() + 1)
const selectedYear = ref(now.getFullYear())
const notes = ref('')
const selectedClosingId = ref('')
const loading = ref(false)
const deletingId = ref('')

const MONTHS = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Marco' },
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

const yearOptions = computed(() => {
  const year = new Date().getFullYear()
  return Array.from({ length: 8 }, (_, index) => year - index)
})

const selectedClosing = computed(() => {
  if (!selectedClosingId.value) return closings.value[0] || null
  return closingDetails.value[selectedClosingId.value] || closings.value.find(c => c.id === selectedClosingId.value) || null
})

const selectedDetail = computed(() => {
  if (!selectedClosing.value) return null
  return closingDetails.value[selectedClosing.value.id] || selectedClosing.value
})

const attentionRows = computed(() => {
  const rows = selectedDetail.value?.data?.rows || []
  return rows
    .filter(row => row.stockAtClose <= 0 || (row.minStock > 0 && row.stockAtClose <= row.minStock))
    .slice()
    .sort((a, b) => a.stockAtClose - b.stockAtClose || a.itemName.localeCompare(b.itemName))
    .slice(0, 12)
})

function formatMonth(closing) {
  if (!closing) return '-'
  return `${String(closing.month).padStart(2, '0')}/${closing.year}`
}

function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString('pt-BR')
}

async function selectClosing(closing) {
  selectedClosingId.value = closing.id
  if (!closingDetails.value[closing.id]) {
    await loadClosing(closing.id)
  }
}

watch(closings, list => {
  if (!selectedClosingId.value && list.length) selectClosing(list[0]).catch(() => {})
}, { immediate: true })

async function handleCreate() {
  if (!isAdmin?.value) return
  loading.value = true
  try {
    const created = await createClosing({
      year: selectedYear.value,
      month: selectedMonth.value,
      notes: notes.value,
    })
    selectedClosingId.value = created.id
    notes.value = ''
    success(`Fechamento ${formatMonth(created)} salvo.`)
  } catch (e) {
    error(e.message)
  } finally {
    loading.value = false
  }
}

async function handleDelete(id) {
  if (!isAdmin?.value) return
  if (deletingId.value !== id) {
    deletingId.value = id
    return
  }
  try {
    await deleteClosing(id)
    if (selectedClosingId.value === id) selectedClosingId.value = ''
    deletingId.value = ''
    success('Fechamento excluido.')
  } catch (e) {
    error(e.message)
  }
}

function variationText(row) {
  return Object.entries(row.variationValues || {})
    .map(([key, value]) => `${key}: ${value}`)
    .join(' / ') || '-'
}
</script>

<template>
  <div class="ds-page-stack">
    <header class="ds-page-header">
      <div>
        <p class="ds-page-kicker">Estoque</p>
        <h1 class="ds-page-title">Fechamentos mensais</h1>
        <p class="ds-page-subtitle">Salve uma foto oficial do estoque no fim de cada mes, calculada a partir das movimentacoes.</p>
      </div>
    </header>

    <section class="ds-toolbar">
      <div class="grid grid-cols-1 md:grid-cols-[160px_120px_minmax(220px,1fr)_auto] gap-3 w-full items-end">
        <label>
          <span class="ds-label">Mês</span>
          <select v-model.number="selectedMonth" class="ds-input">
            <option v-for="month in MONTHS" :key="month.value" :value="month.value">{{ month.label }}</option>
          </select>
        </label>
        <label>
          <span class="ds-label">Ano</span>
          <select v-model.number="selectedYear" class="ds-input">
            <option v-for="year in yearOptions" :key="year" :value="year">{{ year }}</option>
          </select>
        </label>
        <label>
          <span class="ds-label">Observação</span>
          <input v-model="notes" class="ds-input" placeholder="Opcional" :disabled="!isAdmin" />
        </label>
        <button
          class="ds-segmented-item ds-segmented-item-active min-h-[38px] justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="!isAdmin || loading"
          @click="handleCreate"
        >
          {{ loading ? 'Salvando...' : 'Salvar fechamento' }}
        </button>
      </div>
      <p v-if="!isAdmin" class="text-xs ds-muted">Somente admin pode salvar ou excluir fechamentos.</p>
    </section>

    <div class="grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)] gap-4">
      <section class="ds-list-panel">
        <div class="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h2 class="ds-section-heading">Fechamentos salvos</h2>
          <span class="ds-chip">{{ closings.length }}</span>
        </div>
        <div v-if="!closings.length" class="p-4 text-sm ds-muted">Nenhum fechamento salvo.</div>
        <button
          v-for="closing in closings"
          :key="closing.id"
          class="ds-list-row text-left p-4 cursor-pointer"
          :class="{ 'ds-list-row-active': selectedClosing?.id === closing.id }"
          @click="selectClosing(closing)"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="font-medium text-gray-900 dark:text-gray-100">{{ formatMonth(closing) }}</p>
              <p class="text-xs ds-muted">{{ formatDate(closing.closedAt) }}</p>
              <p class="text-xs ds-subtle">{{ closing.closedByName || '-' }}</p>
            </div>
            <button
              v-if="isAdmin"
              class="ds-chip hover:text-red-500 cursor-pointer"
              @click.stop="handleDelete(closing.id)"
            >
              {{ deletingId === closing.id ? 'Confirmar' : 'Excluir' }}
            </button>
          </div>
        </button>
      </section>

      <section v-if="selectedClosing" class="ds-page-stack">
        <div class="ds-panel p-4">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="ds-page-kicker">Fechamento selecionado</p>
              <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ formatMonth(selectedClosing) }}</h2>
              <p class="text-sm ds-muted">Salvo em {{ formatDate(selectedClosing.closedAt) }}</p>
            </div>
            <span class="ds-chip">{{ selectedClosing.summary?.variations || 0 }} variações</span>
          </div>
          <p v-if="selectedClosing.notes" class="mt-3 text-sm ds-muted">{{ selectedClosing.notes }}</p>
        </div>

        <div class="ds-metric-grid">
          <div class="ds-metric">
            <p class="ds-metric-label">Saldo fechado</p>
            <p class="ds-metric-value">{{ selectedClosing.summary?.totalStockAtClose || 0 }}</p>
          </div>
          <div class="ds-metric">
            <p class="ds-metric-label">Entradas no mês</p>
            <p class="ds-metric-value text-green-500">{{ selectedClosing.summary?.monthEntradas || 0 }}</p>
          </div>
          <div class="ds-metric">
            <p class="ds-metric-label">Saídas no mês</p>
            <p class="ds-metric-value text-red-500">{{ selectedClosing.summary?.monthSaidas || 0 }}</p>
          </div>
          <div class="ds-metric">
            <p class="ds-metric-label">Sem estoque</p>
            <p class="ds-metric-value text-red-500">{{ selectedClosing.summary?.zeroStock || 0 }}</p>
          </div>
          <div class="ds-metric">
            <p class="ds-metric-label">Abaixo do mínimo</p>
            <p class="ds-metric-value text-amber-500">{{ selectedClosing.summary?.belowMin || 0 }}</p>
          </div>
        </div>

        <div class="ds-table-wrap">
          <table class="ds-table">
            <thead>
              <tr>
                <th>Grupo</th>
                <th>Variações</th>
                <th>Saldo</th>
                <th>Entradas</th>
                <th>Saídas</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="group in (selectedClosing.summary?.groups || [])" :key="group.group">
                <td class="font-medium text-gray-900 dark:text-gray-100">{{ group.group }}</td>
                <td>{{ group.variations }}</td>
                <td>{{ group.stockAtClose }}</td>
                <td class="text-green-500">{{ group.monthEntradas }}</td>
                <td class="text-red-500">{{ group.monthSaidas }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <section class="ds-list-panel">
          <div class="p-4 border-b border-gray-200 dark:border-gray-800">
            <h2 class="ds-section-heading">Itens em atencao no fechamento</h2>
          </div>
          <div v-if="!attentionRows.length" class="p-4 text-sm ds-muted">Nenhum item critico neste fechamento.</div>
          <div v-for="row in attentionRows" :key="row.variationId" class="ds-list-row p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="font-medium text-gray-900 dark:text-gray-100 truncate">{{ row.itemName }}</p>
                <p class="text-xs ds-muted truncate">{{ row.group }} / {{ row.category }} / {{ row.subcategory }}</p>
                <p class="text-xs ds-subtle truncate">{{ variationText(row) }}</p>
              </div>
              <span class="ds-chip">{{ row.stockAtClose }} {{ row.unit }}</span>
            </div>
          </div>
        </section>
      </section>

      <section v-else class="ds-panel p-8 text-center ds-muted">
        Selecione ou salve um fechamento para ver os detalhes.
      </section>
    </div>
  </div>
</template>
