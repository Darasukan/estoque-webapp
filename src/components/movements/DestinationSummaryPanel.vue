<script setup>
defineProps({
  summaryTotals: { type: Object, required: true },
  destinationSummaries: { type: Array, required: true },
  filteredDestinationSummaries: { type: Array, required: true },
  summarySearch: { type: String, required: true },
  expandedSummaryDestId: { type: String, default: null },
  formatDate: { type: Function, required: true },
})

const emit = defineEmits(['update:summarySearch', 'update:expandedSummaryDestId'])

function toggleExpanded(id) {
  emit('update:expandedSummaryDestId', id)
}
</script>

<template>
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3">
      <p class="text-xs text-gray-400 dark:text-gray-500">Destinos</p>
      <p class="text-xl font-semibold text-gray-900 dark:text-gray-100">{{ summaryTotals.destinations }}</p>
    </div>
    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3">
      <p class="text-xs text-gray-400 dark:text-gray-500">Com movimento</p>
      <p class="text-xl font-semibold text-gray-900 dark:text-gray-100">{{ summaryTotals.withMovement }}</p>
    </div>
    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3">
      <p class="text-xs text-gray-400 dark:text-gray-500">Saidas</p>
      <p class="text-xl font-semibold text-red-600 dark:text-red-400">{{ summaryTotals.saidas }}</p>
    </div>
    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3">
      <p class="text-xs text-gray-400 dark:text-gray-500">OS vinculadas</p>
      <p class="text-xl font-semibold text-primary-700 dark:text-primary-400">{{ summaryTotals.orders }}</p>
    </div>
  </div>

  <div class="relative max-w-lg">
    <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
    <input
      :value="summarySearch"
      type="text"
      placeholder="Buscar destino, material ou OS..."
      class="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
      @input="emit('update:summarySearch', $event.target.value)"
    />
  </div>

  <div v-if="destinationSummaries.length === 0" class="text-center py-12 text-gray-400 dark:text-gray-500">
    <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" stroke-width="1" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 6.75V15m6-6v8.25m.5-13.5h-7A2.25 2.25 0 0 0 6.25 6v12A2.25 2.25 0 0 0 8.5 20.25h7A2.25 2.25 0 0 0 17.75 18V6a2.25 2.25 0 0 0-2.25-2.25Z" /></svg>
    <p class="text-sm">Nenhum destino cadastrado.</p>
  </div>

  <div v-else-if="filteredDestinationSummaries.length === 0" class="text-center py-12 text-gray-400 dark:text-gray-500 text-sm">
    Nenhum destino encontrado para a busca.
  </div>

  <div v-else class="space-y-2">
    <div
      v-for="dest in filteredDestinationSummaries"
      :key="dest.id"
      class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
      :class="dest.isChild ? 'ml-5 border-l-4 border-l-primary-200 dark:border-l-primary-800' : ''"
    >
      <button
        type="button"
        class="w-full flex flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
        @click="toggleExpanded(expandedSummaryDestId === dest.id ? null : dest.id)"
      >
        <svg
          class="w-4 h-4 text-gray-400 transition-transform flex-shrink-0"
          :class="expandedSummaryDestId === dest.id ? 'rotate-90' : ''"
          fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
        ><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>

        <div class="flex-1 min-w-[180px]">
          <p class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ dest.fullName }}</p>
          <p class="text-xs text-gray-400 dark:text-gray-500">
            {{ dest.lastDate ? 'Ultima saida: ' + formatDate(dest.lastDate) : 'Sem saida registrada' }}
          </p>
        </div>

        <div class="flex items-center gap-2 text-xs">
          <span class="px-2 py-1 rounded bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300">{{ dest.orders.length }} OS</span>
          <span class="px-2 py-1 rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300">{{ dest.saidas.length }} saidas</span>
          <span class="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">{{ dest.materials.length }} materiais</span>
        </div>
      </button>

      <div v-if="expandedSummaryDestId === dest.id" class="border-t border-gray-200 dark:border-gray-700 p-4 space-y-4">
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div class="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-3">
            <p class="text-xs text-gray-400 dark:text-gray-500">Quantidade total saida</p>
            <p class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ dest.totalQty }}</p>
          </div>
          <div class="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-3">
            <p class="text-xs text-gray-400 dark:text-gray-500">Materiais diferentes</p>
            <p class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ dest.materials.length }}</p>
          </div>
          <div class="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-3">
            <p class="text-xs text-gray-400 dark:text-gray-500">OS do destino</p>
            <p class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ dest.orders.length }}</p>
          </div>
        </div>

        <div>
          <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Materiais por saida</h4>
          <div v-if="dest.materials.length" class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                  <th class="pb-2 pr-3">Item</th>
                  <th class="pb-2 pr-3">Variacao</th>
                  <th class="pb-2 pr-3 text-right">Qtd</th>
                  <th class="pb-2 pr-3">Unid</th>
                  <th class="pb-2">Ultima saida</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="mat in dest.materials" :key="mat.itemName + mat.variation" class="border-t border-gray-100 dark:border-gray-700/50">
                  <td class="py-2 pr-3 text-gray-900 dark:text-gray-100">{{ mat.itemName }}</td>
                  <td class="py-2 pr-3 text-gray-600 dark:text-gray-400">{{ mat.variation }}</td>
                  <td class="py-2 pr-3 text-right font-semibold text-gray-900 dark:text-gray-100">{{ mat.qty }}</td>
                  <td class="py-2 pr-3 text-gray-500 dark:text-gray-400">{{ mat.itemUnit }}</td>
                  <td class="py-2 text-xs text-gray-400 dark:text-gray-500">{{ formatDate(mat.lastDate) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="text-sm text-gray-400 dark:text-gray-500 italic">Sem materiais movimentados neste destino.</p>
        </div>

        <div>
          <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Ordens de Servico</h4>
          <div v-if="dest.orders.length" class="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div v-for="wo in dest.orders" :key="wo.id" class="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-3">
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold px-1.5 py-0.5 rounded bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-400">OS #{{ wo.number }}</span>
                <span class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{{ wo.equipment || wo.title }}</span>
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ wo.requestedBy || '-' }} - {{ wo.serviceType || 'Outros' }}</p>
            </div>
          </div>
          <p v-else class="text-sm text-gray-400 dark:text-gray-500 italic">Sem OS vinculada a este destino.</p>
        </div>
      </div>
    </div>
  </div>
</template>
