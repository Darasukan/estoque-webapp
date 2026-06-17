<script setup>
import { ref, computed, provide, onMounted, onUnmounted, watch, nextTick, defineAsyncComponent } from 'vue'
import AppSidebar from './components/ui/AppSidebar.vue'
import HistorySidebar from './components/ui/HistorySidebar.vue'
import ToastContainer from './components/ui/ToastContainer.vue'
import LoginModal from './components/ui/LoginModal.vue'
import AppButton from './components/ui/AppButton.vue'
import DashboardView from './views/DashboardView.vue'
import { useTheme } from './composables/useTheme.js'
import { useItems } from './composables/useItems.js'
import { useMovements } from './composables/useMovements.js'
import { useLocations } from './composables/useLocations.js'
import { useDestinations } from './composables/useDestinations.js'
import { usePeople } from './composables/usePeople.js'
import { useSuppliers } from './composables/useSuppliers.js'
import { useRoles } from './composables/useRoles.js'
import { useEpis } from './composables/useEpis.js'
import { useUsers } from './composables/useUsers.js'
import { useAuth } from './composables/useAuth.js'
import { useWorkOrders } from './composables/useWorkOrders.js'
import { useMotors } from './composables/useMotors.js'
import { useClosings } from './composables/useClosings.js'
import { useToast } from './composables/useToast.js'

const CatalogView = defineAsyncComponent(() => import('./views/CatalogView.vue'))
const CadastrosView = defineAsyncComponent(() => import('./views/CadastrosView.vue'))
const InventarioView = defineAsyncComponent(() => import('./views/InventarioView.vue'))
const MovimentacoesView = defineAsyncComponent(() => import('./views/MovimentacoesView.vue'))
const OrdensServicoView = defineAsyncComponent(() => import('./views/OrdensServicoView.vue'))
const MotoresView = defineAsyncComponent(() => import('./views/MotoresView.vue'))

const { isDark, toggleTheme } = useTheme()
const { items, variations, uniqueGroups, activeGroup, setActiveGroup, facets, hasActiveFilters, toggleFilter, clearFilters, loadData: loadItems } = useItems()
const { loadData: loadMovements } = useMovements()
const { loadData: loadLocations } = useLocations()
const { destinations, getDestFullName, loadData: loadDestinations } = useDestinations()
const { activePeople, loadData: loadPeople } = usePeople()
const { loadData: loadSuppliers } = useSuppliers()
const { loadData: loadRoles } = useRoles()
const { loadData: loadEpis } = useEpis()
const { loadData: loadUsers } = useUsers()
const { isAdmin, isLoggedIn, user, logout, checkSession, changeOwnPassword } = useAuth()
const { workOrders, loadData: loadWorkOrders } = useWorkOrders()
const { motors, loadData: loadMotors } = useMotors()
const { loadData: loadClosings } = useClosings()
const { success, error } = useToast()
const localBrandFavicon = '/local-brand/favicon.png'
const localBrandName = ref('Estoque')
provide('isAdmin', isAdmin)
provide('isLoggedIn', isLoggedIn)
const UI_STATE_KEY = 'estoque_ui_state_v1'

function loadUiState() {
  try {
    return JSON.parse(localStorage.getItem(UI_STATE_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveUiState(patch) {
  const current = loadUiState()
  localStorage.setItem(UI_STATE_KEY, JSON.stringify({ ...current, ...patch }))
}

const savedUiState = loadUiState()
const savedActiveTab = ['dashboard', 'catalogo', 'inventario', 'movimentacoes', 'ordens', 'motores', 'cadastros'].includes(savedUiState.activeTab)
  ? savedUiState.activeTab
  : 'dashboard'
const showLoginModal = ref(false)
const sidebarCollapsed = ref(Boolean(savedUiState.sidebarCollapsed))
const catalogSearch = ref(savedUiState.catalogSearch || '')
const catalogRef = ref(null)
const activeTab = ref(savedActiveTab)
const requestedInventorySection = ref(savedUiState.inventorySection || 'estoque')
const requestedInventoryStatus = ref(savedUiState.inventoryStatus || 'all')
const requestedInventorySearch = ref(savedUiState.inventorySearch || '')
const requestedOrdersTab = ref(savedUiState.ordersTab || 'ordens')
const requestedOrderFocusId = ref('')
const movBrowsing = ref(true)
const movSubTab = ref(savedUiState.movSubTab || 'entrada')
const requestedMovSubTab = ref(savedUiState.movSubTab || 'entrada')
const requestedMovSearch = ref('')
const requestedMovementPrefill = ref(null)
const movRef = ref(null)
const requestedCadastrosTab = ref(savedUiState.cadastrosTab || 'hierarquia')
const quickActionsOpen = ref(false)
const globalCreateOpen = ref(false)
const globalSearchOpen = ref(false)
const globalSearchQuery = ref('')
const globalSearchInputRef = ref(null)
const globalCreateRootRef = ref(null)
const accountMenuRootRef = ref(null)
const quickActionsRootRef = ref(null)
const quickActionToggleRef = ref(null)
const quickEntryRef = ref(null)
const quickExitRef = ref(null)
const shortcutHelpOpen = ref(false)
const shortcutPrefix = ref('')
const accountMenuOpen = ref(false)
const passwordModalOpen = ref(false)
const ownPassword = ref('')
const ownPasswordConfirm = ref('')
const changingOwnPassword = ref(false)
let shortcutPrefixTimer = null

const showCatalogSidebar = computed(() =>
  activeTab.value === 'catalogo' || (activeTab.value === 'movimentacoes' && movBrowsing.value)
)
const showHistorySidebar = computed(() =>
  activeTab.value === 'movimentacoes' && movSubTab.value === 'historico'
)
const anySidebar = computed(() => showCatalogSidebar.value || showHistorySidebar.value)
const showQuickMovementActions = computed(() =>
  isLoggedIn.value && activeTab.value !== 'movimentacoes'
)

const allTabs = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'catalogo', label: 'Catálogo' },
  { id: 'inventario', label: 'Inventário' },
  { id: 'movimentacoes', label: 'Movimentações' },
  { id: 'ordens', label: 'Ordens de Serviço' },
  { id: 'motores', label: 'Motores' },
  { id: 'cadastros', label: 'Cadastros', authOnly: true }
]
const tabs = computed(() => allTabs.filter(t => !t.authOnly || isLoggedIn.value))

const navigationShortcuts = [
  { chord: 'G D', key: 'd', label: 'Dashboard', target: { tab: 'dashboard' } },
  { chord: 'G C', key: 'c', label: 'Catálogo', target: { tab: 'catalogo' } },
  { chord: 'G I', key: 'i', label: 'Inventário', target: { tab: 'inventario' } },
  { chord: 'G V', key: 'v', label: 'Movimentações', target: { tab: 'movimentacoes' } },
  { chord: 'G O', key: 'o', label: 'Ordens de Serviço', target: { tab: 'ordens' } },
  { chord: 'G M', key: 'm', label: 'Motores', target: { tab: 'motores' } },
  { chord: 'G A', key: 'a', label: 'Cadastros', target: { tab: 'cadastros', requiresAuth: true } },
]

const actionShortcuts = [
  { chord: '?', label: 'Abrir atalhos', always: true },
  { chord: 'Ctrl K', label: 'Busca global', always: true },
  { chord: 'Ctrl N', label: 'Novo registro', always: true },
  { chord: 'M', label: 'Abrir movimentação rápida', requiresQuickMovement: true },
  { chord: 'M E', label: 'Entrada rápida', requiresQuickMovement: true },
  { chord: 'M S', label: 'Saída rápida', requiresQuickMovement: true },
]

const visibleNavigationShortcuts = computed(() =>
  navigationShortcuts.filter(shortcut => !shortcut.target?.requiresAuth || isLoggedIn.value)
)

const visibleActionShortcuts = computed(() =>
  actionShortcuts.filter(shortcut => shortcut.always || !shortcut.requiresQuickMovement || showQuickMovementActions.value)
)

const createActions = computed(() => [
  { id: 'entrada', label: 'Entrada', hint: 'Registrar material chegando', target: { tab: 'movimentacoes', subTab: 'entrada', requiresAuth: true } },
  { id: 'saida', label: 'Saida', hint: 'Retirar material do estoque', target: { tab: 'movimentacoes', subTab: 'saida', requiresAuth: true } },
  { id: 'os', label: 'Nova OS', hint: 'Abrir ordem de servico', target: { tab: 'ordens', subTab: 'nova', requiresAuth: true } },
  { id: 'pessoa', label: 'Pessoa', hint: 'Cadastrar funcionario ou solicitante', target: { tab: 'cadastros', subTab: 'pessoas', requiresAuth: true } },
  { id: 'destino', label: 'Destino', hint: 'Cadastrar maquina, local ou destino', target: { tab: 'cadastros', subTab: 'destinos', requiresAuth: true } },
  { id: 'item', label: 'Item', hint: 'Abrir cadastro do catalogo', target: { tab: 'cadastros', subTab: 'hierarquia', requiresAuth: true } },
])

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function variationSearchLabel(item, variation) {
  const attrs = Object.entries({ ...(variation.values || {}), ...(variation.extras || {}) })
    .map(([key, value]) => `${key}: ${value}`)
    .join(' / ')
  return attrs ? `${item.name} - ${attrs}` : item.name
}

function resultMatches(parts, query) {
  const text = normalizeSearchText(parts.filter(Boolean).join(' '))
  return !query || text.includes(query)
}

const globalSearchResults = computed(() => {
  const q = normalizeSearchText(globalSearchQuery.value.trim())
  if (!q) return []
  const results = []

  for (const order of workOrders.value) {
    if (results.length >= 8) break
    if (!resultMatches([order.number, order.title, order.requestedBy, order.equipment, order.destinationName, order.motorTag], q)) continue
    results.push({
      id: `os:${order.id}`,
      type: 'OS',
      title: `OS #${order.number}`,
      subtitle: order.title || order.equipment || order.destinationName || 'Ordem de servico',
      target: { tab: 'ordens', subTab: 'ordens', orderId: order.id },
    })
  }

  for (const motor of motors.value) {
    if (results.length >= 12) break
    if (!resultMatches([motor.tag, motor.name, motor.model, motor.locationName, motor.status], q)) continue
    results.push({
      id: `motor:${motor.id}`,
      type: 'Motor',
      title: motor.tag || motor.name || 'Motor',
      subtitle: [motor.name, motor.locationName, motor.status].filter(Boolean).join(' - '),
      target: { tab: 'motores' },
    })
  }

  for (const person of activePeople.value) {
    if (results.length >= 16) break
    if (!resultMatches([person.name, person.role], q)) continue
    results.push({
      id: `pessoa:${person.id}`,
      type: 'Pessoa',
      title: person.name,
      subtitle: person.role || 'Cadastro de pessoa',
      target: { tab: 'cadastros', subTab: 'pessoas', requiresAuth: true },
    })
  }

  for (const dest of destinations.value) {
    if (results.length >= 20) break
    const fullName = getDestFullName(dest.id)
    if (!resultMatches([dest.name, fullName, dest.description], q)) continue
    results.push({
      id: `destino:${dest.id}`,
      type: 'Destino',
      title: fullName || dest.name,
      subtitle: 'Cadastro de destinos',
      target: { tab: 'cadastros', subTab: 'destinos', requiresAuth: true },
    })
  }

  for (const item of items.value) {
    if (results.length >= 26) break
    if (!resultMatches([item.name, item.group, item.category, item.subcategory], q)) continue
    results.push({
      id: `item:${item.id}`,
      type: 'Item',
      title: item.name,
      subtitle: [item.group, item.category, item.subcategory].filter(Boolean).join(' > '),
      target: { tab: 'catalogo', itemId: item.id, search: item.name },
    })
  }

  for (const variation of variations.value) {
    if (results.length >= 30) break
    const item = items.value.find(row => row.id === variation.itemId)
    if (!item) continue
    const label = variationSearchLabel(item, variation)
    if (!resultMatches([label, variation.location], q)) continue
    results.push({
      id: `var:${variation.id}`,
      type: 'Variacao',
      title: label,
      subtitle: `Estoque: ${variation.stock ?? 0} ${item.unit || 'un'}`,
      target: { tab: 'catalogo', itemId: item.id, variationId: variation.id, search: item.name },
    })
  }

  return results.slice(0, 12)
})

// Load all data from API
async function loadAllData() {
  const results = await Promise.allSettled([
    loadItems(),
    loadMovements(),
    loadLocations(),
    loadDestinations(),
    loadPeople(),
    loadSuppliers(),
    loadRoles(),
    loadEpis(),
    loadWorkOrders(),
    loadMotors(),
    loadClosings(),
  ])
  const failed = results.filter(r => r.status === 'rejected')
  if (failed.length) console.error('Erro ao carregar dados:', failed.map(r => r.reason))
  // Users requires admin auth — load separately, ignore failure
  try { await loadUsers() } catch {}
}

async function loadLocalBrand() {
  try {
    const response = await fetch('/local-brand/brand.json', { cache: 'no-store' })
    if (!response.ok) return
    const data = await response.json()
    if (typeof data.name === 'string' && data.name.trim()) localBrandName.value = data.name.trim()
  } catch {}
}

onMounted(async () => {
  loadLocalBrand()
  await checkSession()
  if (activeTab.value === 'cadastros' && !isLoggedIn.value) activeTab.value = 'catalogo'
  await loadAllData()
  if (savedUiState.catalogGroup) activeGroup.value = savedUiState.catalogGroup
  window.addEventListener('app:data-invalidated', loadAllData)
  window.addEventListener('keydown', handleGlobalShortcutKeydown)
  window.addEventListener('mousedown', handleGlobalPointerDown, true)
})

onUnmounted(() => {
  window.removeEventListener('app:data-invalidated', loadAllData)
  window.removeEventListener('keydown', handleGlobalShortcutKeydown)
  window.removeEventListener('mousedown', handleGlobalPointerDown, true)
  clearShortcutPrefix()
})

// Reload data after login
watch(user, (newUser, oldUser) => {
  if (newUser && !oldUser) loadAllData()
  if (!newUser && activeTab.value === 'cadastros') activeTab.value = 'catalogo'
})

watch(activeTab, value => {
  saveUiState({ activeTab: value })
  if (value === 'movimentacoes') quickActionsOpen.value = false
})
watch(sidebarCollapsed, value => saveUiState({ sidebarCollapsed: value }))
watch(catalogSearch, value => saveUiState({ catalogSearch: value }))
watch(activeGroup, value => saveUiState({ catalogGroup: value || '' }))
watch(requestedInventorySection, value => { if (value) saveUiState({ inventorySection: value }) })
watch(requestedInventoryStatus, value => { if (value && value !== '__pending__') saveUiState({ inventoryStatus: value }) })
watch(requestedInventorySearch, value => saveUiState({ inventorySearch: value || '' }))
watch(movSubTab, value => { if (value) saveUiState({ movSubTab: value }) })
watch(requestedOrdersTab, value => { if (value) saveUiState({ ordersTab: value }) })
watch(requestedCadastrosTab, value => { if (value) saveUiState({ cadastrosTab: value }) })

function onLoginClose() {
  showLoginModal.value = false
}

function openPasswordModal() {
  accountMenuOpen.value = false
  ownPassword.value = ''
  ownPasswordConfirm.value = ''
  passwordModalOpen.value = true
}

function closePasswordModal() {
  passwordModalOpen.value = false
  ownPassword.value = ''
  ownPasswordConfirm.value = ''
  changingOwnPassword.value = false
}

async function submitOwnPassword() {
  if (changingOwnPassword.value) return
  if (!ownPassword.value.trim()) { error('Informe a nova senha.'); return }
  if (ownPassword.value !== ownPasswordConfirm.value) { error('As senhas nao conferem.'); return }
  changingOwnPassword.value = true
  const result = await changeOwnPassword(ownPassword.value)
  changingOwnPassword.value = false
  if (!result.ok) { error(result.error); return }
  success('Senha alterada.')
  closePasswordModal()
}

function logoutFromMenu() {
  accountMenuOpen.value = false
  logout()
  activeTab.value = 'catalogo'
}

function openMovementTab(tab, prefill = null) {
  if (!isLoggedIn.value) return
  quickActionsOpen.value = false
  shortcutHelpOpen.value = false
  requestedMovementPrefill.value = prefill
  requestedMovSubTab.value = ''
  requestedMovSearch.value = ''
  activeTab.value = 'movimentacoes'
  nextTick(() => {
    requestedMovSubTab.value = tab
  })
}

function openGlobalSearch() {
  globalSearchOpen.value = true
  globalCreateOpen.value = false
  shortcutHelpOpen.value = false
  quickActionsOpen.value = false
  clearShortcutPrefix()
  nextTick(() => globalSearchInputRef.value?.focus())
}

function closeGlobalSearch() {
  globalSearchOpen.value = false
  globalSearchQuery.value = ''
}

function openGlobalCreate() {
  if (!isLoggedIn.value) {
    showLoginModal.value = true
    return
  }
  globalCreateOpen.value = !globalCreateOpen.value
  shortcutHelpOpen.value = false
  quickActionsOpen.value = false
  clearShortcutPrefix()
}

function runCreateAction(action) {
  globalCreateOpen.value = false
  navigateTab(action.target)
}

function closeTopPopup() {
  if (globalSearchOpen.value) {
    closeGlobalSearch()
    return true
  }
  if (globalCreateOpen.value) {
    globalCreateOpen.value = false
    return true
  }
  if (shortcutHelpOpen.value) {
    closeShortcutHelp()
    return true
  }
  if (quickActionsOpen.value) {
    closeQuickActions()
    return true
  }
  if (passwordModalOpen.value) {
    closePasswordModal()
    return true
  }
  if (accountMenuOpen.value) {
    accountMenuOpen.value = false
    return true
  }
  if (showLoginModal.value) {
    showLoginModal.value = false
    return true
  }
  return false
}

function handleGlobalPointerDown(event) {
  const target = event.target
  if (!(target instanceof Node)) return
  if (globalCreateOpen.value && !globalCreateRootRef.value?.contains(target)) {
    globalCreateOpen.value = false
  }
  if (accountMenuOpen.value && !accountMenuRootRef.value?.contains(target)) {
    accountMenuOpen.value = false
  }
  if (quickActionsOpen.value && !quickActionsRootRef.value?.contains(target)) {
    quickActionsOpen.value = false
  }
}

function isEditableTarget(target) {
  const tagName = String(target?.tagName || '').toLowerCase()
  return Boolean(target?.isContentEditable || ['input', 'textarea', 'select'].includes(tagName))
}

function focusQuickEntry() {
  nextTick(() => quickEntryRef.value?.focus())
}

function closeQuickActions() {
  quickActionsOpen.value = false
  nextTick(() => quickActionToggleRef.value?.focus())
}

function toggleQuickActions() {
  if (!showQuickMovementActions.value) return
  quickActionsOpen.value = !quickActionsOpen.value
  shortcutHelpOpen.value = false
  clearShortcutPrefix()
  if (quickActionsOpen.value) focusQuickEntry()
}

function clearShortcutPrefix() {
  shortcutPrefix.value = ''
  if (shortcutPrefixTimer) {
    window.clearTimeout(shortcutPrefixTimer)
    shortcutPrefixTimer = null
  }
}

function startShortcutPrefix(prefix) {
  clearShortcutPrefix()
  shortcutPrefix.value = prefix
  shortcutPrefixTimer = window.setTimeout(clearShortcutPrefix, 1500)
}

function toggleShortcutHelp() {
  shortcutHelpOpen.value = !shortcutHelpOpen.value
  quickActionsOpen.value = false
  clearShortcutPrefix()
}

function closeShortcutHelp() {
  shortcutHelpOpen.value = false
  clearShortcutPrefix()
}

function runNavigationShortcut(shortcut) {
  closeShortcutHelp()
  quickActionsOpen.value = false
  navigateTab(shortcut.target)
}

function openGlobalSearchResult(result) {
  if (!result) return
  closeGlobalSearch()
  if (result.target?.search) {
    catalogSearch.value = result.target.search
  }
  navigateTab(result.target)
  if (result.target?.tab === 'catalogo') {
    nextTick(() => {
      if (result.target.variationId) {
        catalogRef.value?.openVariationById?.(result.target.variationId)
      } else if (result.target.itemId) {
        catalogRef.value?.openItemById?.(result.target.itemId)
      }
    })
  }
}

function openInventoryQuickMovement(payload) {
  if (!payload?.variationId || !payload?.itemId) {
    if (payload?.targetType && payload?.targetKey) {
      openMovementTab(payload?.type || 'saida', payload)
      return
    }
    openMovementTab(payload?.type || 'saida')
    return
  }
  openMovementTab(payload.type, payload)
}

function openCadastroQuickMovement(payload) {
  if (!payload?.variationId || !payload?.itemId) {
    if (payload?.targetType && payload?.targetKey) {
      openMovementTab(payload?.type || 'saida', payload)
      return
    }
    openMovementTab(payload?.type || 'saida')
    return
  }
  openMovementTab(payload.type || 'saida', payload)
}

function selectMainTab(tabId) {
  if (tabId === 'cadastros' && !isLoggedIn.value) {
    showLoginModal.value = true
    return
  }
  if (tabId === 'dashboard') {
    loadAllData()
  }
  activeTab.value = tabId
}

function navigateTab(target) {
  const tab = typeof target === 'string' ? target : target?.tab
  if (!tab) return
  if (target?.requiresAuth && !isLoggedIn.value) {
    showLoginModal.value = true
    return
  }
  if ((tab === 'fechamentos' || target?.section === 'fechamentos' || target?.section === 'epis') && !isLoggedIn.value) {
    showLoginModal.value = true
    return
  }
  if (tab === 'fechamentos') {
    requestedInventorySection.value = 'fechamentos'
    requestedInventorySearch.value = ''
    activeTab.value = 'inventario'
    return
  }
  if (tab === 'inventario') {
    const section = target?.section || 'estoque'
    const status = target?.status ?? 'all'
    const search = target?.search || ''
    requestedInventorySection.value = ''
    requestedInventoryStatus.value = '__pending__'
    requestedInventorySearch.value = ''
    activeTab.value = 'inventario'
    nextTick(() => {
      requestedInventorySection.value = section
      requestedInventoryStatus.value = status
      requestedInventorySearch.value = search
    })
    return
  }
  if (tab === 'movimentacoes' && target?.subTab) {
    const search = target?.search || ''
    if (['entrada', 'saida'].includes(target.subTab)) {
      openMovementTab(target.subTab)
      return
    }
    requestedMovSubTab.value = ''
    requestedMovSearch.value = ''
    activeTab.value = 'movimentacoes'
    nextTick(() => {
      requestedMovSubTab.value = target.subTab
      requestedMovSearch.value = search
    })
    return
  }
  if (tab === 'cadastros' && target?.subTab) {
    if (!isLoggedIn.value) {
      showLoginModal.value = true
      return
    }
    requestedCadastrosTab.value = target.subTab
    activeTab.value = 'cadastros'
    return
  }
  if (tab === 'ordens') {
    requestedOrdersTab.value = ''
    requestedOrderFocusId.value = ''
    activeTab.value = 'ordens'
    nextTick(() => {
      requestedOrdersTab.value = target?.subTab || 'ordens'
      requestedOrderFocusId.value = target?.orderId || ''
    })
    return
  }
  activeTab.value = tab
}

function handleGlobalShortcutKeydown(event) {
  const key = String(event.key || '').toLowerCase()
  if (key === 'escape') {
    if (closeTopPopup()) {
      event.preventDefault()
      event.stopPropagation()
      return
    }
    clearShortcutPrefix()
    return
  }
  if ((event.ctrlKey || event.metaKey) && key === 'k') {
    event.preventDefault()
    openGlobalSearch()
    return
  }
  if ((event.ctrlKey || event.metaKey) && key === 'n') {
    event.preventDefault()
    openGlobalCreate()
    return
  }
  if (event.altKey || event.ctrlKey || event.metaKey) return
  if (isEditableTarget(event.target)) return
  if (key === '?' || (key === '/' && event.shiftKey)) {
    event.preventDefault()
    toggleShortcutHelp()
    return
  }
  if (shortcutPrefix.value === 'g') {
    const shortcut = navigationShortcuts.find(item => item.key === key)
    if (shortcut) {
      event.preventDefault()
      runNavigationShortcut(shortcut)
    } else if (key !== 'g') {
      clearShortcutPrefix()
    }
    return
  }
  if (key === 'g') {
    event.preventDefault()
    quickActionsOpen.value = false
    startShortcutPrefix('g')
    return
  }
  if (!showQuickMovementActions.value) return
  if (key === 'm' && !quickActionsOpen.value) {
    event.preventDefault()
    shortcutHelpOpen.value = false
    quickActionsOpen.value = true
    focusQuickEntry()
    return
  }
  if (!quickActionsOpen.value) return
  if (key === 'arrowdown' || key === 'arrowup') {
    event.preventDefault()
    const active = document.activeElement
    const next = active === quickEntryRef.value ? quickExitRef.value : quickEntryRef.value
    next?.focus()
  } else if (key === 'e') {
    event.preventDefault()
    openMovementTab('entrada')
  } else if (key === 's') {
    event.preventDefault()
    openMovementTab('saida')
  }
}

</script>

<template>
  <div class="ds-page">
    <!-- Catalog Sidebar -->
    <AppSidebar
      v-if="showCatalogSidebar"
      :groups="uniqueGroups"
      :active-group="activeGroup"
      :collapsed="sidebarCollapsed"
      :facets="facets"
      :has-active-filters="hasActiveFilters"
      :search="catalogSearch"
      @toggle="sidebarCollapsed = !sidebarCollapsed"
      @select-group="(g) => setActiveGroup(g)"
      @toggle-filter="(k, v) => toggleFilter(k, v)"
      @clear-filters="clearFilters"
      @update:search="v => catalogSearch = v"
      @search-submit="catalogRef?.triggerSearchDrill?.()"
    />

    <!-- History Sidebar -->
    <HistorySidebar
      v-if="showHistorySidebar && movRef"
      :collapsed="sidebarCollapsed"
      :facets="movRef.histFacets"
      :has-active-filters="movRef.hasHistFilters"
      :search="movRef.histSearch"
      :date-from="movRef.histDateFrom"
      :date-to="movRef.histDateTo"
      @toggle="sidebarCollapsed = !sidebarCollapsed"
      @toggle-filter="(k, v) => movRef.toggleHistFilter(k, v)"
      @clear-filters="movRef.clearHistFilters()"
      @update:search="v => movRef.histSearch = v"
      @update:date-from="v => movRef.histDateFrom = v"
      @update:date-to="v => movRef.histDateTo = v"
    />

    <!-- Main content -->
    <div
      class="transition-all duration-300 flex flex-col min-h-screen"
      :class="anySidebar ? (sidebarCollapsed ? 'ml-12' : 'ml-60') : ''"
    >
      <!-- Navbar -->
      <nav class="sticky top-0 z-30 ds-nav">
        <div class="flex items-center justify-between px-5 h-12">
          <!-- Tabs -->
          <div class="flex items-center gap-1">
            <div class="mr-2 flex items-center gap-2 border-r border-gray-200 pr-3 dark:border-white/[0.08]">
              <img
                :src="localBrandFavicon"
                :alt="localBrandName"
                class="h-8 w-8 rounded-md bg-white object-contain p-0.5 shadow-sm"
                @error="$event.currentTarget.style.display = 'none'"
              />
              <span class="hidden text-sm font-semibold text-gray-800 dark:text-gray-100 sm:inline">{{ localBrandName }}</span>
            </div>
            <button
              v-for="tab in tabs"
              :key="tab.id"
              class="ds-tab"
              :class="activeTab === tab.id ? 'ds-tab-active' : ''"
              @click="selectMainTab(tab.id)"
            >
              {{ tab.label }}
            </button>
          </div>

          <!-- Auth + Theme -->
          <div class="flex items-center gap-1">
          <AppButton
            variant="ghost"
            size="sm"
            title="Busca global (Ctrl+K)"
            @click="openGlobalSearch"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0Z" />
            </svg>
            Buscar
          </AppButton>
          <div ref="globalCreateRootRef" class="relative">
            <AppButton
              variant="primary"
              size="sm"
              title="Novo registro (Ctrl+N)"
              :aria-expanded="globalCreateOpen"
              @click="openGlobalCreate"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Novo
            </AppButton>
            <div
              v-if="globalCreateOpen"
              class="absolute right-0 mt-2 w-72 rounded-lg border border-gray-200 bg-white p-2 shadow-xl dark:border-white/[0.08] dark:bg-gray-900"
            >
              <button
                v-for="action in createActions"
                :key="action.id"
                type="button"
                class="block w-full rounded-md px-3 py-2 text-left transition-colors hover:bg-gray-100 dark:hover:bg-white/[0.06]"
                @click="runCreateAction(action)"
              >
                <span class="block text-sm font-semibold text-gray-900 dark:text-gray-100">{{ action.label }}</span>
                <span class="block text-xs text-gray-500 dark:text-gray-400">{{ action.hint }}</span>
              </button>
            </div>
          </div>
          <div v-if="isLoggedIn" ref="accountMenuRootRef" class="relative">
            <AppButton
              variant="ghost"
              size="sm"
              title="Conta"
              :aria-expanded="accountMenuOpen"
              @click="accountMenuOpen = !accountMenuOpen"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0" />
              </svg>
              {{ user.name }}
            </AppButton>
            <div
              v-if="accountMenuOpen"
              class="absolute right-0 mt-2 w-44 rounded-lg border border-gray-200 bg-white p-1 shadow-xl dark:border-white/[0.08] dark:bg-gray-900"
            >
              <button
                type="button"
                class="w-full rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/[0.06]"
                @click="openPasswordModal"
              >
                Trocar senha
              </button>
              <button
                type="button"
                class="w-full rounded-md px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
                @click="logoutFromMenu"
              >
                Sair
              </button>
            </div>
          </div>
          <AppButton
            v-else
            variant="ghost"
            size="sm"
            title="Entrar"
            @click="showLoginModal = true"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
            Entrar
          </AppButton>
          <AppButton
            variant="ghost"
            size="icon"
            title="Alternar tema claro/escuro"
            @click="toggleTheme"
          >
            <svg v-if="isDark" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
            </svg>
            <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
            </svg>
          </AppButton>
          </div>
        </div>
      </nav>

      <!-- Page content -->
      <main class="flex-1 p-4 sm:p-5 lg:p-6">
        <KeepAlive>
          <DashboardView v-if="activeTab === 'dashboard'" @go="navigateTab" />
        </KeepAlive>

        <!-- Catálogo tab -->
        <CatalogView
          v-if="activeTab === 'catalogo'"
          ref="catalogRef"
          :search="catalogSearch"
          @update:search="v => catalogSearch = v"
          @quick-movement="openInventoryQuickMovement"
        />

        <!-- Cadastros tab -->
        <CadastrosView
          v-if="activeTab === 'cadastros'"
          :initial-tab="requestedCadastrosTab"
          @update:tab="v => requestedCadastrosTab = v"
          @quick-movement="openCadastroQuickMovement"
        />

        <!-- Inventário tab -->
        <InventarioView
          v-if="activeTab === 'inventario'"
          :initial-section="requestedInventorySection"
          :initial-status="requestedInventoryStatus"
          :initial-search="requestedInventorySearch"
          @update:section="v => requestedInventorySection = v"
          @update:status="v => requestedInventoryStatus = v"
          @update:search="v => requestedInventorySearch = v"
          @quick-movement="openInventoryQuickMovement"
        />

        <!-- Movimentações tab -->
        <MovimentacoesView
          v-if="activeTab === 'movimentacoes'"
          ref="movRef"
          :initial-sub-tab="requestedMovSubTab"
          :initial-history-search="requestedMovSearch"
          :prefill-movement="requestedMovementPrefill"
          @update:browsing="v => movBrowsing = v"
          @update:sub-tab="v => { movSubTab = v; requestedMovSubTab = v }"
        />

        <!-- Ordens de Serviço tab -->
        <OrdensServicoView
          v-if="activeTab === 'ordens'"
          mode="general"
          :initial-tab="requestedOrdersTab"
          :focus-order-id="requestedOrderFocusId"
          @update:tab="v => requestedOrdersTab = v"
        />

        <!-- Motores tab -->
        <MotoresView v-if="activeTab === 'motores'" />
      </main>
    </div>

    <!-- Login modal -->
    <LoginModal :show="showLoginModal" @close="showLoginModal = false" />

    <div
      v-if="globalSearchOpen"
      class="fixed inset-0 z-50 flex items-start justify-center bg-black/45 p-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Busca global"
      @click.self="closeGlobalSearch"
      @keydown.escape="closeGlobalSearch"
    >
      <div class="w-full max-w-2xl overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-white/[0.08] dark:bg-gray-900">
        <div class="border-b border-gray-200 p-3 dark:border-white/[0.08]">
          <div class="relative">
            <svg class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0Z" />
            </svg>
            <input
              ref="globalSearchInputRef"
              v-model="globalSearchQuery"
              type="text"
              class="w-full rounded-lg border border-gray-300 bg-white py-3 pl-9 pr-3 text-sm text-gray-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              placeholder="Buscar item, OS, motor, pessoa ou destino..."
              @keydown.enter.prevent="openGlobalSearchResult(globalSearchResults[0])"
            />
          </div>
        </div>
        <div class="max-h-[26rem] overflow-auto p-2">
          <button
            v-for="result in globalSearchResults"
            :key="result.id"
            type="button"
            class="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-gray-100 dark:hover:bg-white/[0.06]"
            @click="openGlobalSearchResult(result)"
          >
            <span class="mt-0.5 rounded-md bg-primary-50 px-2 py-1 text-[11px] font-semibold text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">{{ result.type }}</span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{{ result.title }}</span>
              <span class="block truncate text-xs text-gray-500 dark:text-gray-400">{{ result.subtitle }}</span>
            </span>
          </button>
          <div v-if="globalSearchQuery && !globalSearchResults.length" class="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            Nenhum resultado encontrado.
          </div>
          <div v-if="!globalSearchQuery" class="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            Digite para procurar em OS, catalogo, motores, pessoas e destinos.
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="passwordModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Trocar senha"
      @click.self="closePasswordModal"
      @keydown.escape="closePasswordModal"
    >
      <div class="ds-panel w-full max-w-sm p-5" @click.stop>
        <div class="mb-4">
          <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">Trocar senha</h2>
          <p class="text-xs text-gray-500 dark:text-gray-400">Conta: {{ user?.name }}</p>
        </div>
        <form class="space-y-3" @submit.prevent="submitOwnPassword">
          <input
            v-model="ownPassword"
            type="password"
            autocomplete="new-password"
            class="ds-input"
            placeholder="Nova senha"
            autofocus
          />
          <input
            v-model="ownPasswordConfirm"
            type="password"
            autocomplete="new-password"
            class="ds-input"
            placeholder="Confirmar nova senha"
          />
          <div class="flex justify-end gap-2 pt-1">
            <AppButton type="button" variant="secondary" @click="closePasswordModal">Cancelar</AppButton>
            <AppButton type="submit" variant="primary" :loading="changingOwnPassword">Salvar senha</AppButton>
          </div>
        </form>
      </div>
    </div>

    <div
      v-if="shortcutHelpOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Atalhos de teclado"
      @click.self="closeShortcutHelp"
    >
      <div class="w-full max-w-xl rounded-lg border border-gray-200 bg-white shadow-2xl dark:border-white/[0.08] dark:bg-gray-900">
        <div class="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-white/[0.08]">
          <div>
            <h2 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Atalhos</h2>
            <p class="text-xs text-gray-500 dark:text-gray-400">Use fora dos campos de digitação.</p>
          </div>
          <AppButton variant="ghost" size="xs" @click="closeShortcutHelp">Fechar</AppButton>
        </div>

        <div class="grid gap-4 p-4 md:grid-cols-2">
          <section>
            <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Navegação</h3>
            <div class="space-y-1">
              <button
                v-for="shortcut in visibleNavigationShortcuts"
                :key="shortcut.chord"
                type="button"
                class="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/[0.06]"
                @click="runNavigationShortcut(shortcut)"
              >
                <span>{{ shortcut.label }}</span>
                <kbd class="rounded border border-gray-300 bg-gray-50 px-2 py-0.5 text-[11px] font-semibold text-gray-600 dark:border-white/[0.12] dark:bg-white/[0.04] dark:text-gray-300">{{ shortcut.chord }}</kbd>
              </button>
            </div>
          </section>

          <section>
            <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Ações</h3>
            <div class="space-y-1">
              <div
                v-for="shortcut in visibleActionShortcuts"
                :key="shortcut.chord"
                class="flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm text-gray-700 dark:text-gray-200"
              >
                <span>{{ shortcut.label }}</span>
                <kbd class="rounded border border-gray-300 bg-gray-50 px-2 py-0.5 text-[11px] font-semibold text-gray-600 dark:border-white/[0.12] dark:bg-white/[0.04] dark:text-gray-300">{{ shortcut.chord }}</kbd>
              </div>
              <div class="flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm text-gray-700 dark:text-gray-200">
                <span>Fechar menus</span>
                <kbd class="rounded border border-gray-300 bg-gray-50 px-2 py-0.5 text-[11px] font-semibold text-gray-600 dark:border-white/[0.12] dark:bg-white/[0.04] dark:text-gray-300">Esc</kbd>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>

    <div
      v-if="shortcutPrefix"
      class="fixed bottom-5 left-5 z-50 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-lg dark:border-white/[0.08] dark:bg-gray-900 dark:text-gray-200"
    >
      {{ shortcutPrefix.toUpperCase() }}...
    </div>

    <div v-if="showQuickMovementActions" ref="quickActionsRootRef" class="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2">
      <div
        v-if="quickActionsOpen"
        id="quick-movement-menu"
        class="w-48 rounded-lg border border-gray-200 bg-white p-2 shadow-xl dark:border-white/[0.08] dark:bg-gray-900"
      >
        <button
          ref="quickEntryRef"
          type="button"
          class="w-full flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
          @click="openMovementTab('entrada')"
        >
          <span>Entrada</span>
          <span class="text-[11px] text-gray-400">M, E</span>
        </button>
        <button
          ref="quickExitRef"
          type="button"
          class="w-full flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10 transition-colors cursor-pointer"
          @click="openMovementTab('saida')"
        >
          <span>Saída</span>
          <span class="text-[11px] text-red-300 dark:text-red-400">M, S</span>
        </button>
      </div>
      <button
        ref="quickActionToggleRef"
        type="button"
        class="inline-flex h-11 items-center gap-2 rounded-full bg-primary-600 px-4 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-primary-500 cursor-pointer"
        :aria-expanded="quickActionsOpen"
        aria-controls="quick-movement-menu"
        title="Ações rápidas de movimentação. Tecla M abre o menu."
        @click="toggleQuickActions"
      >
        <svg class="h-4 w-4 transition-transform" :class="quickActionsOpen ? 'rotate-45' : ''" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14m7-7H5" />
        </svg>
        Movimentar
      </button>
    </div>

    <!-- Toasts -->
    <ToastContainer />
  </div>
</template>
