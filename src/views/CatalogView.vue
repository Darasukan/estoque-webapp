<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useItems } from '../composables/useItems.js'
import { useToast } from '../composables/useToast.js'

const {
  items, variations,
  activeGroup, uniqueGroups, setActiveGroup,
  groupItems, filteredResults,
  getVariationsForItem, addVariation, editVariation, deleteVariation, getTotalStock
} = useItems()

const { success, error } = useToast()

// ===== Search =====
const searchQuery = ref('')
const searchNorm = computed(() => searchQuery.value.trim().toLowerCase())

// Reset search when group changes
watch(() => activeGroup.value, () => { searchQuery.value = '' })

// ===== Item detail =====
const viewingItem = ref(null)

// Close item when group changes
watch(() => activeGroup.value, () => { viewingItem.value = null })

function openItem(item) {
  viewingItem.value = item
}

function closeItem() {
  viewingItem.value = null
}

const itemVariations = computed(() => {
  if (!viewingItem.value) return []
  return getVariationsForItem(viewingItem.value.id)
})

const totalStock = computed(() => {
  if (!viewingItem.value) return 0
  return getTotalStock(viewingItem.value.id)
})

// ===== Variation CRUD =====
const addingVariation = ref(false)
const editingVariationId = ref(null)
const varForm = ref({ values: {}, stock: 0 })

function startAddVariation() {
  const attrs = viewingItem.value?.attributes || []
  const values = {}
  for (const a of attrs) values[a] = ''
  varForm.value = { values, stock: 0 }
  addingVariation.value = true
  editingVariationId.value = null
  nextTick(() => {
    const el = document.querySelector('.var-form-input')
    if (el) el.focus()
  })
}

function startEditVariation(v) {
  const attrs = viewingItem.value?.attributes || []
  const values = {}
  for (const a of attrs) values[a] = v.values[a] || ''
  varForm.value = { values, stock: v.stock }
  editingVariationId.value = v.id
  addingVariation.value = false
}

function saveVariation() {
  const hasValue = Object.values(varForm.value.values).some(v => v.trim())
  if (!hasValue && (viewingItem.value?.attributes?.length || 0) > 0) {
    error('Preencha ao menos um atributo.')
    return
  }
  if (editingVariationId.value) {
    editVariation(editingVariationId.value, { values: { ...varForm.value.values }, stock: varForm.value.stock })
    editingVariationId.value = null
    success('Variação atualizada!')
  } else {
    addVariation(viewingItem.value.id, varForm.value.values, varForm.value.stock)
    success('Variação adicionada!')
  }
  addingVariation.value = false
}

function cancelVariation() {
  addingVariation.value = false
  editingVariationId.value = null
}

function onDeleteVariation(v) {
  const label = Object.values(v.values).filter(Boolean).join(' / ') || 'esta variação'
  if (!confirm(`Excluir "${label}"?`)) return
  deleteVariation(v.id)
  success('Variação excluída.')
}

// ===== Overview helpers =====
function groupItemCount(g) {
  return items.value.filter(i => i.group === g).length
}

function groupStockTotal(g) {
  const ids = new Set(items.value.filter(i => i.group === g).map(i => i.id))
  return variations.value.filter(v => ids.has(v.itemId)).reduce((s, v) => s + v.stock, 0)
}

// Search-filtered groups for overview — searches all levels (group, category, subcategory, item name)
const searchedGroups = computed(() => {
  if (!searchNorm.value) return uniqueGroups.value
  const q = searchNorm.value
  return uniqueGroups.value.filter(g => {
    if (g.toLowerCase().includes(q)) return true
    const groupItems = items.value.filter(i => i.group === g)
    return groupItems.some(i =>
      (i.category || '').toLowerCase().includes(q) ||
      (i.subcategory || '').toLowerCase().includes(q) ||
      i.name.toLowerCase().includes(q)
    )
  })
})

// Search-filtered items for group view
const searchedResults = computed(() => {
  if (!searchNorm.value) return filteredResults.value
  return filteredResults.value.filter(item => {
    const q = searchNorm.value
    if (item.name.toLowerCase().includes(q)) return true
    if ((item.category || '').toLowerCase().includes(q)) return true
    if ((item.subcategory || '').toLowerCase().includes(q)) return true
    // Search in variation attribute values
    const vars = getVariationsForItem(item.id)
    return vars.some(v => Object.values(v.values || {}).some(val => (val || '').toLowerCase().includes(q)))
  })
})
</script>

<template>
  <div>
    <!-- ===== 1. ITEM DETAIL (variations table) ===== -->
    <template v-if="viewingItem">
      <!-- Breadcrumb -->
      <div class="flex items-center gap-1.5 text-sm mb-5">
        <button
          class="text-primary-600 dark:text-primary-400 hover:underline font-medium flex items-center gap-1"
          @click="closeItem"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Voltar
        </button>
        <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
        <span class="text-gray-500 dark:text-gray-400">{{ viewingItem.group }}</span>
        <template v-if="viewingItem.category">
          <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
          <span class="text-gray-500 dark:text-gray-400">{{ viewingItem.category }}</span>
        </template>
        <template v-if="viewingItem.subcategory">
          <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
          <span class="text-gray-500 dark:text-gray-400">{{ viewingItem.subcategory }}</span>
        </template>
        <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
        <span class="text-gray-800 dark:text-gray-100 font-semibold">{{ viewingItem.name }}</span>
      </div>

      <!-- Item header -->
      <div class="flex items-center gap-4 mb-5">
        <div class="w-12 h-12 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <svg class="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
          </svg>
        </div>
        <div class="flex-1">
          <h2 class="text-xl font-bold text-gray-800 dark:text-gray-100">{{ viewingItem.name }}</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ viewingItem.unit }} &middot; Mín. {{ viewingItem.minStock }} &middot;
            <span :class="totalStock < viewingItem.minStock ? 'text-red-500 dark:text-red-400 font-semibold' : 'text-green-600 dark:text-green-400 font-semibold'">
              Estoque: {{ totalStock }}
            </span>
          </p>
        </div>
        <button
          class="px-4 py-2 text-sm font-medium bg-primary-700 dark:bg-primary-600 text-white rounded-lg hover:bg-primary-800 dark:hover:bg-primary-500 transition-colors flex items-center gap-1.5"
          @click="startAddVariation"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nova Variação
        </button>
      </div>

      <!-- Variations table -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                <th v-for="attr in viewingItem.attributes" :key="attr" class="text-left px-4 py-2.5 font-semibold text-gray-600 dark:text-gray-300">{{ attr }}</th>
                <th class="text-center px-4 py-2.5 font-semibold text-gray-600 dark:text-gray-300 w-24">Qtd.</th>
                <th class="text-center px-4 py-2.5 font-semibold text-gray-600 dark:text-gray-300 w-24">Ações</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="v in itemVariations"
                :key="v.id"
                class="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
              >
                <!-- Editing row -->
                <template v-if="editingVariationId === v.id">
                  <td v-for="attr in viewingItem.attributes" :key="attr" class="px-4 py-2">
                    <input v-model="varForm.values[attr]" class="w-full px-2 py-1 text-sm border border-primary-400 dark:border-primary-500 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none" :placeholder="attr" @keydown.enter="saveVariation" @keydown.escape="cancelVariation" />
                  </td>
                  <td class="px-4 py-2 text-center">
                    <input v-model.number="varForm.stock" type="number" min="0" class="w-16 px-2 py-1 text-sm text-center border border-primary-400 dark:border-primary-500 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none" @keydown.enter="saveVariation" @keydown.escape="cancelVariation" />
                  </td>
                  <td class="px-4 py-2">
                    <div class="flex items-center justify-center gap-1">
                      <button class="p-1 text-green-500 hover:text-green-600 transition-colors" title="Salvar" @click="saveVariation">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                      </button>
                      <button class="p-1 text-gray-400 hover:text-gray-600 transition-colors" title="Cancelar" @click="cancelVariation">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  </td>
                </template>
                <!-- Display row -->
                <template v-else>
                  <td v-for="attr in viewingItem.attributes" :key="attr" class="px-4 py-2.5 text-gray-700 dark:text-gray-300">{{ v.values[attr] || '—' }}</td>
                  <td
                    class="px-4 py-2.5 text-center tabular-nums font-medium"
                    :class="v.stock <= 0 ? 'text-red-500 dark:text-red-400' : v.stock < viewingItem.minStock ? 'text-amber-500 dark:text-amber-400' : 'text-gray-800 dark:text-gray-100'"
                  >
                    {{ v.stock }}
                    <span v-if="v.stock <= 0" class="ml-1 text-[10px]">&#x1F534;</span>
                    <span v-else-if="v.stock < viewingItem.minStock" class="ml-1 text-[10px]">&#x1F7E1;</span>
                  </td>
                  <td class="px-4 py-2.5">
                    <div class="flex items-center justify-center gap-1">
                      <button class="p-1 text-gray-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors" title="Editar" @click="startEditVariation(v)">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg>
                      </button>
                      <button class="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors" title="Excluir" @click="onDeleteVariation(v)">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79" /></svg>
                      </button>
                    </div>
                  </td>
                </template>
              </tr>

              <!-- Add new row -->
              <tr v-if="addingVariation" class="border-b border-gray-100 dark:border-gray-700/50 bg-primary-50/30 dark:bg-primary-900/10">
                <td v-for="(attr, ai) in viewingItem.attributes" :key="attr" class="px-4 py-2">
                  <input
                    v-model="varForm.values[attr]"
                    :class="['w-full px-2 py-1 text-sm border border-primary-400 dark:border-primary-500 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none', ai === 0 ? 'var-form-input' : '']"
                    :placeholder="attr"
                    @keydown.enter="saveVariation"
                    @keydown.escape="cancelVariation"
                  />
                </td>
                <td class="px-4 py-2 text-center">
                  <input v-model.number="varForm.stock" type="number" min="0" class="w-16 px-2 py-1 text-sm text-center border border-primary-400 dark:border-primary-500 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none" @keydown.enter="saveVariation" @keydown.escape="cancelVariation" />
                </td>
                <td class="px-4 py-2">
                  <div class="flex items-center justify-center gap-1">
                    <button class="p-1 text-green-500 hover:text-green-600 transition-colors" title="Salvar" @click="saveVariation">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                    </button>
                    <button class="p-1 text-gray-400 hover:text-gray-600 transition-colors" title="Cancelar" @click="cancelVariation">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Empty: no attributes -->
        <div v-if="!viewingItem.attributes?.length" class="px-6 py-8 text-center text-gray-400 dark:text-gray-500">
          <p class="text-sm">Este item não possui atributos definidos.</p>
          <p class="text-xs mt-1">Edite o item na aba <strong>Itens</strong> para adicionar atributos.</p>
        </div>
        <!-- Empty: no variations -->
        <div v-else-if="itemVariations.length === 0 && !addingVariation" class="px-6 py-8 text-center text-gray-400 dark:text-gray-500">
          <svg class="w-10 h-10 mx-auto mb-2 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
          </svg>
          <p class="text-sm">Nenhuma variação cadastrada.</p>
          <p class="text-xs mt-1">Clique em <strong>Nova Variação</strong> para adicionar.</p>
        </div>
      </div>
    </template>

    <!-- ===== 2. FILTERED RESULTS (group selected) ===== -->
    <template v-else-if="activeGroup">
      <div class="flex items-center justify-between mb-4 gap-4">
        <div class="flex-1 min-w-0">
          <h2 class="text-xl font-bold text-gray-800 dark:text-gray-100">{{ activeGroup }}</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            Mostrando {{ searchedResults.length }} de {{ groupItems.length }} {{ groupItems.length === 1 ? 'item' : 'itens' }}
          </p>
        </div>
        <!-- Search -->
        <div class="relative w-64">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Buscar item..."
            class="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
          />
          <button
            v-if="searchQuery"
            class="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            @click="searchQuery = ''"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Results table -->
      <div v-if="searchedResults.length" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                <th class="text-left px-4 py-2.5 font-semibold text-gray-600 dark:text-gray-300">Item</th>
                <th class="text-left px-4 py-2.5 font-semibold text-gray-600 dark:text-gray-300">Categoria</th>
                <th class="text-left px-4 py-2.5 font-semibold text-gray-600 dark:text-gray-300">Subcategoria</th>
                <th class="text-center px-4 py-2.5 font-semibold text-gray-600 dark:text-gray-300 w-20">Unid.</th>
                <th class="text-center px-4 py-2.5 font-semibold text-gray-600 dark:text-gray-300 w-16">Var.</th>
                <th class="text-center px-4 py-2.5 font-semibold text-gray-600 dark:text-gray-300 w-20">Estoque</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in searchedResults"
                :key="item.id"
                class="border-b border-gray-100 dark:border-gray-700/50 hover:bg-primary-50/50 dark:hover:bg-primary-900/20 transition-colors cursor-pointer"
                @click="openItem(item)"
              >
                <td class="px-4 py-2.5 font-medium text-gray-800 dark:text-gray-100">{{ item.name }}</td>
                <td class="px-4 py-2.5 text-gray-600 dark:text-gray-400">{{ item.category || '—' }}</td>
                <td class="px-4 py-2.5 text-gray-600 dark:text-gray-400">{{ item.subcategory || '—' }}</td>
                <td class="px-4 py-2.5 text-center text-gray-600 dark:text-gray-400">{{ item.unit }}</td>
                <td class="px-4 py-2.5 text-center tabular-nums text-gray-600 dark:text-gray-400">{{ getVariationsForItem(item.id).length }}</td>
                <td
                  class="px-4 py-2.5 text-center tabular-nums font-medium"
                  :class="getTotalStock(item.id) <= 0 ? 'text-red-500 dark:text-red-400' :
                    getTotalStock(item.id) < item.minStock ? 'text-amber-500 dark:text-amber-400' :
                    'text-green-600 dark:text-green-400'"
                >
                  {{ getTotalStock(item.id) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- No results -->
      <div v-else class="text-center py-16 text-gray-400 dark:text-gray-500">
        <svg class="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <p class="text-lg">Nenhum item corresponde aos filtros.</p>
        <p class="text-sm mt-1">Tente ajustar os filtros na barra lateral.</p>
      </div>
    </template>

    <!-- ===== 3. OVERVIEW (no group selected) ===== -->
    <template v-else>
      <div class="flex items-center justify-between mb-4 gap-4">
        <h2 class="text-xl font-bold text-gray-800 dark:text-gray-100">Catálogo</h2>
        <!-- Search -->
        <div v-if="uniqueGroups.length" class="relative w-64">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Buscar grupo, categoria, item..."
            class="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
          />
          <button
            v-if="searchQuery"
            class="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            @click="searchQuery = ''"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div v-if="searchedGroups.length" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <button
          v-for="g in searchedGroups"
          :key="g"
          class="group text-left p-5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-md transition-all cursor-pointer"
          @click="setActiveGroup(g)"
        >
          <div class="w-10 h-10 rounded-lg bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center mb-3 group-hover:bg-primary-100 dark:group-hover:bg-primary-900/50 transition-colors">
            <svg class="w-5 h-5 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
            </svg>
          </div>
          <p class="text-sm font-bold text-gray-800 dark:text-gray-100 truncate mb-1">{{ g }}</p>
          <p class="text-xs text-gray-400 dark:text-gray-500">
            {{ groupItemCount(g) }} {{ groupItemCount(g) === 1 ? 'item' : 'itens' }}
            &middot; Estoque: {{ groupStockTotal(g) }}
          </p>
        </button>
      </div>

      <!-- No search results -->
      <div v-else-if="uniqueGroups.length && searchNorm" class="text-center py-10 text-gray-400 dark:text-gray-500">
        <p class="text-sm">Nenhum resultado encontrado para "{{ searchQuery }}".</p>
      </div>

      <!-- Empty state -->
      <div v-else class="text-center py-16 text-gray-400 dark:text-gray-500">
        <svg class="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
        </svg>
        <p class="text-lg">Nenhum grupo encontrado.</p>
        <p class="text-sm mt-1">Cadastre itens na aba <strong>Cadastros</strong> para começar.</p>
      </div>
    </template>
  </div>
</template>
