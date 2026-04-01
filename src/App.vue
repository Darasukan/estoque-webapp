<script setup>
import { ref, computed } from 'vue'
import CatalogView from './views/CatalogView.vue'
import CadastrosView from './views/CadastrosView.vue'
import InventarioView from './views/InventarioView.vue'
import MovimentacoesView from './views/MovimentacoesView.vue'
import AppSidebar from './components/ui/AppSidebar.vue'
import HistorySidebar from './components/ui/HistorySidebar.vue'
import ToastContainer from './components/ui/ToastContainer.vue'
import { useTheme } from './composables/useTheme.js'
import { useItems } from './composables/useItems.js'
import { useMovements } from './composables/useMovements.js'

const { isDark, toggleTheme } = useTheme()
const { uniqueGroups, activeGroup, setActiveGroup, facets, hasActiveFilters, toggleFilter, clearFilters } = useItems()
const { recentMovements } = useMovements()
const sidebarCollapsed = ref(false)
const activeTab = ref('catalogo') // 'catalogo' | 'cadastros' | 'inventario' | 'movimentacoes'
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

const tabs = [
  { id: 'catalogo', label: 'Catálogo' },
  { id: 'cadastros', label: 'Cadastros' },
  { id: 'inventario', label: 'Inventário' },
  { id: 'movimentacoes', label: 'Movimentações' }
]
</script>

<template>
  <div class="min-h-screen">
    <!-- Catalog Sidebar -->
    <AppSidebar
      v-if="showCatalogSidebar"
      :groups="uniqueGroups"
      :active-group="activeGroup"
      :collapsed="sidebarCollapsed"
      :facets="facets"
      :has-active-filters="hasActiveFilters"
      @toggle="sidebarCollapsed = !sidebarCollapsed"
      @select-group="(g) => setActiveGroup(g)"
      @toggle-filter="(k, v) => toggleFilter(k, v)"
      @clear-filters="clearFilters"
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
      <nav class="sticky top-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div class="flex items-center justify-between px-5 h-12">
          <!-- Tabs -->
          <div class="flex items-center gap-1">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              class="px-4 py-2.5 text-sm font-medium transition-colors relative"
              :class="activeTab === tab.id
                ? 'text-primary-700 dark:text-primary-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'"
              @click="activeTab = tab.id"
            >
              {{ tab.label }}
              <span
                v-if="tab.id === 'movimentacoes' && recentMovements.length > 0"
                class="ml-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-400"
              >{{ recentMovements.length }}</span>
              <!-- Active indicator -->
              <span
                v-if="activeTab === tab.id"
                class="absolute bottom-0 left-2 right-2 h-0.5 bg-primary-700 dark:bg-primary-400 rounded-full"
              ></span>
            </button>
          </div>

          <!-- Theme toggle -->
          <button
            class="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Alternar tema claro/escuro"
            @click="toggleTheme"
          >
            <svg v-if="isDark" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
            </svg>
            <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
            </svg>
          </button>
        </div>
      </nav>

      <!-- Page content -->
      <main class="flex-1 p-5">
        <!-- Catálogo tab -->
        <CatalogView v-if="activeTab === 'catalogo'" />

        <!-- Cadastros tab -->
        <CadastrosView v-else-if="activeTab === 'cadastros'" />

        <!-- Inventário tab -->
        <InventarioView v-else-if="activeTab === 'inventario'" />

        <!-- Movimentações tab -->
        <MovimentacoesView v-else-if="activeTab === 'movimentacoes'" ref="movRef" @update:browsing="v => movBrowsing = v" @update:sub-tab="v => movSubTab = v" />
      </main>
    </div>

    <!-- Toasts -->
    <ToastContainer />
  </div>
</template>
