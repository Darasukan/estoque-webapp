<script setup>
import { ref, computed, watch } from 'vue'
import { useItems } from '../composables/useItems.js'
import { useToast } from '../composables/useToast.js'
import { generateSeedData } from '../data/seedData.js'
import EditHierarchyView from './EditHierarchyView.vue'
import { units } from '../utils/units.js'

const {
  addItem, seedDatabase, resetAll,
  uniqueGroups, getCategoriesForGroup, getSubcategoriesForCategory
} = useItems()

const { success, error } = useToast()

// ===== Sub-tab =====
const subTab = ref('novo') // 'novo' | 'hierarquia'

// ===== Form state =====
const group = ref('')
const category = ref('')
const subcategory = ref('')
const name = ref('')
const unit = ref('UN')
const attributes = ref([])
const attrInput = ref('')
const attrInputEl = ref(null)

// ===== Units — imported from utils/units.js =====

// ===== Suggestions (autocomplete from existing items) =====
const groupSuggestions = computed(() => uniqueGroups.value)
const categorySuggestions = computed(() => group.value ? getCategoriesForGroup(group.value) : [])
const subcategorySuggestions = computed(() =>
  group.value && category.value
    ? getSubcategoriesForCategory(group.value, category.value)
    : []
)

// Reset children when parent changes
watch(group, () => { category.value = ''; subcategory.value = '' })
watch(category, () => { subcategory.value = '' })

// ===== Attribute tag input =====
function addAttribute() {
  const trimmed = attrInput.value.trim()
  if (!trimmed) return
  if (attributes.value.includes(trimmed)) {
    error('Atributo já existe.')
    attrInput.value = ''
    return
  }
  attributes.value.push(trimmed)
  attrInput.value = ''
}

function removeAttribute(index) {
  attributes.value.splice(index, 1)
}

function onAttrKeydown(e) {
  if (e.key === 'Enter') {
    e.preventDefault()
    addAttribute()
  } else if (e.key === 'Backspace' && attrInput.value === '' && attributes.value.length > 0) {
    attributes.value.pop()
  }
}

// Drag reorder attributes
const dragAttrIndex = ref(null)
const dropAttrIndex = ref(null)

function onAttrDragStart(e, index) {
  dragAttrIndex.value = index
  e.dataTransfer.effectAllowed = 'move'
}
function onAttrDragOver(e, index) {
  e.preventDefault()
  dropAttrIndex.value = index
}
function onAttrDragLeave() { dropAttrIndex.value = null }
function onAttrDrop(e, toIndex) {
  e.preventDefault()
  if (dragAttrIndex.value === null || dragAttrIndex.value === toIndex) return
  const [attr] = attributes.value.splice(dragAttrIndex.value, 1)
  attributes.value.splice(toIndex, 0, attr)
  dragAttrIndex.value = null
  dropAttrIndex.value = null
}
function onAttrDragEnd() {
  dragAttrIndex.value = null
  dropAttrIndex.value = null
}

// ===== Seed mass data =====
const showSeedConfirm = ref(false)
async function loadSeedData() {
  const { items: seedItems, variations: seedVars, ...seedExtras } = generateSeedData()
  await seedDatabase(seedItems, seedVars, seedExtras)
  showSeedConfirm.value = false
  success(`Dados de teste carregados! ${seedItems.length} itens + ${seedVars.length} variações + históricos.`)
}

// ===== Clear all data =====
const showClearConfirm = ref(false)
function clearAllData() {
  resetAll()
  showClearConfirm.value = false
  success('Todos os dados foram apagados.')
}

// ===== Save =====
async function save() {
  const trimmedGroup = group.value.trim()
  const trimmedName = name.value.trim()
  if (!trimmedGroup) { error('Grupo é obrigatório.'); return }

  const result = await addItem({
    name: trimmedName || null,
    group: trimmedGroup,
    category: category.value.trim() || null,
    subcategory: subcategory.value.trim() || null,
    unit: unit.value,
    minStock: 0,
    attributes: [...attributes.value]
  })
  if (!result.ok) { error(result.error); return }

  success('Item cadastrado!')
  resetForm()
}

function resetForm() {
  name.value = ''
  unit.value = 'UN'
  attributes.value = []
  attrInput.value = ''
}
</script>

<template>
  <div>
    <!-- Sub-tabs -->
    <div class="flex items-center gap-1 mb-5">
      <button
        class="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
        :class="subTab === 'novo'
          ? 'bg-primary-700 dark:bg-primary-600 text-white'
          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'"
        @click="subTab = 'novo'"
      >
        <span class="flex items-center gap-1.5">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Novo Item
        </span>
      </button>
      <button
        class="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
        :class="subTab === 'hierarquia'
          ? 'bg-primary-700 dark:bg-primary-600 text-white'
          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'"
        @click="subTab = 'hierarquia'"
      >
        <span class="flex items-center gap-1.5">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
          </svg>
          Editar Hierarquia
        </span>
      </button>

      <!-- Dev buttons (seed + clear) -->
      <div class="ml-auto flex items-center gap-2">
        <!-- Seed -->
        <div class="relative">
          <button
            v-if="!showSeedConfirm"
            class="px-3 py-2 text-xs font-medium rounded-lg border border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors"
            @click="showSeedConfirm = true; showClearConfirm = false"
          >
            <span class="flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75" />
              </svg>
              Carregar Dados de Teste
            </span>
          </button>
          <div v-else class="flex items-center gap-2">
            <span class="text-xs text-amber-600 dark:text-amber-400">Substituir todos os dados?</span>
            <button
              class="px-3 py-1.5 text-xs font-bold rounded bg-amber-500 text-white hover:bg-amber-600 transition-colors"
              @click="loadSeedData"
            >Sim</button>
            <button
              class="px-3 py-1.5 text-xs font-medium rounded bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
              @click="showSeedConfirm = false"
            >Não</button>
          </div>
        </div>

        <!-- Clear -->
        <div class="relative">
          <button
            v-if="!showClearConfirm"
            class="px-3 py-2 text-xs font-medium rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
            @click="showClearConfirm = true; showSeedConfirm = false"
          >
            <span class="flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
              Limpar Todos os Dados
            </span>
          </button>
          <div v-else class="flex items-center gap-2">
            <span class="text-xs text-red-600 dark:text-red-400">Apagar tudo permanentemente?</span>
            <button
              class="px-3 py-1.5 text-xs font-bold rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
              @click="clearAllData"
            >Sim</button>
            <button
              class="px-3 py-1.5 text-xs font-medium rounded bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
              @click="showClearConfirm = false"
            >Não</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Sub-tab: Novo Item -->
    <div v-if="subTab === 'novo'">
    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">

      <!-- Header -->
      <div class="flex items-center gap-2.5 px-6 py-4 border-b border-gray-100 dark:border-gray-700">
        <svg class="w-5 h-5 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        <h2 class="text-lg font-bold text-gray-800 dark:text-gray-100">Novo Item</h2>
      </div>

      <!-- Body: two-column on md+ -->
      <div class="grid grid-cols-1 md:grid-cols-2 md:divide-x divide-gray-100 dark:divide-gray-700">

        <!-- Left column: Localização -->
        <div class="px-6 py-5 space-y-3 border-b md:border-b-0 border-gray-100 dark:border-gray-700">
          <p class="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">1. Onde vai ficar?</p>

          <!-- Group -->
          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Grupo <span class="text-red-500">*</span>
              <span class="font-normal text-gray-400 dark:text-gray-500 ml-1">— nível mais amplo (ex: EPIs, Ferramentas)</span>
            </label>
            <input
              v-model="group"
              type="text"
              list="group-suggestions"
              placeholder="Ex: EPIs, Ferramentas, Elétrica..."
              class="w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
            />
            <datalist id="group-suggestions">
              <option v-for="g in groupSuggestions" :key="g" :value="g" />
            </datalist>
          </div>

          <!-- Category (indented) -->
          <div class="flex gap-0">
            <div class="w-5 flex-shrink-0 flex flex-col items-center pt-2 pb-1">
              <div class="w-px flex-1 bg-gray-200 dark:bg-gray-600"></div>
              <div class="w-2.5 h-px bg-gray-200 dark:bg-gray-600 mt-auto mb-3"></div>
            </div>
            <div class="flex-1">
              <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Categoria
                <span class="font-normal text-gray-400 dark:text-gray-500 ml-1">— opcional (ex: Luvas, Parafusos)</span>
              </label>
              <input
                v-model="category"
                type="text"
                list="category-suggestions"
                placeholder="Ex: Luvas, Óculos, Respiradores..."
                :disabled="!group.trim()"
                class="w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              />
              <datalist id="category-suggestions">
                <option v-for="c in categorySuggestions" :key="c" :value="c" />
              </datalist>
            </div>
          </div>

          <!-- Subcategory (double-indented) -->
          <div v-if="category.trim()" class="flex gap-0">
            <div class="w-10 flex-shrink-0 flex flex-col items-center pt-2 pb-1">
              <div class="w-px flex-1 bg-gray-200 dark:bg-gray-600"></div>
              <div class="w-2.5 h-px bg-gray-200 dark:bg-gray-600 mt-auto mb-3"></div>
            </div>
            <div class="flex-1">
              <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Subcategoria
                <span class="font-normal text-gray-400 dark:text-gray-500 ml-1">— opcional (ex: Luva de Latex)</span>
              </label>
              <input
                v-model="subcategory"
                type="text"
                list="subcategory-suggestions"
                placeholder="Ex: Luva de Latex, EPI Descartável..."
                class="w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
              />
              <datalist id="subcategory-suggestions">
                <option v-for="s in subcategorySuggestions" :key="s" :value="s" />
              </datalist>
            </div>
          </div>
        </div>
        <!-- /Left column -->

        <!-- Right column: Identificação + Variações -->
        <div class="divide-y divide-gray-100 dark:divide-gray-700">

        <!-- Section 2: Identificação -->
        <div class="px-6 py-5 space-y-4">
          <p class="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">2. Como se chama?</p>

          <!-- Nome -->
          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Nome do item
              <span class="font-normal text-gray-400 dark:text-gray-500 ml-1">— opcional</span>
            </label>
            <input
              v-model="name"
              type="text"
              :placeholder="'Padrão: ' + (subcategory.trim() || category.trim() || group.trim() || '—')"
              class="w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
            />
            <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Se deixar vazio, o nome será o do último nível preenchido acima.
            </p>
          </div>

          <!-- Unidade -->
          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Unidade de medida <span class="text-red-500">*</span>
            </label>
            <select
              v-model="unit"
              class="w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
            >
              <option v-for="u in units" :key="u.value" :value="u.value">{{ u.label }}</option>
            </select>
          </div>
        </div>

        <!-- Section 3: Variações -->
        <div class="px-6 py-5 space-y-3">
          <div>
            <p class="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">3. Variações</p>
            <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Atributos são as características que diferenciam as variações deste item.
              <span class="text-gray-500 dark:text-gray-400">Ex: "Tamanho", "Cor", "Tipo" — cada variação terá um valor para cada atributo.</span>
            </p>
          </div>
          <div
            class="min-h-[44px] flex flex-wrap items-center gap-1.5 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500 transition-colors cursor-text"
            @click="attrInputEl?.focus()"
          >
            <span
              v-for="(attr, i) in attributes"
              :key="i"
              class="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 text-xs font-medium bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 rounded cursor-grab active:cursor-grabbing select-none transition-all"
              :class="{
                'ring-2 ring-primary-400 dark:ring-primary-500 opacity-50': dragAttrIndex === i,
                'border-l-2 border-primary-500': dropAttrIndex === i && dragAttrIndex !== i
              }"
              draggable="true"
              @dragstart="onAttrDragStart($event, i)"
              @dragover="onAttrDragOver($event, i)"
              @dragleave="onAttrDragLeave"
              @drop="onAttrDrop($event, i)"
              @dragend="onAttrDragEnd"
            >
              <svg class="w-3 h-3 text-primary-400 dark:text-primary-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6h16.5M3.75 12h16.5m-16.5 6h16.5" />
              </svg>
              {{ attr }}
              <button
                class="p-0.5 rounded hover:bg-primary-200 dark:hover:bg-primary-800 text-primary-500 dark:text-primary-400 transition-colors"
                @click.stop="removeAttribute(i)"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
            <input
              ref="attrInputEl"
              v-model="attrInput"
              type="text"
              placeholder="Digite um atributo e pressione Enter..."
              class="flex-1 min-w-[180px] py-0.5 text-sm bg-transparent text-gray-800 dark:text-gray-100 focus:outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500"
              @keydown="onAttrKeydown"
            />
          </div>
          <p class="text-xs text-gray-400 dark:text-gray-500">
            <kbd class="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-600 font-mono text-[10px]">Enter</kbd> adiciona &nbsp;·&nbsp;
            <kbd class="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-600 font-mono text-[10px]">Backspace</kbd> remove o último &nbsp;·&nbsp;
            arraste para reordenar
          </p>
        </div>
        </div>
        <!-- /Right column -->

      </div>
      <!-- /Body grid -->

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex items-center gap-3">
        <button
          class="px-5 py-2.5 text-sm font-medium bg-primary-700 dark:bg-primary-600 text-white rounded-lg hover:bg-primary-800 dark:hover:bg-primary-500 transition-colors flex items-center gap-2"
          :disabled="!group.trim()"
          :class="{ 'opacity-50 cursor-not-allowed': !group.trim() }"
          @click="save"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
          </svg>
          Salvar Item
        </button>
        <button
          class="p-2.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          title="Limpar formulário"
          @click="resetForm"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
          </svg>
        </button>
      </div>
    </div>
    </div>

    <!-- Sub-tab: Editar Hierarquia -->
    <EditHierarchyView v-else-if="subTab === 'hierarquia'" />
  </div>
</template>
