<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  summaryTotals: { type: Object, required: true },
  destinationSummaries: { type: Array, required: true },
  filteredDestinationSummaries: { type: Array, required: true },
  summarySearch: { type: String, required: true },
  expandedSummaryDestId: { type: String, default: null },
  formatDate: { type: Function, required: true },
})

const emit = defineEmits(['update:summarySearch', 'update:expandedSummaryDestId'])

const selectedGroup = ref('')
const selectedCategory = ref('')
const selectedSubcategory = ref('')
const variationPage = ref(1)
const variationsPerPage = 8

function toggleExpanded(id) {
  emit('update:expandedSummaryDestId', id)
}

function resetPath() {
  selectedGroup.value = ''
  selectedCategory.value = ''
  selectedSubcategory.value = ''
  variationPage.value = 1
}

function normalize(value) {
  return String(value || '').trim().toLowerCase()
}

function materialMatchesSearch(material, q) {
  if (!q) return true
  return [
    material.itemName,
    material.itemGroup,
    material.itemCategory,
    material.itemSubcategory,
    material.variation,
  ].join(' ').toLowerCase().includes(q)
}

function latestDate(a, b) {
  if (!a) return b || ''
  if (!b) return a || ''
  return new Date(b) > new Date(a) ? b : a
}

function aggregateCards(materials, key) {
  const map = new Map()
  for (const material of materials) {
    const name = material[key] || 'Sem classificação'
    if (!map.has(name)) {
      map.set(name, { name, qty: 0, variations: 0, moves: 0, lastDate: '' })
    }
    const card = map.get(name)
    card.qty += Number(material.qty) || 0
    card.variations += 1
    card.moves += Number(material.moves) || 0
    card.lastDate = latestDate(card.lastDate, material.lastDate)
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
}

const activeDestination = computed(() =>
  props.filteredDestinationSummaries.find(dest => dest.id === props.expandedSummaryDestId) || null
)

const destinationSearchMatches = computed(() =>
  activeDestination.value && normalize(activeDestination.value.fullName).includes(normalize(props.summarySearch))
)

const activeDestinationMaterials = computed(() => {
  if (!activeDestination.value) return []
  const q = normalize(props.summarySearch)
  if (!q || destinationSearchMatches.value) return activeDestination.value.materials
  return activeDestination.value.materials.filter(material => materialMatchesSearch(material, q))
})

const currentLevel = computed(() => {
  if (!selectedGroup.value) return 'group'
  if (!selectedCategory.value) return 'category'
  if (!selectedSubcategory.value) return 'subcategory'
  return 'variations'
})

const pathMaterials = computed(() =>
  activeDestinationMaterials.value.filter(material =>
    (!selectedGroup.value || material.itemGroup === selectedGroup.value) &&
    (!selectedCategory.value || material.itemCategory === selectedCategory.value) &&
    (!selectedSubcategory.value || material.itemSubcategory === selectedSubcategory.value)
  )
)

const currentCards = computed(() => {
  if (currentLevel.value === 'group') return aggregateCards(activeDestinationMaterials.value, 'itemGroup')
  if (currentLevel.value === 'category') return aggregateCards(pathMaterials.value, 'itemCategory')
  if (currentLevel.value === 'subcategory') return aggregateCards(pathMaterials.value, 'itemSubcategory')
  return []
})

const levelTitle = computed(() => {
  if (currentLevel.value === 'group') return 'Categorias'
  if (currentLevel.value === 'category') return 'Subcategorias'
  if (currentLevel.value === 'subcategory') return 'Materiais'
  return 'Variações'
})

const paginatedVariations = computed(() => {
  const start = (variationPage.value - 1) * variationsPerPage
  return pathMaterials.value.slice(start, start + variationsPerPage)
})

const variationsTotalPages = computed(() =>
  Math.max(1, Math.ceil(pathMaterials.value.length / variationsPerPage))
)

const variationPageStart = computed(() =>
  pathMaterials.value.length ? (variationPage.value - 1) * variationsPerPage + 1 : 0
)

const variationPageEnd = computed(() =>
  Math.min(variationPage.value * variationsPerPage, pathMaterials.value.length)
)

function selectCard(card) {
  if (currentLevel.value === 'group') {
    selectedGroup.value = card.name
    selectedCategory.value = ''
    selectedSubcategory.value = ''
  } else if (currentLevel.value === 'category') {
    selectedCategory.value = card.name
    selectedSubcategory.value = ''
  } else if (currentLevel.value === 'subcategory') {
    selectedSubcategory.value = card.name
  }
  variationPage.value = 1
}

function goToPath(level) {
  if (level === 'root') {
    resetPath()
  } else if (level === 'group') {
    selectedCategory.value = ''
    selectedSubcategory.value = ''
  } else if (level === 'category') {
    selectedSubcategory.value = ''
  }
  variationPage.value = 1
}

function goVariationsPage(delta) {
  variationPage.value = Math.min(
    variationsTotalPages.value,
    Math.max(1, variationPage.value + delta)
  )
}

watch(() => props.expandedSummaryDestId, resetPath)
watch(() => props.summarySearch, resetPath)
watch(variationsTotalPages, (total) => {
  if (variationPage.value > total) variationPage.value = total
})
</script>

<template>
  <div class="relative max-w-lg">
    <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
    <input
      :value="summarySearch"
      type="text"
      placeholder="Buscar destino, categoria ou material..."
      class="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
      @input="emit('update:summarySearch', $event.target.value)"
    />
  </div>

  <div v-if="destinationSummaries.length === 0" class="text-center py-12 text-gray-400 dark:text-gray-500">
    <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" stroke-width="1" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 6.75V15m6-6v8.25m.5-13.5h-7A2.25 2.25 0 0 0 6.25 6v12A2.25 2.25 0 0 0 8.5 20.25h7A2.25 2.25 0 0 0 17.75 18V6a2.25 2.25 0 0 0-2.25-2.25Z" /></svg>
    <p class="text-sm">Nenhum destino cadastrado.</p>
  </div>

  <div v-else-if="filteredDestinationSummaries.length === 0" class="text-center py-12 text-gray-400 dark:text-gray-500 text-sm">
    Nenhuma saída encontrada por destino.
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
        class="w-full flex flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors cursor-pointer"
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
            {{ dest.lastDate ? 'Última saída: ' + formatDate(dest.lastDate) : 'Sem saída registrada' }}
          </p>
        </div>

        <div class="flex items-center gap-2 text-xs">
          <span class="px-2 py-1 rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300">{{ dest.totalQty }} materiais saíram</span>
          <span class="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">{{ dest.materials.length }} variações</span>
        </div>
      </button>

      <div v-if="expandedSummaryDestId === dest.id" class="border-t border-gray-200 dark:border-gray-700 p-4">
        <div v-if="activeDestinationMaterials.length" class="space-y-3">
          <div class="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              type="button"
              class="px-2 py-1 rounded-md font-medium transition-colors cursor-pointer"
              :class="!selectedGroup ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'"
              @click="goToPath('root')"
            >
              {{ dest.fullName }}
            </button>
            <template v-if="selectedGroup">
              <span class="text-gray-300 dark:text-gray-600">/</span>
              <button
                type="button"
                class="px-2 py-1 rounded-md font-medium transition-colors cursor-pointer"
                :class="!selectedCategory ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'"
                @click="goToPath('group')"
              >
                {{ selectedGroup }}
              </button>
            </template>
            <template v-if="selectedCategory">
              <span class="text-gray-300 dark:text-gray-600">/</span>
              <button
                type="button"
                class="px-2 py-1 rounded-md font-medium transition-colors cursor-pointer"
                :class="!selectedSubcategory ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'"
                @click="goToPath('category')"
              >
                {{ selectedCategory }}
              </button>
            </template>
            <template v-if="selectedSubcategory">
              <span class="text-gray-300 dark:text-gray-600">/</span>
              <span class="px-2 py-1 rounded-md font-medium bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">
                {{ selectedSubcategory }}
              </span>
            </template>
          </div>

          <div v-if="currentLevel !== 'variations'">
            <div class="flex items-center justify-between gap-3 mb-2">
              <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{{ levelTitle }}</h4>
              <span class="text-xs text-gray-400 dark:text-gray-500">{{ currentCards.length }} blocos</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              <button
                v-for="card in currentCards"
                :key="card.name"
                type="button"
                class="group text-left p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-sm transition-all cursor-pointer"
                @click="selectCard(card)"
              >
                <div class="w-9 h-9 rounded-lg bg-white dark:bg-gray-800 flex items-center justify-center mb-3 group-hover:bg-primary-50 dark:group-hover:bg-primary-900/30 transition-colors">
                  <svg class="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
                  </svg>
                </div>
                <p class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{{ card.name }}</p>
                <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {{ card.qty }} materiais saíram
                </p>
                <div class="mt-3 flex items-center justify-between gap-2">
                  <span class="text-xs font-semibold text-gray-700 dark:text-gray-300">{{ card.variations }} {{ card.variations === 1 ? 'variação' : 'variações' }}</span>
                  <span class="text-[11px] text-gray-400 dark:text-gray-500">{{ card.moves }} {{ card.moves === 1 ? 'saída' : 'saídas' }}</span>
                </div>
              </button>
            </div>
          </div>

          <div v-else class="space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Variações movimentadas</h4>
              <span class="text-xs text-gray-400 dark:text-gray-500">
                {{ variationPageStart }}-{{ variationPageEnd }} de {{ pathMaterials.length }}
              </span>
            </div>

            <div class="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div
                v-for="mat in paginatedVariations"
                :key="mat.variationId + mat.itemName + mat.variation"
                class="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2 px-4 py-3 border-b last:border-b-0 border-gray-100 dark:border-gray-700/60 bg-gray-50 dark:bg-gray-900/30"
              >
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{{ mat.itemName }}</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">{{ mat.variation }}</p>
                </div>
                <div class="text-sm font-semibold text-gray-900 dark:text-gray-100 md:text-right">
                  {{ mat.qty }} {{ mat.itemUnit }}
                </div>
                <div class="text-xs text-gray-400 dark:text-gray-500 md:text-right whitespace-nowrap">
                  {{ formatDate(mat.lastDate) }}
                </div>
              </div>
            </div>

            <div v-if="variationsTotalPages > 1" class="flex items-center justify-end gap-2">
              <button
                type="button"
                class="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                :disabled="variationPage === 1"
                @click="goVariationsPage(-1)"
              >
                Anterior
              </button>
              <span class="text-xs text-gray-400 dark:text-gray-500">Página {{ variationPage }} de {{ variationsTotalPages }}</span>
              <button
                type="button"
                class="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                :disabled="variationPage === variationsTotalPages"
                @click="goVariationsPage(1)"
              >
                Próxima
              </button>
            </div>
          </div>
        </div>

        <p v-else class="text-sm text-gray-400 dark:text-gray-500 italic">Sem materiais movimentados neste destino.</p>
      </div>
    </div>
  </div>
</template>
