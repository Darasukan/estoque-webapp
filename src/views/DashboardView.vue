<script setup>
import { computed, inject, ref, watch } from 'vue'
import { useItems, stockAlertStatus } from '../composables/useItems.js'
import { useMovements } from '../composables/useMovements.js'
import { useWorkOrders } from '../composables/useWorkOrders.js'
import { useMotors } from '../composables/useMotors.js'
import { useClosings } from '../composables/useClosings.js'
import { useDestinations } from '../composables/useDestinations.js'

const emit = defineEmits(['go'])
const isLoggedIn = inject('isLoggedIn')

const { items, variations } = useItems()
const { movements } = useMovements()
const { workOrders } = useWorkOrders()
const { motors } = useMotors()
const { closings } = useClosings()
const { destinations, getDestFullName } = useDestinations()
const DASHBOARD_PAGE_SIZE = 6
const lowStockPage = ref(1)
const consumedPage = ref(1)

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

const lowStockAllRows = computed(() =>
  rows.value
    .filter(r => r.status !== 'ok')
    .slice()
    .sort((a, b) => {
      const order = { zero: 0, critical: 1, alert: 2, ok: 3 }
      return order[a.status] - order[b.status] || String(a.item.name || '').localeCompare(String(b.item.name || ''))
    })
)

const lowStockTotalPages = computed(() => Math.max(1, Math.ceil(lowStockAllRows.value.length / DASHBOARD_PAGE_SIZE)))
const lowStockRows = computed(() => pageSlice(lowStockAllRows.value, lowStockPage.value))

const destinationAlerts = computed(() => {
  const map = new Map()

  // Vínculos manuais continuam sendo controlados por variação específica.
  for (const row of rows.value.filter(r => r.status !== 'ok')) {
    for (const destinationId of row.variation.destinations || []) {
      addDestinationAlert(map, destinationId, row.status, row)
    }
  }

  // Regras amplas são agregadas por nível: uma marca zerada não alerta se outra variação cobre o conjunto.
  for (const destination of destinations.value) {
    for (const rule of destination.materialRules || []) {
      const ruleRows = rows.value.filter(row => itemMatchesDestinationRule(row.item, rule))
      if (!ruleRows.length) continue
      const status = aggregateRuleStatus(ruleRows)
      if (status === 'ok') continue
      addDestinationAlert(map, destination.id, status, {
        item: {
          name: ruleLabel(rule),
          group: rule.group,
          category: rule.category,
          subcategory: rule.subcategory,
        },
        variation: {
          stock: ruleRows.reduce((sum, row) => sum + Number(row.variation.stock || 0), 0),
        },
        status,
      })
    }
  }

  return [...map.values()]
    .map(dest => ({ ...dest, total: dest.zero + dest.critical + dest.alert }))
    .sort((a, b) =>
      b.zero - a.zero ||
      b.total - a.total ||
      String(a.label).localeCompare(String(b.label))
    )
    .slice(0, 8)
})

function addDestinationAlert(map, destinationId, status, row) {
  const label = getDestFullName(destinationId)
  if (!label || status === 'ok') return
  const current = map.get(destinationId) || {
    id: destinationId,
    label,
    zero: 0,
    critical: 0,
    alert: 0,
    items: [],
  }
  current[status] += 1
  if (current.items.length < 3) current.items.push(row)
  map.set(destinationId, current)
}

function aggregateRuleStatus(ruleRows) {
  const totalStock = ruleRows.reduce((sum, row) => sum + Number(row.variation.stock || 0), 0)
  const totalMinimum = ruleRows.reduce((sum, row) => sum + Number(row.variation.minStock || row.item.minStock || 0), 0)
  if (totalStock <= 0) return 'zero'
  if (totalMinimum > 0 && totalStock <= totalMinimum * 0.5) return 'critical'
  if (totalMinimum > 0 && totalStock <= totalMinimum) return 'alert'
  return 'ok'
}

function itemMatchesDestinationRule(item, rule) {
  if (!item || !rule?.group || item.group !== rule.group) return false
  if (rule.category && item.category !== rule.category) return false
  if (rule.subcategory && item.subcategory !== rule.subcategory) return false
  return true
}

function ruleLabel(rule) {
  return [rule.group, rule.category, rule.subcategory].filter(Boolean).join(' / ')
}

function variationText(row) {
  const values = Object.entries(row.variation.values || {}).map(([k, v]) => `${k}: ${v}`)
  const extras = Object.entries(row.variation.extras || {}).map(([k, v]) => `${k}: ${v}`)
  return [...values, ...extras].filter(Boolean).join(' / ') || '-'
}

function inventorySearchFromLabel(label) {
  return String(label || '').split(' - ')[0]
}

function groupByMovements(keyFn) {
  const map = new Map()
  for (const movement of monthMovements.value.filter(m => m.type === 'saida')) {
    const key = keyFn(m)
    if (!key) continue
    const current = map.get(key) || { label: key, qty: 0, count: 0 }
    current.qty += Number(movement.qty || 0)
    current.count += 1
    map.set(key, current)
  }
  return [...map.values()].sort((a, b) => b.qty - a.qty)
}

const topConsumedAllItems = computed(() =>
  groupByMovements(m => [m.itemName, ...Object.values(m.variationValues || {})].filter(Boolean).join(' - '))
)

const consumedTotalPages = computed(() => Math.max(1, Math.ceil(topConsumedAllItems.value.length / DASHBOARD_PAGE_SIZE)))
const topConsumedItems = computed(() => pageSlice(topConsumedAllItems.value, consumedPage.value))

const topDestinations = computed(() =>
  groupByMovements(m => m.destination || 'Sem destino').slice(0, 6)
)

const lastClosing = computed(() => closings.value[0] || null)

const shortcutActions = [
  {
    id: 'entrada',
    label: 'Entrada',
    description: 'Registrar material chegando no estoque.',
    target: { tab: 'movimentacoes', subTab: 'entrada', requiresAuth: true },
    icon: 'M12 4.5v15m0-15 6 6m-6-6-6 6',
    tone: 'text-green-600 dark:text-green-400',
    bg: '#d1fae5',
    border: '#34d399',
    iconBg: '#a7f3d0',
    darkBg: '#064e3b',
    darkBorder: '#059669',
    darkIconBg: '#065f46',
    primary: true,
  },
  {
    id: 'saida',
    label: 'Saída',
    description: 'Registrar retirada para pessoa ou destino.',
    target: { tab: 'movimentacoes', subTab: 'saida', requiresAuth: true },
    icon: 'M12 19.5v-15m0 15-6-6m6 6 6-6',
    tone: 'text-red-600 dark:text-red-400',
    bg: '#fee2e2',
    border: '#f87171',
    iconBg: '#fecaca',
    darkBg: '#7f1d1d',
    darkBorder: '#dc2626',
    darkIconBg: '#991b1b',
    primary: true,
  },
  {
    id: 'inventario',
    label: 'Inventário',
    description: 'Ver saldo, ajuste e histórico por variação.',
    target: { tab: 'inventario', section: 'estoque' },
    icon: 'M3.75 6A2.25 2.25 0 016 3.75h12A2.25 2.25 0 0120.25 6v12A2.25 2.25 0 0118 20.25H6A2.25 2.25 0 013.75 18V6Zm3 2.25h10.5M6.75 12h10.5M6.75 15.75h6',
    tone: 'text-blue-700 dark:text-blue-300',
    bg: '#dbeafe',
    border: '#93c5fd',
    iconBg: '#bfdbfe',
    darkBg: '#1e3a8a',
    darkBorder: '#3b82f6',
    darkIconBg: '#1d4ed8',
  },
  {
    id: 'nova-os',
    label: 'Nova OS',
    description: 'Abrir uma ordem de serviço comum.',
    target: { tab: 'ordens', subTab: 'nova', requiresAuth: true },
    icon: 'M12 4.5v15m7.5-7.5h-15',
    tone: 'text-cyan-700 dark:text-cyan-300',
    bg: '#cffafe',
    border: '#67e8f9',
    iconBg: '#a5f3fc',
    darkBg: '#164e63',
    darkBorder: '#06b6d4',
    darkIconBg: '#155e75',
    primary: true,
  },
  {
    id: 'fechamentos',
    label: 'Fechamentos',
    description: 'Conferir ou gerar fechamento mensal.',
    target: { tab: 'inventario', section: 'fechamentos', requiresAuth: true },
    icon: 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0Z',
    tone: 'text-amber-600 dark:text-amber-400',
    bg: '#fef3c7',
    border: '#fbbf24',
    iconBg: '#fde68a',
    darkBg: '#78350f',
    darkBorder: '#d97706',
    darkIconBg: '#92400e',
  },
  {
    id: 'motores',
    label: 'Motores',
    description: 'Abrir ficha, OS e histórico de motores.',
    target: { tab: 'motores' },
    icon: 'M3.75 13.5h16.5m-16.5 0a2.25 2.25 0 01-2.25-2.25V9A2.25 2.25 0 013.75 6.75h16.5A2.25 2.25 0 0122.5 9v2.25a2.25 2.25 0 01-2.25 2.25m-16.5 0v1.875c0 .621.504 1.125 1.125 1.125h14.25c.621 0 1.125-.504 1.125-1.125V13.5',
    tone: 'text-gray-700 dark:text-gray-300',
    bg: '#e2e8f0',
    border: '#94a3b8',
    iconBg: '#cbd5e1',
    darkBg: '#334155',
    darkBorder: '#64748b',
    darkIconBg: '#475569',
  },
]

const priorityActions = computed(() => {
  const list = []
  if (stockStats.value.zero) {
    list.push({
      id: 'zero',
      label: `${stockStats.value.zero} ${stockStats.value.zero === 1 ? 'variação' : 'variações'} sem estoque`,
      description: 'Prioridade alta para reposição ou ajuste.',
      target: { tab: 'inventario', section: 'estoque', status: 'zero' },
      tone: 'text-red-600 dark:text-red-400',
    })
  }
  if (stockStats.value.critical + stockStats.value.alert) {
    list.push({
      id: 'alertas',
      label: `${stockStats.value.critical + stockStats.value.alert} ${stockStats.value.critical + stockStats.value.alert === 1 ? 'variação' : 'variações'} em alerta`,
      description: 'Conferir mínimo, consumo e necessidade de compra.',
      target: { tab: 'inventario', section: 'estoque', status: '' },
      tone: 'text-amber-600 dark:text-amber-400',
    })
  }
  if (destinationAlerts.value.length) {
    list.push({
      id: 'destinos',
      label: `${destinationAlerts.value.length} destino${destinationAlerts.value.length === 1 ? '' : 's'} com alerta`,
      description: 'Ver materiais críticos por máquina ou local.',
      target: { tab: 'inventario', section: 'estoque', status: '' },
      tone: 'text-amber-600 dark:text-amber-400',
    })
  }
  if (openOrders.value.length) {
    list.push({
      id: 'os',
      label: `${openOrders.value.length} OS aberta${openOrders.value.length === 1 ? '' : 's'}`,
      description: 'Continuar manutenções pendentes.',
      target: { tab: 'ordens', subTab: 'ordens' },
      tone: 'text-primary-600 dark:text-primary-400',
    })
  }
  if (motorsInMaintenance.value.length) {
    list.push({
      id: 'motores',
      label: `${motorsInMaintenance.value.length} motor${motorsInMaintenance.value.length === 1 ? '' : 'es'} em manutenção`,
      description: 'Acompanhar OS e eventos de motor.',
      target: { tab: 'motores' },
      tone: 'text-primary-600 dark:text-primary-400',
    })
  }
  if (!lastClosing.value) {
    list.push({
      id: 'sem-fechamento',
      label: 'Nenhum fechamento registrado',
      description: 'Abrir rotina de fechamento mensal.',
      target: { tab: 'inventario', section: 'fechamentos', requiresAuth: true },
      tone: 'text-amber-600 dark:text-amber-400',
    })
  }
  return list.slice(0, 6)
})

function formatMonth(closing) {
  if (!closing) return '-'
  return `${String(closing.month).padStart(2, '0')}/${closing.year}`
}

function pageSlice(list, page) {
  const start = (page - 1) * DASHBOARD_PAGE_SIZE
  return list.slice(start, start + DASHBOARD_PAGE_SIZE)
}

function go(target) {
  emit('go', target)
}

watch(lowStockAllRows, () => {
  if (lowStockPage.value > lowStockTotalPages.value) lowStockPage.value = lowStockTotalPages.value
})

watch(topConsumedAllItems, () => {
  if (consumedPage.value > consumedTotalPages.value) consumedPage.value = consumedTotalPages.value
})
</script>

<template>
  <div class="ds-page-stack">
    <header class="ds-page-header">
      <div>
        <p class="ds-page-kicker">Visão geral</p>
        <h1 class="ds-page-title">Dashboard</h1>
        <p class="ds-page-subtitle">Resumo operacional de estoque, movimentações, ordens e motores.</p>
      </div>
    </header>

    <section class="grid grid-cols-1 xl:grid-cols-[1.25fr_0.75fr] gap-4">
      <div class="ds-list-panel">
        <div class="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div>
            <h2 class="ds-section-heading">Atalhos acionáveis</h2>
            <p class="mt-1 text-xs ds-muted">Caminhos rápidos para as rotinas mais usadas.</p>
          </div>
          <span class="ds-chip">Operação</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 p-4">
          <button
            v-for="action in shortcutActions"
            :key="action.id"
            type="button"
            class="ds-action-card rounded-lg border p-3 pl-4 text-left transition-colors cursor-pointer"
            :style="{
              '--ds-action-bg': action.bg,
              '--ds-action-border': action.border,
              '--ds-action-icon-bg': action.iconBg,
              '--ds-action-bg-dark': action.darkBg,
              '--ds-action-border-dark': action.darkBorder,
              '--ds-action-icon-bg-dark': action.darkIconBg,
            }"
            :title="action.target.requiresAuth && !isLoggedIn ? 'Entre para usar este atalho' : action.description"
            @click="go(action.target)"
          >
            <div class="flex items-start gap-3">
              <span class="ds-action-icon mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border" :class="action.tone">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" :d="action.icon" />
                </svg>
              </span>
              <span class="min-w-0">
                <span class="block text-sm font-semibold text-gray-900 dark:text-gray-100">{{ action.label }}</span>
                <span class="mt-1 block text-xs ds-muted leading-5">{{ action.description }}</span>
              </span>
            </div>
          </button>
        </div>
      </div>

      <div class="ds-list-panel">
        <div class="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div>
            <h2 class="ds-section-heading">Prioridades</h2>
            <p class="mt-1 text-xs ds-muted">Pendências com destino direto para resolver.</p>
          </div>
          <span class="ds-chip">{{ priorityActions.length }}</span>
        </div>
        <div v-if="!priorityActions.length" class="p-4 text-sm ds-muted">Nenhuma prioridade operacional agora.</div>
        <button
          v-for="action in priorityActions"
          :key="action.id"
          type="button"
          class="ds-list-row w-full text-left p-4 cursor-pointer"
          @click="go(action.target)"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm font-semibold truncate" :class="action.tone">{{ action.label }}</p>
              <p class="mt-1 text-xs ds-muted truncate">{{ action.description }}</p>
            </div>
            <svg class="mt-1 h-4 w-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </div>
        </button>
      </div>
    </section>

    <section class="ds-metric-grid">
      <button class="ds-metric ds-metric-danger text-left cursor-pointer" @click="go({ tab: 'inventario', section: 'estoque', status: 'zero' })">
        <p class="ds-metric-label">Sem estoque</p>
        <p class="ds-metric-value text-red-500">{{ stockStats.zero }}</p>
      </button>
      <button class="ds-metric ds-metric-warning text-left cursor-pointer" @click="go({ tab: 'inventario', section: 'estoque', status: '' })">
        <p class="ds-metric-label">Críticos / alerta</p>
        <p class="ds-metric-value text-amber-500">{{ stockStats.critical + stockStats.alert }}</p>
      </button>
      <button class="ds-metric ds-metric-warning text-left cursor-pointer" @click="go({ tab: 'inventario', section: 'estoque', status: '' })">
        <p class="ds-metric-label">Destinos em alerta</p>
        <p class="ds-metric-value text-amber-500">{{ destinationAlerts.length }}</p>
      </button>
      <button class="ds-metric ds-metric-info text-left cursor-pointer" @click="go({ tab: 'movimentacoes', subTab: 'historico' })">
        <p class="ds-metric-label">Saídas no mês</p>
        <p class="ds-metric-value text-red-500">{{ movementStats.saidas }}</p>
      </button>
      <button class="ds-metric ds-metric-brand text-left cursor-pointer" @click="go({ tab: 'ordens', subTab: 'ordens' })">
        <p class="ds-metric-label">OS abertas</p>
        <p class="ds-metric-value">{{ openOrders.length }}</p>
      </button>
      <button class="ds-metric ds-metric-success text-left cursor-pointer" @click="go({ tab: 'motores' })">
        <p class="ds-metric-label">Motores em manutenção</p>
        <p class="ds-metric-value">{{ motorsInMaintenance.length }}</p>
      </button>
      <button class="ds-metric ds-metric-brand text-left cursor-pointer" @click="go({ tab: 'inventario', section: 'fechamentos', requiresAuth: true })">
        <p class="ds-metric-label">Último fechamento</p>
        <p class="ds-metric-value">{{ formatMonth(lastClosing) }}</p>
      </button>
    </section>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <section class="ds-list-panel">
        <div class="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h2 class="ds-section-heading">Estoque em atenção</h2>
          <div class="flex items-center gap-2">
            <span class="ds-chip">{{ lowStockAllRows.length }} itens</span>
            <div v-if="lowStockTotalPages > 1" class="flex items-center gap-1">
              <button class="ds-chip cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed" :disabled="lowStockPage <= 1" @click="lowStockPage--">Anterior</button>
              <span class="ds-chip">{{ lowStockPage }}/{{ lowStockTotalPages }}</span>
              <button class="ds-chip cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed" :disabled="lowStockPage >= lowStockTotalPages" @click="lowStockPage++">Próxima</button>
            </div>
          </div>
        </div>
        <div v-if="!lowStockRows.length" class="p-4 text-sm ds-muted">Nenhum alerta de estoque.</div>
        <button
          v-for="row in lowStockRows"
          :key="row.variation.id"
          class="ds-list-row text-left p-4 cursor-pointer"
          @click="go({ tab: 'inventario', section: 'estoque', status: row.status, search: row.item.name || '' })"
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
          <h2 class="ds-section-heading">Alertas por destino</h2>
          <span class="ds-chip">{{ destinationAlerts.length }} destinos</span>
        </div>
        <div v-if="!destinationAlerts.length" class="p-4 text-sm ds-muted">Nenhum destino com material em alerta.</div>
        <button
          v-for="dest in destinationAlerts"
          :key="dest.id"
          class="ds-list-row text-left p-4 cursor-pointer"
          @click="go({ tab: 'inventario', section: 'estoque', status: '' })"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="font-medium text-gray-900 dark:text-gray-100 truncate">{{ dest.label }}</p>
              <p class="text-xs ds-muted truncate">
                {{ dest.items.map(row => row.item.name).join(' / ') }}
              </p>
            </div>
            <div class="flex flex-wrap justify-end gap-1 shrink-0">
              <span v-if="dest.zero" class="ds-chip text-red-500">{{ dest.zero }} zerados</span>
              <span v-if="dest.critical + dest.alert" class="ds-chip text-amber-500">{{ dest.critical + dest.alert }} alerta</span>
            </div>
          </div>
        </button>
      </section>

      <section class="ds-list-panel">
        <div class="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h2 class="ds-section-heading">Mais consumidos no mês</h2>
          <div class="flex items-center gap-2">
            <span class="ds-chip">Ranking</span>
            <div v-if="consumedTotalPages > 1" class="flex items-center gap-1">
              <button class="ds-chip cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed" :disabled="consumedPage <= 1" @click="consumedPage--">Anterior</button>
              <span class="ds-chip">{{ consumedPage }}/{{ consumedTotalPages }}</span>
              <button class="ds-chip cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed" :disabled="consumedPage >= consumedTotalPages" @click="consumedPage++">Próxima</button>
            </div>
          </div>
        </div>
        <div v-if="!topConsumedItems.length" class="p-4 text-sm ds-muted">Nenhuma saída registrada neste mês.</div>
        <button
          v-for="item in topConsumedItems"
          :key="item.label"
          type="button"
          class="ds-list-row w-full p-4 text-left cursor-pointer"
          @click="go({ tab: 'movimentacoes', subTab: 'historico', search: inventorySearchFromLabel(item.label) })"
        >
          <div class="flex items-center justify-between gap-3">
            <p class="text-sm text-gray-900 dark:text-gray-100 truncate">{{ item.label }}</p>
            <span class="ds-chip">{{ item.qty }}</span>
          </div>
        </button>
      </section>

      <section class="ds-list-panel">
        <div class="p-4 border-b border-gray-200 dark:border-gray-800">
          <h2 class="ds-section-heading">Consumo por destino no mês</h2>
        </div>
        <div v-if="!topDestinations.length" class="p-4 text-sm ds-muted">Nenhum destino com saída neste mês.</div>
        <button
          v-for="dest in topDestinations"
          :key="dest.label"
          type="button"
          class="ds-list-row w-full p-4 text-left cursor-pointer"
          @click="go({ tab: 'movimentacoes', subTab: 'historico', search: dest.label })"
        >
          <div class="flex items-center justify-between gap-3">
            <p class="text-sm text-gray-900 dark:text-gray-100 truncate">{{ dest.label }}</p>
            <span class="ds-chip">{{ dest.qty }}</span>
          </div>
        </button>
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
          @click="go({ tab: 'ordens', subTab: 'ordens', orderId: order.id })"
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
