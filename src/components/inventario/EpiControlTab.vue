<script setup>
import { computed, ref, watch } from 'vue'
import { useItems } from '../../composables/useItems.js'
import { usePeople } from '../../composables/usePeople.js'
import { useMovements } from '../../composables/useMovements.js'
import { useEpis } from '../../composables/useEpis.js'
import AttributeBadges from '../ui/AttributeBadges.vue'

const emit = defineEmits(['quick-movement'])

const { items, variations } = useItems()
const { activePeople } = usePeople()
const { movements } = useMovements()
const { activeRoleRules, activePeriodicities } = useEpis()

const search = ref('')
const statusFilter = ref('all')
const currentPage = ref(1)
const pageSize = ref(20)

const targetTypeRank = { grupo: 1, categoria: 2, subcategoria: 3, item: 4, variacao: 5 }
const targetTypeLabels = {
  grupo: 'Grupo',
  categoria: 'Categoria',
  subcategoria: 'Subcategoria',
  item: 'Item',
  variacao: 'Variacao',
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

function periodForMovement(movement) {
  return activePeriodicities.value
    .filter(period => targetMatchesMovement(period, movement))
    .sort((a, b) => targetTypeRank[b.targetType] - targetTypeRank[a.targetType])[0] || null
}

function periodForRule(rule) {
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
  for (const person of activePeople.value) {
    const role = String(person.role || '').trim()
    if (!role) continue
    const rules = activeRoleRules.value.filter(rule => normalize(rule.roleName) === normalize(role))
    for (const rule of rules) {
      const target = targetFromRule(rule)
      const movement = movements.value
        .filter(movement => movementPersonMatches(movement, person) && targetMatchesMovement(target, movement))
        .slice()
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0] || null
      const period = movement ? periodForMovement(movement) : periodForRule(rule)
      const dueDate = movement && period ? addDays(movement.date, period.days) : null
      const record = { person, rule, movement, period, dueDate }
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

watch([filteredRecords, pageSize], () => {
  if (currentPage.value > totalPages.value) currentPage.value = totalPages.value
})

watch([search, statusFilter], () => {
  currentPage.value = 1
})

function quickMovement(record) {
  const exact = resolveQuickTarget(record.rule)
  emit('quick-movement', {
    type: 'saida',
    itemId: exact?.item?.id,
    variationId: exact?.variation?.id,
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

    <div class="flex flex-wrap items-center gap-2">
      <button
        v-for="tab in filterTabs"
        :key="tab.id"
        type="button"
        class="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
        :class="statusFilter === tab.id
          ? 'bg-primary-600 text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'"
        @click="statusFilter = tab.id"
      >
        {{ tab.label }}
        <span class="ml-1 opacity-75">{{ tab.count }}</span>
      </button>
    </div>

    <div class="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <div v-if="!filteredRecords.length" class="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
        Nenhum EPI encontrado para os filtros selecionados.
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400">
              <th class="px-4 py-3 text-left font-semibold">Pessoa</th>
              <th class="px-4 py-3 text-left font-semibold">EPI exigido</th>
              <th class="px-4 py-3 text-left font-semibold">Ultima saida</th>
              <th class="px-4 py-3 text-left font-semibold">Vencimento</th>
              <th class="px-4 py-3 text-left font-semibold">Status</th>
              <th class="px-4 py-3 text-right font-semibold">Ação</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
            <tr v-for="record in paginatedRecords" :key="`${record.person.id}:${record.rule.id}`" class="hover:bg-gray-50/70 dark:hover:bg-gray-800/40">
              <td class="px-4 py-3">
                <p class="font-semibold text-gray-900 dark:text-gray-100">{{ record.person.name }}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">{{ record.person.role || '-' }}</p>
              </td>
              <td class="px-4 py-3">
                <span class="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{{ targetTypeLabels[record.rule.targetType] }}</span>
                <template v-if="targetVariationRow(record.rule)">
                  <p class="mt-0.5 font-medium text-gray-900 dark:text-gray-100">{{ targetVariationRow(record.rule).item.name }}</p>
                  <AttributeBadges class="mt-1" :item="targetVariationRow(record.rule).item" :variation="targetVariationRow(record.rule).variation" compact />
                </template>
                <p v-else class="mt-0.5 font-medium text-gray-900 dark:text-gray-100">{{ record.rule.targetLabel || record.rule.targetKey }}</p>
                <p v-if="record.period" class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Troca a cada {{ record.period.days }} dias</p>
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
                <button
                  type="button"
                  class="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary-700 cursor-pointer"
                  @click="quickMovement(record)"
                >
                  Registrar saida
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <div class="flex items-center justify-between border-t border-gray-200 bg-gray-50/70 px-4 py-3 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800/40 dark:text-gray-400">
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
  </section>
</template>
