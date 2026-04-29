<script setup>
import { ref, computed, provide, onMounted, watch } from 'vue'
import CatalogView from './views/CatalogView.vue'
import CadastrosView from './views/CadastrosView.vue'
import InventarioView from './views/InventarioView.vue'
import MovimentacoesView from './views/MovimentacoesView.vue'
import OrdensServicoView from './views/OrdensServicoView.vue'
import MotoresView from './views/MotoresView.vue'
import AppSidebar from './components/ui/AppSidebar.vue'
import HistorySidebar from './components/ui/HistorySidebar.vue'
import ToastContainer from './components/ui/ToastContainer.vue'
import LoginModal from './components/ui/LoginModal.vue'
import AppButton from './components/ui/AppButton.vue'
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
provide('isAdmin', isAdmin)
provide('isLoggedIn', isLoggedIn)
const showLoginModal = ref(false)
const sidebarCollapsed = ref(false)
const catalogSearch = ref('')
const catalogRef = ref(null)
const activeTab = ref('catalogo') // 'catalogo' | 'cadastros' | 'inventario' | 'movimentacoes' | 'ordens'
const movBrowsing = ref(true)
const movSubTab = ref('entrada')
const movRef = ref(null)

const showCatalogSidebar = computed(() =>
  activeTab.value === 'catalogo' || (activeTab.value === 'movimentacoes' && movBrowsing.value)
)
const showHistorySidebar = computed(() =>
  activeTab.value === 'movimentacoes' && movSubTab.value === 'historico'
)
const anySidebar = computed(() => showCatalogSidebar.value || showHistorySidebar.value)

const allTabs = [
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
  ])
  const failed = results.filter(r => r.status === 'rejected')
  if (failed.length) console.error('Erro ao carregar dados:', failed.map(r => r.reason))
  // Users requires admin auth — load separately, ignore failure
  try { await loadUsers() } catch {}
}

onMounted(async () => {
  await checkSession()
  await loadAllData()
})

// Reload data after login
watch(user, (newUser, oldUser) => {
  if (newUser && !oldUser) loadAllData()
})

function onLoginClose() {
  showLoginModal.value = false
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
              @click="activeTab = tab.id"
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
      <main class="flex-1 p-5">
        <!-- Catálogo tab -->
        <CatalogView v-if="activeTab === 'catalogo'" ref="catalogRef" :search="catalogSearch" @update:search="v => catalogSearch = v" />

        <!-- Cadastros tab -->
        <CadastrosView v-else-if="activeTab === 'cadastros'" />

        <!-- Inventário tab -->
        <InventarioView v-else-if="activeTab === 'inventario'" />

        <!-- Movimentações tab -->
        <MovimentacoesView v-else-if="activeTab === 'movimentacoes'" ref="movRef" @update:browsing="v => movBrowsing = v" @update:sub-tab="v => movSubTab = v" />

        <!-- Ordens de Serviço tab -->
        <OrdensServicoView
          v-else-if="activeTab === 'ordens'"
          mode="general"
        />

        <!-- Motores tab -->
        <MotoresView v-else-if="activeTab === 'motores'" />
      </main>
    </div>

    <!-- Login modal -->
    <LoginModal :show="showLoginModal" @close="showLoginModal = false" />

    <!-- Toasts -->
    <ToastContainer />
  </div>
</template>
