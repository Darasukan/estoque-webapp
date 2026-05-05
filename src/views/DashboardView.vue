<script setup>
import { computed } from 'vue'
import { useItems, stockAlertStatus } from '../composables/useItems.js'
import { useMovements } from '../composables/useMovements.js'
import { useWorkOrders } from '../composables/useWorkOrders.js'
import { useMotors } from '../composables/useMotors.js'
import { useClosings } from '../composables/useClosings.js'

const emit = defineEmits(['go'])

const { items, variations } = useItems()
const { movements } = useMovements()
const { workOrders } = useWorkOrders()
const { motors } = useMotors()
const { closings } = useClosings()

const rows = computed(() => variations.value.map(variation => {
  const item = items.value.find(i => i.id === variation.itemId) || {}
  return { item, variation, status: stockAlertStatus(variation, item) }
}))

const monthStart = computed(() => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
})

const monthMovements = computed(() =>
  movements.value.filter(m => new Date(m.date) >= monthStart.value)
)

const openOrders = computed(() =>
  workOrders.value.filter(o => !(o.maintenanceEndDate && o.maintenanceEndTime))
)

const motorsInMaintenance = computed(() =>
  motors.value.filter(m => m.status === 'em_manutencao')
)

const stockStats = computed(() => ({
  zero: rows.value.filter(r => r.status === 'zero').length,
  critical: rows.value.filter(r => r.status === 'critical').length,
  alert: rows.value.filter(r => r.status === 'alert').length,
  totalStock: rows.value.reduce((sum, r) => sum + Number(r.variation.stock || 0), 0),
}))

const movementStats = computed(() => ({
  entradas: monthMovements.value.filter(m => m.type === 'entrada').reduce((sum, m) => sum + Number(m.qty || 0), 0),
  saidas: monthMovements.value.filter(m => m.type === 'saida').reduce((sum, m) => sum + Number(m.qty || 0), 0),
}))

const lowStockRows = computed(() =>
  rows.value
    .filter(r => r.status !== 'ok')
    .slice()
    .sort((a, b) => {
      const order = { zero: 0, critical: 1, alert: 2, ok: 3 }
      return order[a.status] - order[b.status] || String(a.item.name || '').localeCompare(String(b.item.name || ''))
    })
    .slice(0, 8)
)

function variationText(row) {
  const values = Object.entries(row.variation.values || {}).map(([k, v]) => `${k}: ${v}`)
  const extras = Object.entries(row.variation.extras || {}).map(([k, v]) => `${k}: ${v}`)
  return [...values, ...extras].filter(Boolean).join(' / ') || '-'
}

function groupByMovements(keyFn, limit = 6) {
  const map = new Map()
  for (const movement of monthMovements.value.filter(m => m.type === 'saida')) {
    const key = keyFn(m)
    if (!key) continue
    const current = map.get(key) || { label: key, qty: 0, count: 0 }
    current.qty += Number(movement.qty || 0)
    current.count += 1
    map.set(key, current)
  }
  return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, limit)
}

const topConsumedItems = computed(() =>
  groupByMovements(m => [m.itemName, ...Object.values(m.variationValues || {})].filter(Boolean).join(' - '))
)

const topDestinations = computed(() =>
  groupByMovements(m => m.destination || 'Sem destino')
)

const lastClosing = computed(() => closings.value[0] || null)

function formatMonth(closing) {
  if (!closing) return '-'
  return `${String(closing.month).padStart(2, '0')}/${closing.year}`
}
</script>

<template>
  <div class="ds-page-stack">
    <header class="ds-page-header">
      <div>
        <p class="ds-page-kicker">Visao geral</p>
        <h1 class="ds-page-title">Dashboard</h1>
        <p class="ds-page-subtitle">Resumo operacional de estoque, movimentacoes, ordens e motores.</p>
      </div>
      <button class="ds-segmented-item ds-segmented-item-active" @click="emit('go', 'fechamentos')">
        Fechamentos
      </button>
    </header>

    <section class="ds-metric-grid">
      <button class="ds-metric text-left cursor-pointer" @click="emit('go', 'inventario')">
        <p class="ds-metric-label">Sem estoque</p>
        <p class="ds-metric-value text-red-500">{{ stockStats.zero }}</p>
      </button>
      <button class="ds-metric text-left cursor-pointer" @click="emit('go', 'inventario')">
        <p class="ds-metric-label">Criticos / alerta</p>
        <p class="ds-metric-value text-amber-500">{{ stockStats.critical + stockStats.alert }}</p>
      </button>
      <button class="ds-metric text-left cursor-pointer" @click="emit('go', 'movimentacoes')">
        <p class="ds-metric-label">Saidas no mes</p>
        <p class="ds-metric-value text-red-500">{{ movementStats.saidas }}</p>
      </button>
      <button class="ds-metric text-left cursor-pointer" @click="emit('go', 'ordens')">
        <p class="ds-metric-label">OS abertas</p>
        <p class="ds-metric-value">{{ openOrders.length }}</p>
      </button>
      <button class="ds-metric text-left cursor-pointer" @click="emit('go', 'motores')">
        <p class="ds-metric-label">Motores em manutencao</p>
        <p class="ds-metric-value">{{ motorsInMaintenance.length }}</p>
      </button>
      <button class="ds-metric text-left cursor-pointer" @click="emit('go', 'fechamentos')">
        <p class="ds-metric-label">Ultimo fechamento</p>
        <p class="ds-metric-value">{{ formatMonth(lastClosing) }}</p>
      </button>
    </section>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <section class="ds-list-panel">
        <div class="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h2 class="ds-section-heading">Estoque em atencao</h2>
          <span class="ds-chip">{{ lowStockRows.length }} itens</span>
        </div>
        <div v-if="!lowStockRows.length" class="p-4 text-sm ds-muted">Nenhum alerta de estoque.</div>
        <button
          v-for="row in lowStockRows"
          :key="row.variation.id"
          class="ds-list-row text-left p-4 cursor-pointer"
          @click="emit('go', 'inventario')"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="font-medium text-gray-900 dark:text-gray-100 truncate">{{ row.item.name }}</p>
              <p class="text-xs ds-muted truncate">{{ row.item.group }} / {{ row.item.category }} / {{ row.item.subcategory }}</p>
              <p class="text-xs ds-subtle truncate">{{ variationText(row) }}</p>
            </div>
            <span class="ds-chip">{{ row.variation.stock }} {{ row.item.unit }}</span>
          </div>
        </button>
      </section>

      <section class="ds-list-panel">
        <div class="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h2 class="ds-section-heading">Mais consumidos no mes</h2>
          <span class="ds-chip">{{ movementStats.entradas }} entradas</span>
        </div>
        <div v-if="!topConsumedItems.length" class="p-4 text-sm ds-muted">Nenhuma saida registrada neste mes.</div>
        <div v-for="item in topConsumedItems" :key="item.label" class="ds-list-row p-4">
          <div class="flex items-center justify-between gap-3">
            <p class="text-sm text-gray-900 dark:text-gray-100 truncate">{{ item.label }}</p>
            <span class="ds-chip">{{ item.qty }}</span>
          </div>
        </div>
      </section>

      <section class="ds-list-panel">
        <div class="p-4 border-b border-gray-200 dark:border-gray-800">
          <h2 class="ds-section-heading">Consumo por destino no mes</h2>
        </div>
        <div v-if="!topDestinations.length" class="p-4 text-sm ds-muted">Nenhum destino com saida neste mes.</div>
        <div v-for="dest in topDestinations" :key="dest.label" class="ds-list-row p-4">
          <div class="flex items-center justify-between gap-3">
            <p class="text-sm text-gray-900 dark:text-gray-100 truncate">{{ dest.label }}</p>
            <span class="ds-chip">{{ dest.qty }}</span>
          </div>
        </div>
      </section>

      <section class="ds-list-panel">
        <div class="p-4 border-b border-gray-200 dark:border-gray-800">
          <h2 class="ds-section-heading">Ordens abertas</h2>
        </div>
        <div v-if="!openOrders.length" class="p-4 text-sm ds-muted">Nenhuma OS aberta.</div>
        <button
          v-for="order in openOrders.slice(0, 6)"
          :key="order.id"
          class="ds-list-row text-left p-4 cursor-pointer"
          @click="emit('go', 'ordens')"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="font-medium text-gray-900 dark:text-gray-100 truncate">OS #{{ order.number }} - {{ order.title }}</p>
              <p class="text-xs ds-muted truncate">{{ order.requestedBy || '-' }} / {{ order.destinationName || order.maintenanceLocationName || '-' }}</p>
            </div>
            <span class="ds-chip">Aberta</span>
          </div>
        </button>
      </section>
    </div>
  </div>
</template>
