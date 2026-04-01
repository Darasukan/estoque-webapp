<script setup>
import { reactive } from 'vue'

const props = defineProps({
  collapsed: { type: Boolean, default: false },
  facets: { type: Array, default: () => [] },
  hasActiveFilters: { type: Boolean, default: false },
  search: { type: String, default: '' },
  dateFrom: { type: String, default: '' },
  dateTo: { type: String, default: '' },
})

defineEmits(['toggle', 'toggle-filter', 'clear-filters', 'update:search', 'update:dateFrom', 'update:dateTo'])

const expandedSections = reactive({})

function toggleSection(key) {
  expandedSections[key] = !expandedSections[key]
}
</script>

<template>
  <aside
    class="fixed top-0 left-0 h-full z-40 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-lg transition-all duration-300 flex flex-col"
    :class="collapsed ? 'w-12' : 'w-60'"
  >
    <!-- Header: collapse toggle -->
    <div class="border-b border-gray-200 dark:border-gray-700">
      <div class="flex items-center p-3" :class="collapsed ? 'justify-center' : 'gap-2'">
        <button
          class="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
          :title="collapsed ? 'Expandir menu' : 'Recolher menu'"
          @click="$emit('toggle')"
        >
          <svg class="w-5 h-5 transition-transform" :class="{ 'rotate-180': collapsed }" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <span v-if="!collapsed" class="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Filtros</span>
      </div>
    </div>

    <!-- COLLAPSED: icon only -->
    <div v-if="collapsed" class="flex-1 flex flex-col items-center py-3 gap-3">
      <div class="w-6 h-6 text-gray-400 dark:text-gray-500" title="Filtros do Histórico">
        <svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
        </svg>
      </div>
      <span v-if="hasActiveFilters" class="w-2 h-2 rounded-full bg-primary-500"></span>
    </div>

    <!-- EXPANDED -->
    <template v-else>
      <!-- Clear all -->
      <button
        v-if="hasActiveFilters"
        class="w-full text-left px-3 py-1.5 text-xs font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors border-b border-gray-200 dark:border-gray-700 flex items-center gap-1"
        @click="$emit('clear-filters')"
      >
        <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
        Limpar filtros
      </button>

      <div class="flex-1 overflow-y-auto sidebar-scroll">
        <!-- Search -->
        <div class="px-3 pt-3 pb-2">
          <div class="relative">
            <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              :value="search"
              type="text"
              placeholder="Buscar..."
              class="w-full pl-8 pr-7 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700/60 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
              @input="$emit('update:search', $event.target.value)"
            />
            <button v-if="search" class="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" @click="$emit('update:search', '')">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <!-- Date range -->
        <div class="px-3 pb-3 space-y-1.5 border-b border-gray-100 dark:border-gray-700/50">
          <p class="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Período</p>
          <div class="grid grid-cols-2 gap-1.5">
            <div>
              <label class="block text-[10px] text-gray-400 dark:text-gray-500 mb-0.5">De</label>
              <input
                :value="dateFrom"
                type="date"
                class="w-full px-1.5 py-1 text-[11px] border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700/60 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-primary-500 transition-colors"
                @input="$emit('update:dateFrom', $event.target.value)"
              />
            </div>
            <div>
              <label class="block text-[10px] text-gray-400 dark:text-gray-500 mb-0.5">Até</label>
              <input
                :value="dateTo"
                type="date"
                class="w-full px-1.5 py-1 text-[11px] border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700/60 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-primary-500 transition-colors"
                @input="$emit('update:dateTo', $event.target.value)"
              />
            </div>
          </div>
        </div>

        <!-- Facet sections -->
        <div v-for="facet in facets" :key="facet.key" class="border-b border-gray-100 dark:border-gray-700/50">
          <button
            class="w-full flex items-center justify-between px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest transition-colors"
            :class="!expandedSections[facet.key]
              ? 'text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-400'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'"
            @click="toggleSection(facet.key)"
          >
            <span class="flex items-center gap-1.5">
              {{ facet.label }}
              <span v-if="facet.selected.length" class="w-4 h-4 rounded-full bg-primary-600 dark:bg-primary-500 text-white text-[9px] font-bold flex items-center justify-center">{{ facet.selected.length }}</span>
            </span>
            <svg
              class="w-3.5 h-3.5 transition-transform duration-200"
              :class="{ '-rotate-90': !expandedSections[facet.key] }"
              fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          <div v-if="expandedSections[facet.key]" class="px-3 pb-2.5 space-y-0.5">
            <label
              v-for="opt in facet.options"
              :key="opt.value"
              class="flex items-center gap-2.5 py-1 px-1 rounded cursor-pointer group hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
            >
              <span
                class="relative flex items-center justify-center w-4 h-4 rounded border-[1.5px] transition-all flex-shrink-0"
                :class="facet.selected.includes(opt.value)
                  ? 'bg-primary-600 dark:bg-primary-500 border-primary-600 dark:border-primary-500'
                  : 'border-gray-300 dark:border-gray-500 group-hover:border-gray-400 dark:group-hover:border-gray-400'"
              >
                <svg
                  v-if="facet.selected.includes(opt.value)"
                  class="w-2.5 h-2.5 text-white"
                  fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </span>
              <input
                type="checkbox"
                class="sr-only"
                :checked="facet.selected.includes(opt.value)"
                @change="$emit('toggle-filter', facet.key, opt.value)"
              />
              <span class="text-[13px] text-gray-700 dark:text-gray-300 truncate flex-1 group-hover:text-gray-900 dark:group-hover:text-gray-100 leading-tight">
                {{ opt.value }}
              </span>
              <span class="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums flex-shrink-0">
                ({{ opt.count }})
              </span>
            </label>
          </div>
        </div>

        <p v-if="facets.length === 0" class="px-3 py-4 text-sm text-gray-400 dark:text-gray-500 italic text-center">
          Nenhuma movimentação registrada.
        </p>
      </div>
    </template>
  </aside>
</template>

<style scoped>
.sidebar-scroll {
  scrollbar-width: thin;
  scrollbar-color: rgba(156, 163, 175, 0.35) transparent;
}
.sidebar-scroll::-webkit-scrollbar { width: 5px; }
.sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
.sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(156, 163, 175, 0.35); border-radius: 9999px; }
.sidebar-scroll::-webkit-scrollbar-thumb:hover { background: rgba(156, 163, 175, 0.55); }
:is(.dark) .sidebar-scroll { scrollbar-color: rgba(107, 114, 128, 0.4) transparent; }
:is(.dark) .sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(107, 114, 128, 0.4); }
:is(.dark) .sidebar-scroll::-webkit-scrollbar-thumb:hover { background: rgba(107, 114, 128, 0.6); }
</style>
