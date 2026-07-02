<script setup>
import { computed, ref, watch } from 'vue'
import { useItems } from '../../composables/useItems.js'
import { personStatusLabel, usePeople } from '../../composables/usePeople.js'
import { useMovements } from '../../composables/useMovements.js'
import { useEpis } from '../../composables/useEpis.js'
import AttributeBadges from '../ui/AttributeBadges.vue'
import AppDialog from '../ui/AppDialog.vue'

const emit = defineEmits(['quick-movement'])

const { items, variations } = useItems()
const { people } = usePeople()
const { movements } = useMovements()
const { activeRoleRules, activePeriodicities } = useEpis()

const search = ref('')
const statusFilter = ref('all')
const personStatusFilter = ref('ativo')
const statusFilterOpen = ref(false)
const personStatusFilterOpen = ref(false)
const filterMenuPosition = ref({ top: 0, left: 0 })
const currentPage = ref(1)
const pageSize = ref(20)
const historyRecord = ref(null)

const targetTypeLabels = {
  grupo: 'Grupo',
  categoria: 'Categoria',
  subcategoria: 'Subcategoria',
  item: 'Item',
  variacao: 'Variação',
}

const statusConfig = {
  Pendente: {
    label: 'Pendente',
    pill: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  },
  'Em dia': {
    label: 'Em dia',
    pill: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  },
  'Vence em breve': {
    label: 'Vence em breve',
    pill: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  },
  Vencido: {
    label: 'Vencido',
    pill: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  },
}

const itemById = computed(() => new Map(items.value.map(item => [item.id, item])))

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function targetFromRule(rule) {
  return {
    targetType: rule.targetType,
    targetKey: rule.targetKey,
    targetLabel: rule.targetLabel,
  }
}

function targetMatchesMovement(target, movement) {
  if (!target || !movement || movement.type !== 'saida') return false
  if (target.targetType === 'grupo') return movement.itemGroup === target.targetKey
  if (target.targetType === 'categoria') return `${movement.itemGroup || ''}|${movement.itemCategory || ''}` === target.targetKey
  if (target.targetType === 'subcategoria') return `${movement.itemGroup || ''}|${movement.itemCategory || ''}|${movement.itemSubcategory || ''}` === target.targetKey
  if (target.targetType === 'item') return movement.itemId === target.targetKey
  if (target.targetType === 'variacao') return movement.variationId === target.targetKey
  return false
}

function targetMatchesCatalogRow(target, item, variation) {
  if (!target || !item || !variation) return false
  if (target.targetType === 'grupo') return item.group === target.targetKey
  if (target.targetType === 'categoria') return `${item.group || ''}|${item.category || ''}` === target.targetKey
  if (target.targetType === 'subcategoria') return `${item.group || ''}|${item.category || ''}|${item.subcategory || ''}` === target.targetKey
  if (target.targetType === 'item') return item.id === target.targetKey
  if (target.targetType === 'variacao') return variation.id === target.targetKey
  return false
}

function movementPersonMatches(movement, person) {
  if (!person || movement.type !== 'saida') return false
  if (movement.requestedByPersonId) return movement.requestedByPersonId === person.id
  return normalize(movement.requestedBy) === normalize(person.name)
}

function periodForRule(rule) {
  const days = Number(rule?.days || 0)
  if (Number.isInteger(days) && days > 0) return { days }
  return activePeriodicities.value.find(period =>
    period.targetType === rule.targetType && period.targetKey === rule.targetKey
  ) || null
}

function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + Number(days || 0))
  return next
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('pt-BR')
}

function epiStatus(record) {
  if (!record.movement) return 'Pendente'
  if (!record.dueDate) return 'Em dia'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(record.dueDate)
  due.setHours(0, 0, 0, 0)
  const daysLeft = Math.ceil((due - today) / 86400000)
  if (daysLeft < 0) return 'Vencido'
  if (daysLeft <= 7) return 'Vence em breve'
  return 'Em dia'
}

function variationLabel(variation, item) {
  const attrs = Object.entries(variation.values || {}).map(([key, value]) => `${key}: ${value}`)
  const extras = Object.entries(variation.extras || {}).map(([key, value]) => `${key}: ${value}`)
  return [item?.name, ...attrs, ...extras].filter(Boolean).join(' / ')
}

const personStatusTabs = [
  { id: 'ativo', label: 'Ativas' },
  { id: 'all', label: 'Todas' },
  { id: 'inativo', label: 'Inativas' },
  { id: 'afastado', label: 'Afastadas' },
  { id: 'demitido', label: 'Demitidas' },
]

function readableTargetLabel(rule) {
  const label = String(rule?.targetLabel || rule?.targetKey || '').trim()
  if (!label) return '-'
  const parts = label.split('>').map(part => part.trim()).filter(Boolean)
  return parts[parts.length - 1] || label
}

function resolveQuickTarget(rule) {
  const target = targetFromRule(rule)
  const matches = variations.value
    .map(variation => ({ variation, item: itemById.value.get(variation.itemId) }))
    .filter(row => row.item && targetMatchesCatalogRow(target, row.item, row.variation))
  return matches.length === 1 ? matches[0] : null
}

function targetVariationRow(rule) {
  if (rule?.targetType !== 'variacao') return null
  const variation = variations.value.find(row => row.id === rule.targetKey)
  const item = variation ? itemById.value.get(variation.itemId) : null
  return variation && item ? { variation, item } : null
}

const records = computed(() => {
  const rows = []
  for (const person of people.value) {
    const personStatus = person.status || (person.active ? 'ativo' : 'inativo')
    if (personStatusFilter.value !== 'all' && personStatus !== personStatusFilter.value) continue
    const role = String(person.role || '').trim()
    if (!role) continue
    const rules = activeRoleRules.value.filter(rule => normalize(rule.roleName) === normalize(role))
    for (const rule of rules) {
      const target = targetFromRule(rule)
      const movement = movements.value
        .filter(movement => movementPersonMatches(movement, person) && targetMatchesMovement(target, movement))
        .slice()
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0] || null
      const period = periodForRule(rule)
      const dueDate = movement && period ? addDays(movement.date, period.days) : null
      const record = { person: { ...person, status: personStatus }, rule, movement, period, dueDate }
      rows.push({ ...record, status: epiStatus(record) })
    }
  }
  return rows.sort((a, b) =>
    a.person.name.localeCompare(b.person.name, 'pt-BR', { sensitivity: 'base', numeric: true }) ||
    String(a.rule.targetLabel || a.rule.targetKey).localeCompare(String(b.rule.targetLabel || b.rule.targetKey), 'pt-BR', { sensitivity: 'base', numeric: true })
  )
})

const counts = computed(() => ({
  all: records.value.length,
  ok: records.value.filter(record => record.status === 'Em dia').length,
  attention: records.value.filter(record => ['Pendente', 'Vence em breve', 'Vencido'].includes(record.status)).length,
  pending: records.value.filter(record => record.status === 'Pendente').length,
  soon: records.value.filter(record => record.status === 'Vence em breve').length,
  expired: records.value.filter(record => record.status === 'Vencido').length,
}))

const filterTabs = computed(() => [
  { id: 'all', label: 'Todos', count: counts.value.all },
  { id: 'attention', label: 'Precisam trocar', count: counts.value.attention },
  { id: 'ok', label: 'Em dia', count: counts.value.ok },
  { id: 'pending', label: 'Pendentes', count: counts.value.pending },
  { id: 'soon', label: 'Vence em breve', count: counts.value.soon },
  { id: 'expired', label: 'Vencidos', count: counts.value.expired },
])

const currentStatusFilterLabel = computed(() =>
  filterTabs.value.find(tab => tab.id === statusFilter.value)?.label || 'Todos'
)

const currentPersonStatusFilterLabel = computed(() =>
  personStatusTabs.find(tab => tab.id === personStatusFilter.value)?.label || 'Ativas'
)

const filteredRecords = computed(() => {
  const q = normalize(search.value)
  return records.value.filter(record => {
    const statusOk =
      statusFilter.value === 'all' ||
      (statusFilter.value === 'attention' && ['Pendente', 'Vence em breve', 'Vencido'].includes(record.status)) ||
      (statusFilter.value === 'ok' && record.status === 'Em dia') ||
      (statusFilter.value === 'pending' && record.status === 'Pendente') ||
      (statusFilter.value === 'soon' && record.status === 'Vence em breve') ||
      (statusFilter.value === 'expired' && record.status === 'Vencido')
    if (!statusOk) return false
    if (!q) return true
    return [
      record.person.name,
      record.person.role,
      personStatusLabel(record.person.status),
      record.rule.targetLabel,
      record.rule.targetKey,
      record.movement?.itemName,
      record.status,
    ].some(value => normalize(value).includes(q))
  })
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredRecords.value.length / pageSize.value)))
const paginatedRecords = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredRecords.value.slice(start, start + pageSize.value)
})

function historyRowsForRecord(record) {
  if (!record) return []
  const target = targetFromRule(record.rule)
  return movements.value
    .filter(movement => movementPersonMatches(movement, record.person) && targetMatchesMovement(target, movement))
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
}

const selectedHistoryRows = computed(() => historyRowsForRecord(historyRecord.value))

function movementAttributesText(movement) {
  return [
    ...Object.entries(movement.variationValues || {}).map(([key, value]) => `${key}: ${value}`),
    ...Object.entries(movement.variationExtras || {}).map(([key, value]) => `${key}: ${value}`),
  ].filter(Boolean).join(' / ')
}

function openHistory(record) {
  historyRecord.value = record
}

watch([filteredRecords, pageSize], () => {
  if (currentPage.value > totalPages.value) currentPage.value = totalPages.value
})

watch([search, statusFilter, personStatusFilter], () => {
  currentPage.value = 1
})

function setPersonStatusFilter(id) {
  personStatusFilter.value = id
  personStatusFilterOpen.value = false
}

function setStatusFilter(id) {
  statusFilter.value = id
  statusFilterOpen.value = false
}

function openFilterMenu(kind, event) {
  const rect = event.currentTarget.getBoundingClientRect()
  const width = kind === 'person' ? 176 : 192
  filterMenuPosition.value = {
    top: rect.bottom + 6,
    left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
  }
  personStatusFilterOpen.value = kind === 'person' ? !personStatusFilterOpen.value : false
  statusFilterOpen.value = kind === 'status' ? !statusFilterOpen.value : false
}

const filterMenuStyle = computed(() => ({
  top: `${filterMenuPosition.value.top}px`,
  left: `${filterMenuPosition.value.left}px`,
}))

function quickMovement(record) {
  const exact = resolveQuickTarget(record.rule)
  emit('quick-movement', {
    type: 'saida',
    itemId: exact?.item?.id,
    variationId: exact?.variation?.id,
    targetType: record.rule.targetType,
    targetKey: record.rule.targetKey,
    targetLabel: record.rule.targetLabel,
    requestedBy: record.person.name,
    requestedByPersonId: record.person.id,
    nonce: `epi:${record.person.id}:${record.rule.id}:${Date.now()}`,
  })
}
</script>

<template>
  <section class="space-y-4">
    <div class="grid gap-3 md:grid-cols-4">
      <button type="button" class="ds-metric text-left cursor-pointer" @click="statusFilter = 'attention'">
        <p class="ds-metric-label">Precisam trocar</p>
        <p class="ds-metric-value text-red-500">{{ counts.attention }}</p>
      </button>
      <button type="button" class="ds-metric text-left cursor-pointer" @click="statusFilter = 'ok'">
        <p class="ds-metric-label">Periodicidade OK</p>
        <p class="ds-metric-value text-green-500">{{ counts.ok }}</p>
      </button>
      <button type="button" class="ds-metric text-left cursor-pointer" @click="statusFilter = 'pending'">
        <p class="ds-metric-label">Pendentes</p>
        <p class="ds-metric-value">{{ counts.pending }}</p>
      </button>
      <button type="button" class="ds-metric text-left cursor-pointer" @click="statusFilter = 'expired'">
        <p class="ds-metric-label">Vencidos</p>
        <p class="ds-metric-value text-red-500">{{ counts.expired }}</p>
      </button>
    </div>

    <div class="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900 md:flex-row md:items-center md:justify-between">
      <div>
        <h2 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Controle de EPIs</h2>
        <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Acompanhamento por pessoa a partir das saidas registradas no estoque.</p>
      </div>
      <input
        v-model="search"
        type="search"
        placeholder="Buscar pessoa, cargo ou EPI..."
        class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 md:w-80"
      />
    </div>

    <div
      v-if="personStatusFilterOpen || statusFilterOpen"
      class="fixed inset-0 z-20"
      @click="personStatusFilterOpen = false; statusFilterOpen = false"
    ></div>
    <div
      v-if="personStatusFilterOpen"
      class="fixed z-50 min-w-44 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 text-xs shadow-xl dark:border-gray-700 dark:bg-gray-900"
      :style="filterMenuStyle"
    >
      <button
        v-for="tab in personStatusTabs"
        :key="tab.id"
        type="button"
        class="flex w-full items-center justify-between gap-3 px-3 py-2 text-left font-semibold transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
        :class="personStatusFilter === tab.id ? 'text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-200'"
        @click.stop="setPersonStatusFilter(tab.id)"
      >
        <span>{{ tab.label }}</span>
        <span v-if="personStatusFilter === tab.id">✓</span>
      </button>
    </div>
    <div
      v-if="statusFilterOpen"
      class="fixed z-50 min-w-48 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 text-xs shadow-xl dark:border-gray-700 dark:bg-gray-900"
      :style="filterMenuStyle"
    >
      <button
        v-for="tab in filterTabs"
        :key="tab.id"
        type="button"
        class="flex w-full items-center justify-between gap-3 px-3 py-2 text-left font-semibold transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
        :class="statusFilter === tab.id ? 'text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-200'"
        @click.stop="setStatusFilter(tab.id)"
      >
        <span>{{ tab.label }}</span>
        <span class="text-gray-400">{{ tab.count }}</span>
      </button>
    </div>

    <div class="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400">
              <th class="relative px-4 py-3 text-left font-semibold">
                <div class="flex items-center gap-2">
                  <span>Pessoa</span>
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold normal-case tracking-normal transition-colors"
                    :class="personStatusFilter !== 'ativo'
                      ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300'
                      : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200'"
                    title="Filtrar pessoas"
                    @click.stop="openFilterMenu('person', $event)"
                  >
                    <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M3 4.5h18l-7 8v5l-4 2v-7l-7-8Z" />
                    </svg>
                    <span>{{ currentPersonStatusFilterLabel }}</span>
                  </button>
                </div>
              </th>
              <th class="px-4 py-3 text-left font-semibold">EPI exigido</th>
              <th class="px-4 py-3 text-left font-semibold">Ultima saida</th>
              <th class="px-4 py-3 text-left font-semibold">Vencimento</th>
              <th class="relative px-4 py-3 text-left font-semibold">
                <div class="flex items-center gap-2">
                  <span>Status</span>
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold normal-case tracking-normal transition-colors"
                    :class="statusFilter !== 'all'
                      ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300'
                      : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200'"
                    title="Filtrar status"
                    @click.stop="openFilterMenu('status', $event)"
                  >
                    <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M3 4.5h18l-7 8v5l-4 2v-7l-7-8Z" />
                    </svg>
                    <span>{{ currentStatusFilterLabel }}</span>
                  </button>
                </div>
              </th>
              <th class="px-4 py-3 text-right font-semibold">Ação</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
            <tr v-if="!filteredRecords.length">
              <td colspan="6" class="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                Nenhum EPI encontrado para os filtros selecionados.
              </td>
            </tr>
            <tr v-for="record in paginatedRecords" :key="`${record.person.id}:${record.rule.id}`" class="hover:bg-gray-50/70 dark:hover:bg-gray-800/40">
              <td class="px-4 py-3">
                <p class="font-semibold text-gray-900 dark:text-gray-100">{{ record.person.name }}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  {{ record.person.role || '-' }}
                  <span v-if="record.person.status !== 'ativo'"> · {{ personStatusLabel(record.person.status) }}</span>
                </p>
              </td>
              <td class="px-4 py-3">
                <span class="inline-flex rounded bg-primary-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
                  {{ targetTypeLabels[record.rule.targetType] }}
                </span>
                <template v-if="targetVariationRow(record.rule)">
                  <p class="mt-0.5 font-medium text-gray-900 dark:text-gray-100">{{ targetVariationRow(record.rule).item.name }}</p>
                  <AttributeBadges class="mt-1" :item="targetVariationRow(record.rule).item" :variation="targetVariationRow(record.rule).variation" compact />
                </template>
                <p v-else class="mt-1 font-medium text-gray-900 dark:text-gray-100">{{ readableTargetLabel(record.rule) }}</p>
                <p v-if="record.period" class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Periodicidade: {{ record.period.days }} dias</p>
              </td>
              <td class="px-4 py-3">
                <p class="font-medium text-gray-900 dark:text-gray-100">{{ formatDate(record.movement?.date) }}</p>
                <p class="max-w-xs truncate text-xs text-gray-500 dark:text-gray-400">
                  {{ record.movement ? `${record.movement.itemName} - ${record.movement.qty} ${record.movement.itemUnit}` : 'Nenhuma saida registrada' }}
                </p>
              </td>
              <td class="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{{ formatDate(record.dueDate) }}</td>
              <td class="px-4 py-3">
                <span class="rounded-full px-2 py-1 text-xs font-semibold" :class="statusConfig[record.status].pill">
                  {{ statusConfig[record.status].label }}
                </span>
              </td>
              <td class="px-4 py-3 text-right">
                <div class="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    class="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800 cursor-pointer"
                    @click="openHistory(record)"
                  >
                    Histórico
                  </button>
                  <button
                    type="button"
                    class="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-[var(--ds-primary-text)] transition-colors hover:bg-primary-700 cursor-pointer"
                    @click="quickMovement(record)"
                  >
                    Registrar saida
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <div v-if="filteredRecords.length" class="flex items-center justify-between border-t border-gray-200 bg-gray-50/70 px-4 py-3 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800/40 dark:text-gray-400">
          <div class="flex items-center gap-2">
            <span>Exibir</span>
            <select v-model.number="pageSize" class="rounded-lg border border-gray-200 bg-white px-2 py-1 dark:border-gray-700 dark:bg-gray-900">
              <option :value="10">10</option>
              <option :value="20">20</option>
              <option :value="40">40</option>
              <option :value="80">80</option>
            </select>
            <span>por pagina</span>
            <span>{{ filteredRecords.length }} registros</span>
          </div>
          <div class="flex items-center gap-1">
            <button type="button" class="rounded-lg px-2 py-1 hover:bg-gray-200 disabled:opacity-40 dark:hover:bg-gray-700" :disabled="currentPage <= 1" @click="currentPage--">Anterior</button>
            <span class="px-2">{{ currentPage }} / {{ totalPages }}</span>
            <button type="button" class="rounded-lg px-2 py-1 hover:bg-gray-200 disabled:opacity-40 dark:hover:bg-gray-700" :disabled="currentPage >= totalPages" @click="currentPage++">Proxima</button>
          </div>
        </div>
      </div>
    </div>

    <AppDialog
      v-if="historyRecord"
      visible
      aria-label="Histórico de retirada de EPI"
      @close="historyRecord = null"
    >
      <section class="flex max-h-[86vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        <header class="flex flex-wrap items-start justify-between gap-3 border-b border-gray-200 p-4 dark:border-gray-700">
          <div>
            <p class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Histórico de retirada</p>
            <h3 class="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{{ historyRecord.person.name }}</h3>
            <p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{{ readableTargetLabel(historyRecord.rule) }}</p>
          </div>
          <button
            type="button"
            class="rounded-lg px-3 py-2 text-sm font-semibold text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            @click="historyRecord = null"
          >
            Fechar
          </button>
        </header>

        <div v-if="selectedHistoryRows.length" class="min-h-0 flex-1 overflow-auto">
          <table class="w-full text-sm">
            <thead class="sticky top-0 border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
              <tr>
                <th class="px-4 py-3 text-left font-semibold">Data</th>
                <th class="px-4 py-3 text-left font-semibold">EPI retirado</th>
                <th class="px-4 py-3 text-center font-semibold">Qtd.</th>
                <th class="px-4 py-3 text-left font-semibold">Destino / Doc</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
              <tr v-for="movement in selectedHistoryRows" :key="movement.id" class="hover:bg-gray-50/70 dark:hover:bg-gray-800/40">
                <td class="px-4 py-3 whitespace-nowrap font-medium text-gray-900 dark:text-gray-100">{{ formatDate(movement.date) }}</td>
                <td class="px-4 py-3">
                  <p class="font-semibold text-gray-900 dark:text-gray-100">{{ movement.itemName }}</p>
                  <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ movementAttributesText(movement) || 'Sem atributos' }}</p>
                </td>
                <td class="px-4 py-3 text-center font-semibold text-red-600 dark:text-red-400">-{{ movement.qty }} {{ movement.itemUnit }}</td>
                <td class="px-4 py-3 text-gray-600 dark:text-gray-300">
                  <p>{{ movement.destination || '-' }}</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">{{ movement.docRef || movement.note || '-' }}</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
          Nenhuma retirada registrada para este EPI desta pessoa.
        </div>
      </section>
    </AppDialog>
  </section>
</template>
