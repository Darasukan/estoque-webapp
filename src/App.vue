<script setup>
import { ref } from 'vue'
import CatalogView from './views/CatalogView.vue'
import ManageView from './views/ManageView.vue'
import CadastroView from './views/CadastroView.vue'
import AppSidebar from './components/ui/AppSidebar.vue'
import ToastContainer from './components/ui/ToastContainer.vue'
import { useTheme } from './composables/useTheme.js'
import { useItems } from './composables/useItems.js'

const { isDark, toggleTheme } = useTheme()
const { uniqueGroups, activeGroup, setActiveGroup, facets, hasActiveFilters, toggleFilter, clearFilters } = useItems()
const sidebarCollapsed = ref(false)
const activeTab = ref('catalogo') // 'catalogo' | 'cadastros' | 'inventario' | 'movimentacoes'

const tabs = [
  { id: 'catalogo', label: 'Catálogo' },
  { id: 'cadastros', label: 'Cadastros' },
  { id: 'itens', label: 'Itens' },
  { id: 'inventario', label: 'Inventário' },
  { id: 'movimentacoes', label: 'Movimentações' }
]
</script>

<template>
  <div class="min-h-screen">
    <!-- Sidebar (only on Catálogo tab) -->
    <AppSidebar
      v-if="activeTab === 'catalogo'"
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

    <!-- Main content -->
    <div
      class="transition-all duration-300 flex flex-col min-h-screen"
      :class="activeTab === 'catalogo' ? (sidebarCollapsed ? 'ml-12' : 'ml-60') : ''"
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
        <CadastroView v-else-if="activeTab === 'cadastros'" />

        <!-- Itens tab (manage) -->
        <ManageView v-else-if="activeTab === 'itens'" />

        <!-- Inventário tab (placeholder) -->
        <div v-else-if="activeTab === 'inventario'" class="text-center py-16 text-gray-400 dark:text-gray-500">
          <svg class="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
          </svg>
          <p class="text-lg">Inventário</p>
          <p class="text-sm mt-1">Em breve.</p>
        </div>

        <!-- Movimentações tab (placeholder) -->
        <div v-else-if="activeTab === 'movimentacoes'" class="text-center py-16 text-gray-400 dark:text-gray-500">
          <svg class="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
          </svg>
          <p class="text-lg">Movimentações</p>
          <p class="text-sm mt-1">Em breve.</p>
        </div>
      </main>
    </div>

    <!-- Toasts -->
    <ToastContainer />
  </div>
</template>
