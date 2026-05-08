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
import { useRoles } from './composables/useRoles.js'
import { useUsers } from './composables/useUsers.js'
import { useAuth } from './composables/useAuth.js'
import { useWorkOrders } from './composables/useWorkOrders.js'
import { useMotors } from './composables/useMotors.js'
import { useClosings } from './composables/useClosings.js'

const CatalogView = defineAsyncComponent(() => import('./views/CatalogView.vue'))
const CadastrosView = defineAsyncComponent(() => import('./views/CadastrosView.vue'))
const InventarioView = defineAsyncComponent(() => import('./views/InventarioView.vue'))
const MovimentacoesView = defineAsyncComponent(() => import('./views/MovimentacoesView.vue'))
const OrdensServicoView = defineAsyncComponent(() => import('./views/OrdensServicoView.vue'))
const MotoresView = defineAsyncComponent(() => import('./views/MotoresView.vue'))

const { isDark, toggleTheme } = useTheme()
const { uniqueGroups, activeGroup, setActiveGroup, facets, hasActiveFilters, toggleFilter, clearFilters, loadData: loadItems } = useItems()
const { recentMovements, loadData: loadMovements } = useMovements()
const { loadData: loadLocations } = useLocations()
const { loadData: loadDestinations } = useDestinations()
const { loadData: loadPeople } = usePeople()
const { loadData: loadRoles } = useRoles()
const { loadData: loadUsers } = useUsers()
const { isAdmin, isLoggedIn, user, logout, checkSession } = useAuth()
const { loadData: loadWorkOrders } = useWorkOrders()
const { loadData: loadMotors } = useMotors()
const { loadData: loadClosings } = useClosings()
provide('isAdmin', isAdmin)
provide('isLoggedIn', isLoggedIn)
const showLoginModal = ref(false)
const sidebarCollapsed = ref(false)
const catalogSearch = ref('')
const catalogRef = ref(null)
const activeTab = ref('dashboard')
const requestedInventorySection = ref('estoque')
const requestedInventoryStatus = ref('all')
const requestedInventorySearch = ref('')
const requestedOrdersTab = ref('ordens')
const requestedOrderFocusId = ref('')
const movBrowsing = ref(true)
const movSubTab = ref('entrada')
const requestedMovSubTab = ref('entrada')
const requestedMovSearch = ref('')
const requestedMovementPrefill = ref(null)
const movRef = ref(null)
const quickActionsOpen = ref(false)

const showCatalogSidebar = computed(() =>
  activeTab.value === 'catalogo' || (activeTab.value === 'movimentacoes' && movBrowsing.value)
)
const showHistorySidebar = computed(() =>
  activeTab.value === 'movimentacoes' && movSubTab.value === 'historico'
)
const anySidebar = computed(() => showCatalogSidebar.value || showHistorySidebar.value)

const allTabs = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'catalogo', label: 'Catálogo' },
  { id: 'cadastros', label: 'Cadastros', authOnly: true },
  { id: 'inventario', label: 'Inventário' },
  { id: 'movimentacoes', label: 'Movimentações' },
  { id: 'ordens', label: 'Ordens de Serviço' },
  { id: 'motores', label: 'Motores' }
]
const tabs = computed(() => allTabs.filter(t => !t.authOnly || isLoggedIn.value))

// Load all data from API
async function loadAllData() {
  const results = await Promise.allSettled([
    loadItems(),
    loadMovements(),
    loadLocations(),
    loadDestinations(),
    loadPeople(),
    loadRoles(),
    loadWorkOrders(),
    loadMotors(),
    loadClosings(),
  ])
  const failed = results.filter(r => r.status === 'rejected')
  if (failed.length) console.error('Erro ao carregar dados:', failed.map(r => r.reason))
  // Users requires admin auth — load separately, ignore failure
  try { await loadUsers() } catch {}
}

onMounted(async () => {
  await checkSession()
  await loadAllData()
  window.addEventListener('app:data-invalidated', loadAllData)
  window.addEventListener('keydown', handleQuickMovementKeydown)
})

onUnmounted(() => {
  window.removeEventListener('app:data-invalidated', loadAllData)
  window.removeEventListener('keydown', handleQuickMovementKeydown)
})

// Reload data after login
watch(user, (newUser, oldUser) => {
  if (newUser && !oldUser) loadAllData()
})

function onLoginClose() {
  showLoginModal.value = false
}

function openMovementTab(tab, prefill = null) {
  if (!isLoggedIn.value) return
  quickActionsOpen.value = false
  requestedMovementPrefill.value = prefill
  requestedMovSubTab.value = ''
  requestedMovSearch.value = ''
  activeTab.value = 'movimentacoes'
  nextTick(() => {
    requestedMovSubTab.value = tab
  })
}

function openInventoryQuickMovement(payload) {
  openMovementTab(payload.type, payload)
}

function selectMainTab(tabId) {
  if (tabId === 'dashboard') {
    loadAllData()
  }
  if (tabId === 'inventario') {
    requestedInventorySection.value = 'estoque'
    requestedInventoryStatus.value = 'all'
    requestedInventorySearch.value = ''
  }
  if (tabId === 'movimentacoes') {
    requestedMovSearch.value = ''
    requestedMovementPrefill.value = null
  }
  if (tabId === 'ordens') {
    requestedOrdersTab.value = 'ordens'
    requestedOrderFocusId.value = ''
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
  if ((tab === 'fechamentos' || target?.section === 'fechamentos') && !isLoggedIn.value) {
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

function handleQuickMovementKeydown(event) {
  if (!isLoggedIn.value || !event.altKey || event.ctrlKey || event.metaKey) return
  const target = event.target
  const tagName = String(target?.tagName || '').toLowerCase()
  if (target?.isContentEditable || ['input', 'textarea', 'select'].includes(tagName)) return
  const key = String(event.key || '').toLowerCase()
  if (key === 'e') {
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
            <button
              v-for="tab in tabs"
              :key="tab.id"
              class="ds-tab"
              :class="activeTab === tab.id ? 'ds-tab-active' : ''"
              @click="selectMainTab(tab.id)"
            >
              {{ tab.label }}
              <span
                v-if="tab.id === 'movimentacoes' && recentMovements.length > 0"
                class="ml-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-400"
              >{{ recentMovements.length }}</span>
            </button>
          </div>

          <!-- Auth + Theme -->
          <div class="flex items-center gap-1">
          <AppButton
            v-if="isLoggedIn"
            variant="ghost"
            size="sm"
            title="Sair"
            @click="logout(); activeTab = 'catalogo'"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h6a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 16.5 21h-6a2.25 2.25 0 0 1-2.25-2.25V15m-3 0-3-3m0 0 3-3m-3 3H15" />
            </svg>
            {{ user.name }}
          </AppButton>
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
        <CadastrosView v-if="activeTab === 'cadastros'" />

        <!-- Inventário tab -->
        <InventarioView
          v-if="activeTab === 'inventario'"
          :initial-section="requestedInventorySection"
          :initial-status="requestedInventoryStatus"
          :initial-search="requestedInventorySearch"
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
          @update:sub-tab="v => movSubTab = v"
        />

        <!-- Ordens de Serviço tab -->
        <OrdensServicoView
          v-if="activeTab === 'ordens'"
          mode="general"
          :initial-tab="requestedOrdersTab"
          :focus-order-id="requestedOrderFocusId"
        />

        <!-- Motores tab -->
        <MotoresView v-if="activeTab === 'motores'" />
      </main>
    </div>

    <!-- Login modal -->
    <LoginModal :show="showLoginModal" @close="showLoginModal = false" />

    <div v-if="isLoggedIn" class="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2">
      <div
        v-if="quickActionsOpen"
        class="w-48 rounded-lg border border-gray-200 bg-white p-2 shadow-xl dark:border-white/[0.08] dark:bg-gray-900"
      >
        <button
          type="button"
          class="w-full flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
          @click="openMovementTab('entrada')"
        >
          <span>Entrada</span>
          <span class="text-[11px] text-gray-400">Alt+E</span>
        </button>
        <button
          type="button"
          class="w-full flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10 transition-colors cursor-pointer"
          @click="openMovementTab('saida')"
        >
          <span>Saída</span>
          <span class="text-[11px] text-red-300 dark:text-red-400">Alt+S</span>
        </button>
      </div>
      <button
        type="button"
        class="inline-flex h-11 items-center gap-2 rounded-full bg-primary-600 px-4 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-primary-500 cursor-pointer"
        :aria-expanded="quickActionsOpen"
        title="Ações rápidas de movimentação"
        @click="quickActionsOpen = !quickActionsOpen"
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
