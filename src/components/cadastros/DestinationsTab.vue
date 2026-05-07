<script setup>
import { computed, ref, watch } from 'vue'
import { useAuth } from '../../composables/useAuth.js'
import { useDestinations } from '../../composables/useDestinations.js'
import { useItems } from '../../composables/useItems.js'
import { useToast } from '../../composables/useToast.js'

const {
  addDestination,
  editDestination,
  toggleDestinationActive,
  deleteDestination,
  topLevelDestinations,
  getDestChildren,
  getDestFullName,
} = useDestinations()
const { items, variations, editVariation } = useItems()
const { isLoggedIn } = useAuth()
const { success, error } = useToast()

const destinationSearch = ref('')
const selectedParentId = ref('')
const selectedMaterialDestId = ref('')

const addingDest = ref(false)
const newDestName = ref('')
const newDestDesc = ref('')
const newDestParentId = ref(null)

const editingDestId = ref(null)
const editDestName = ref('')
const editDestDesc = ref('')

const addingMaterial = ref(false)
const materialSearch = ref('')
const pendingMaterialIds = ref([])
const materialGroup = ref('')
const materialCategory = ref('')
const materialSubcategory = ref('')
const materialItemId = ref('')
const linkedMaterialsPage = ref(1)
const linkedMaterialsPerPage = 8

const filteredParentList = computed(() => {
  const q = destinationSearch.value.trim().toLowerCase()
  if (!q) return topLevelDestinations.value
  return topLevelDestinations.value.filter(parent => {
    const children = getDestChildren(parent.id)
    return [parent, ...children].some(dest =>
      `${dest.name} ${dest.description || ''}`.toLowerCase().includes(q)
    )
  })
})

const selectedParent = computed(() =>
  topLevelDestinations.value.find(d => d.id === selectedParentId.value) || null
)

const selectedChildren = computed(() =>
  selectedParent.value ? getDestChildren(selectedParent.value.id) : []
)

const selectedMaterialDestination = computed(() => {
  const all = selectedParent.value ? [selectedParent.value, ...selectedChildren.value] : []
  return all.find(d => d.id === selectedMaterialDestId.value) || selectedParent.value
})

const canLinkMaterial = computed(() =>
  isLoggedIn.value && selectedMaterialDestination.value?.active
)

watch(topLevelDestinations, (parents) => {
  if (!parents.length) {
    selectedParentId.value = ''
    selectedMaterialDestId.value = ''
    return
  }

  const hasParent = parents.some(d => d.id === selectedParentId.value)
  if (!hasParent) selectParent(parents[0].id)
}, { immediate: true })

watch(selectedParent, (parent) => {
  if (!parent) {
    selectedMaterialDestId.value = ''
    return
  }
  const ids = [parent.id, ...getDestChildren(parent.id).map(d => d.id)]
  if (!ids.includes(selectedMaterialDestId.value)) selectedMaterialDestId.value = parent.id
})

function selectParent(id) {
  selectedParentId.value = id
  selectedMaterialDestId.value = id
  cancelEditDest()
  cancelAddDest()
  cancelMaterialAdd()
}

function selectMaterialDestination(id) {
  selectedMaterialDestId.value = id
  cancelMaterialAdd()
}

function startAddDest(parentId = null) {
  if (!isLoggedIn.value) return
  addingDest.value = true
  newDestName.value = ''
  newDestDesc.value = ''
  newDestParentId.value = parentId
  cancelEditDest()
}

function cancelAddDest() {
  addingDest.value = false
  newDestParentId.value = null
  newDestName.value = ''
  newDestDesc.value = ''
}

async function confirmAddDest() {
  if (!isLoggedIn.value) return
  const r = await addDestination(newDestName.value, newDestDesc.value, newDestParentId.value)
  if (!r.ok) { error(r.error); return }

  if (!newDestParentId.value) selectParent(r.destination.id)
  else selectMaterialDestination(r.destination.id)

  success(newDestParentId.value ? 'Sub-destino adicionado.' : 'Destino adicionado.')
  cancelAddDest()
}

function startEditDest(dest) {
  if (!isLoggedIn.value) return
  editingDestId.value = dest.id
  editDestName.value = dest.name
  editDestDesc.value = dest.description || ''
  cancelAddDest()
}

function cancelEditDest() {
  editingDestId.value = null
  editDestName.value = ''
  editDestDesc.value = ''
}

async function confirmEditDest() {
  if (!isLoggedIn.value || !editingDestId.value) return
  const r = await editDestination(editingDestId.value, {
    name: editDestName.value,
    description: editDestDesc.value,
  })
  if (!r.ok) { error(r.error); return }
  success('Destino atualizado.')
  cancelEditDest()
}

async function onToggleActive(dest) {
  if (!isLoggedIn.value) return
  await toggleDestinationActive(dest.id)
}

async function onDeleteDest(dest) {
  if (!isLoggedIn.value) return
  const children = getDestChildren(dest.id)
  const msg = children.length
    ? `Excluir destino "${dest.name}" e seus ${children.length} sub-destino(s)?`
    : `Excluir destino "${dest.name}"?`
  if (!confirm(msg)) return

  const removedIds = new Set([dest.id, ...children.map(c => c.id)])
  const linked = variations.value.filter(v =>
    (v.destinations || []).some(id => removedIds.has(id))
  )
  for (const variation of linked) {
    await editVariation(variation.id, {
      destinations: (variation.destinations || []).filter(id => !removedIds.has(id)),
    })
  }

  await deleteDestination(dest.id)
  if (removedIds.has(selectedParentId.value)) {
    const remainingParent = topLevelDestinations.value.find(parent => !removedIds.has(parent.id))
    if (remainingParent) selectParent(remainingParent.id)
    else {
      selectedParentId.value = ''
      selectedMaterialDestId.value = ''
    }
  } else if (removedIds.has(selectedMaterialDestId.value)) {
    selectedMaterialDestId.value = selectedParentId.value
  }
  success('Destino removido.')
}

function itemForVariation(variation) {
  return items.value.find(item => item.id === variation.itemId) || null
}

function variationLabel(variation) {
  const values = Object.entries(variation.values || {})
    .filter(([, value]) => String(value || '').trim())
    .map(([key, value]) => `${key}: ${value}`)
  return values.length ? values.join(' / ') : 'Variacao padrao'
}

function materialLabel(variation) {
  const item = itemForVariation(variation)
  return `${item?.name || 'Item'} - ${variationLabel(variation)}`
}

function materialMeta(variation) {
  const item = itemForVariation(variation)
  return [item?.group, item?.category, item?.subcategory].filter(Boolean).join(' > ')
}

function materialMatchesSearch(variation, query) {
  const item = itemForVariation(variation)
  const extras = Object.entries(variation.extras || {}).map(([k, v]) => `${k} ${v}`).join(' ')
  return [
    item?.name,
    item?.group,
    item?.category,
    item?.subcategory,
    variationLabel(variation),
    extras,
  ].filter(Boolean).join(' ').toLowerCase().includes(query)
}

function itemMatchesMaterialSearch(item, query) {
  if (!query) return true
  const itemVars = variations.value.filter(variation => variation.itemId === item.id)
  return [
    item.name,
    item.group,
    item.category,
    item.subcategory,
    item.location,
    ...itemVars.map(variation => `${variationLabel(variation)} ${Object.entries(variation.extras || {}).map(([k, v]) => `${k} ${v}`).join(' ')}`),
  ].filter(Boolean).join(' ').toLowerCase().includes(query)
}

const linkedMaterials = computed(() => {
  const destinationId = selectedMaterialDestination.value?.id
  if (!destinationId) return []
  return variations.value
    .filter(variation => (variation.destinations || []).includes(destinationId))
    .sort((a, b) => materialLabel(a).localeCompare(materialLabel(b)))
})

const linkedMaterialsTotalPages = computed(() =>
  Math.max(1, Math.ceil(linkedMaterials.value.length / linkedMaterialsPerPage))
)

const paginatedLinkedMaterials = computed(() => {
  const start = (linkedMaterialsPage.value - 1) * linkedMaterialsPerPage
  return linkedMaterials.value.slice(start, start + linkedMaterialsPerPage)
})

const linkedMaterialsPageStart = computed(() =>
  linkedMaterials.value.length ? (linkedMaterialsPage.value - 1) * linkedMaterialsPerPage + 1 : 0
)

const linkedMaterialsPageEnd = computed(() =>
  Math.min(linkedMaterialsPage.value * linkedMaterialsPerPage, linkedMaterials.value.length)
)

watch(() => selectedMaterialDestination.value?.id, () => {
  linkedMaterialsPage.value = 1
})

watch(linkedMaterialsTotalPages, (total) => {
  if (linkedMaterialsPage.value > total) linkedMaterialsPage.value = total
})

function materialCountForDestination(destinationId) {
  return variations.value.filter(variation =>
    (variation.destinations || []).includes(destinationId)
  ).length
}

function goLinkedMaterialsPage(delta) {
  linkedMaterialsPage.value = Math.min(
    linkedMaterialsTotalPages.value,
    Math.max(1, linkedMaterialsPage.value + delta)
  )
}

const materialSearchResults = computed(() => {
  const destinationId = selectedMaterialDestination.value?.id
  if (!destinationId) return []
  const q = materialSearch.value.trim().toLowerCase()
  return variations.value
    .filter(variation => !(variation.destinations || []).includes(destinationId))
    .filter(variation => !q || materialMatchesSearch(variation, q))
    .sort((a, b) => materialLabel(a).localeCompare(materialLabel(b)))
    .slice(0, 24)
})

function availableVariationsForItem(itemId) {
  const destinationId = selectedMaterialDestination.value?.id
  if (!destinationId) return []
  const q = materialSearch.value.trim().toLowerCase()
  return variations.value
    .filter(variation => variation.itemId === itemId)
    .filter(variation => !(variation.destinations || []).includes(destinationId))
    .filter(variation => !q || materialMatchesSearch(variation, q))
    .sort((a, b) => variationLabel(a).localeCompare(variationLabel(b)))
}

function itemHasAvailableVariation(item) {
  const destinationId = selectedMaterialDestination.value?.id
  if (!destinationId) return false
  const q = materialSearch.value.trim().toLowerCase()
  return variations.value.some(variation =>
    variation.itemId === item.id &&
    !(variation.destinations || []).includes(destinationId) &&
    (!q || itemMatchesMaterialSearch(item, q))
  )
}

const materialGroups = computed(() => {
  const groups = new Set()
  for (const item of items.value) {
    if (itemHasAvailableVariation(item)) groups.add(item.group)
  }
  return [...groups].sort((a, b) => a.localeCompare(b))
})

const materialCategories = computed(() => {
  if (!materialGroup.value) return []
  const categories = new Set()
  for (const item of items.value) {
    if (item.group === materialGroup.value && item.category && itemHasAvailableVariation(item)) {
      categories.add(item.category)
    }
  }
  return [...categories].sort((a, b) => a.localeCompare(b))
})

const materialSubcategories = computed(() => {
  if (!materialGroup.value || !materialCategory.value) return []
  const subcategories = new Set()
  for (const item of items.value) {
    if (
      item.group === materialGroup.value &&
      item.category === materialCategory.value &&
      item.subcategory &&
      itemHasAvailableVariation(item)
    ) {
      subcategories.add(item.subcategory)
    }
  }
  return [...subcategories].sort((a, b) => a.localeCompare(b))
})

const materialItems = computed(() => {
  if (!materialGroup.value) return []
  return items.value
    .filter(item => itemHasAvailableVariation(item))
    .filter(item => item.group === materialGroup.value)
    .filter(item => !materialCategory.value || item.category === materialCategory.value)
    .filter(item => !materialSubcategory.value || item.subcategory === materialSubcategory.value)
    .filter(item => {
      if (materialSubcategory.value) return true
      if (materialCategory.value) return !materialSubcategories.value.length || !item.subcategory
      return !materialCategories.value.length || !item.category
    })
    .sort((a, b) => a.name.localeCompare(b.name))
})

const selectedMaterialItem = computed(() =>
  items.value.find(item => item.id === materialItemId.value) || null
)

const selectedMaterialItemVariations = computed(() =>
  materialItemId.value ? availableVariationsForItem(materialItemId.value) : []
)

const currentScopeMaterialIds = computed(() => {
  if (selectedMaterialItem.value) return selectedMaterialItemVariations.value.map(v => v.id)
  if (!materialGroup.value) return []
  return items.value
    .filter(item => item.group === materialGroup.value)
    .filter(item => !materialCategory.value || item.category === materialCategory.value)
    .filter(item => !materialSubcategory.value || item.subcategory === materialSubcategory.value)
    .flatMap(item => availableVariationsForItem(item.id).map(v => v.id))
})

const allCurrentScopePending = computed(() =>
  currentScopeMaterialIds.value.length > 0 &&
  currentScopeMaterialIds.value.every(id => pendingMaterialIds.value.includes(id))
)

const materialBreadcrumb = computed(() => [
  materialGroup.value,
  materialCategory.value,
  materialSubcategory.value,
  selectedMaterialItem.value?.name,
].filter(Boolean))

const materialModalTitle = computed(() => {
  if (selectedMaterialItem.value) return 'Variacoes'
  if (materialSubcategory.value || (materialCategory.value && !materialSubcategories.value.length) || (materialGroup.value && !materialCategories.value.length)) return 'Itens'
  if (materialCategory.value) return 'Nivel 3'
  if (materialGroup.value) return 'Nivel 2'
  return 'Nivel 1'
})

function resetMaterialNavigation() {
  materialGroup.value = ''
  materialCategory.value = ''
  materialSubcategory.value = ''
  materialItemId.value = ''
}

function selectMaterialGroup(group) {
  materialGroup.value = group
  materialCategory.value = ''
  materialSubcategory.value = ''
  materialItemId.value = ''
}

function selectMaterialCategory(category) {
  materialCategory.value = category
  materialSubcategory.value = ''
  materialItemId.value = ''
}

function selectMaterialSubcategory(subcategory) {
  materialSubcategory.value = subcategory
  materialItemId.value = ''
}

function selectMaterialItem(itemId) {
  materialItemId.value = itemId
}

function goMaterialRoot() {
  resetMaterialNavigation()
}

function goMaterialGroup() {
  materialCategory.value = ''
  materialSubcategory.value = ''
  materialItemId.value = ''
}

function goMaterialCategory() {
  materialSubcategory.value = ''
  materialItemId.value = ''
}

function goMaterialSubcategory() {
  materialItemId.value = ''
}

function startMaterialAdd() {
  if (!canLinkMaterial.value) return
  addingMaterial.value = true
  materialSearch.value = ''
  pendingMaterialIds.value = []
  resetMaterialNavigation()
}

function cancelMaterialAdd() {
  addingMaterial.value = false
  materialSearch.value = ''
  pendingMaterialIds.value = []
  resetMaterialNavigation()
}

function isPendingMaterial(variationId) {
  return pendingMaterialIds.value.includes(variationId)
}

function togglePendingMaterial(variationId) {
  if (!canLinkMaterial.value) return
  const idx = pendingMaterialIds.value.indexOf(variationId)
  if (idx >= 0) pendingMaterialIds.value.splice(idx, 1)
  else pendingMaterialIds.value.push(variationId)
}

function toggleCurrentScopeMaterials() {
  if (!canLinkMaterial.value || !currentScopeMaterialIds.value.length) return
  if (allCurrentScopePending.value) {
    pendingMaterialIds.value = pendingMaterialIds.value.filter(id => !currentScopeMaterialIds.value.includes(id))
    return
  }
  const selected = new Set(pendingMaterialIds.value)
  for (const id of currentScopeMaterialIds.value) selected.add(id)
  pendingMaterialIds.value = [...selected]
}

async function savePendingMaterials() {
  if (!canLinkMaterial.value) return
  if (!pendingMaterialIds.value.length) {
    cancelMaterialAdd()
    return
  }
  const destinationId = selectedMaterialDestination.value.id
  for (const variationId of pendingMaterialIds.value) {
    const variation = variations.value.find(v => v.id === variationId)
    if (!variation) continue
    const destinations = new Set(variation.destinations || [])
    destinations.add(destinationId)
    const r = await editVariation(variation.id, { destinations: [...destinations] })
    if (!r.ok) { error(r.error); return }
  }
  success(pendingMaterialIds.value.length === 1 ? 'Material vinculado ao destino.' : 'Materiais vinculados ao destino.')
  cancelMaterialAdd()
}

async function removeMaterialFromDestination(variation) {
  if (!isLoggedIn.value || !selectedMaterialDestination.value) return
  const destinationId = selectedMaterialDestination.value.id
  const r = await editVariation(variation.id, {
    destinations: (variation.destinations || []).filter(id => id !== destinationId),
  })
  if (!r.ok) { error(r.error); return }
  success('Vinculo removido.')
}
</script>

<template>
  <div class="flex gap-0 min-h-[560px] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
    <!-- Left panel -->
    <aside class="w-64 flex-shrink-0 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
      <div class="px-3 pt-2.5 pb-2 border-b border-gray-200 dark:border-gray-700 flex flex-col gap-2">
        <p class="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Destinos</p>
        <div class="relative">
          <svg class="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-300 dark:text-gray-600 pointer-events-none" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0Z" /></svg>
          <input
            v-model="destinationSearch"
            placeholder="Filtrar..."
            class="w-full pl-6 pr-2 py-1 text-xs rounded-md bg-gray-100 dark:bg-gray-700/60 border border-transparent focus:border-gray-300 dark:focus:border-gray-600 text-gray-600 dark:text-gray-300 placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none transition-colors"
          />
        </div>
      </div>

      <div class="flex-1 overflow-y-auto py-1">
        <div v-if="!topLevelDestinations.length && !addingDest" class="px-3 py-4 text-center text-xs text-gray-400 dark:text-gray-500 italic">
          Nenhum destino ainda.
        </div>

        <button
          v-for="parent in filteredParentList"
          :key="parent.id"
          type="button"
          class="group/row w-[calc(100%-0.5rem)] flex items-center gap-1.5 px-2 py-1.5 mx-1 my-0.5 rounded-lg cursor-pointer transition-colors text-left"
          :class="selectedParentId === parent.id
            ? 'bg-primary-600 dark:bg-primary-700 text-white'
            : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'"
          @click="selectParent(parent.id)"
        >
          <svg class="w-4 h-4 flex-shrink-0 opacity-70" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
          </svg>
          <span class="flex-1 min-w-0 text-sm font-medium truncate">{{ parent.name }}</span>
          <span class="text-[10px] opacity-60 tabular-nums flex-shrink-0">{{ getDestChildren(parent.id).length }}</span>
          <span
            class="w-2 h-2 rounded-full flex-shrink-0"
            :class="parent.active ? 'bg-green-400' : 'bg-gray-400'"
            :title="parent.active ? 'Ativo' : 'Inativo'"
          ></span>
        </button>
      </div>

      <div v-if="isLoggedIn" class="border-t border-gray-200 dark:border-gray-700 p-2">
        <div v-if="addingDest && !newDestParentId" class="flex items-center gap-1">
          <input
            v-model="newDestName"
            placeholder="Nome do destino"
            class="flex-1 min-w-0 px-2 py-1 text-xs rounded-md border border-primary-400 dark:border-primary-500 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none"
            autofocus
            @keydown.enter="confirmAddDest"
            @keydown.escape="cancelAddDest"
          />
          <button class="p-1 text-green-500 hover:text-green-600 flex-shrink-0" title="Salvar" @click="confirmAddDest">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
          </button>
          <button class="p-1 text-gray-400 hover:text-gray-500 flex-shrink-0" title="Cancelar" @click="cancelAddDest">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <button
          v-else
          class="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-700/60 rounded-md transition-colors"
          @click="startAddDest(null)"
        >
          <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Novo destino
        </button>
      </div>
    </aside>

    <!-- Right panel -->
    <main class="flex-1 min-w-0 bg-white dark:bg-gray-900 overflow-y-auto">
      <div v-if="!selectedParent" class="flex flex-col items-center justify-center h-full py-20 text-gray-300 dark:text-gray-600">
        <svg class="w-10 h-10 mb-3" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
        <p class="text-sm">Selecione um destino a esquerda.</p>
      </div>

      <template v-else>
        <div class="flex items-center gap-2 px-5 py-3 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
          <span class="text-sm font-bold text-gray-800 dark:text-gray-100">{{ selectedParent.name }}</span>
          <template v-if="selectedMaterialDestination && selectedMaterialDestination.id !== selectedParent.id">
            <svg class="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
            <span class="text-sm font-bold text-gray-800 dark:text-gray-100">{{ selectedMaterialDestination.name }}</span>
          </template>
          <span
            class="ml-auto px-2 py-0.5 rounded-full text-[11px] font-medium"
            :class="selectedMaterialDestination?.active
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'"
          >
            {{ selectedMaterialDestination?.active ? 'Ativo' : 'Inativo' }}
          </span>
        </div>

        <div class="p-5 space-y-6">
          <!-- Parent details -->
          <section
            class="rounded-xl border bg-gray-50 dark:bg-gray-800 overflow-hidden transition-all"
            :class="selectedMaterialDestId === selectedParent.id
              ? 'border-primary-500 dark:border-primary-500 ring-1 ring-primary-500/30'
              : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700'"
          >
            <div class="px-4 py-3 flex items-center gap-3 border-b border-gray-100 dark:border-gray-700">
              <template v-if="editingDestId === selectedParent.id">
                <input
                  v-model="editDestName"
                  class="flex-1 min-w-0 px-2 py-1.5 text-sm border border-primary-400 dark:border-primary-500 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none"
                  autofocus
                  @keydown.enter="confirmEditDest"
                  @keydown.escape="cancelEditDest"
                />
                <input
                  v-model="editDestDesc"
                  placeholder="Descricao..."
                  class="flex-1 min-w-0 px-2 py-1.5 text-sm border border-primary-400 dark:border-primary-500 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none"
                  @keydown.enter="confirmEditDest"
                  @keydown.escape="cancelEditDest"
                />
                <button class="p-1 text-green-500 hover:text-green-600" title="Salvar" @click="confirmEditDest">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                </button>
                <button class="p-1 text-gray-400 hover:text-gray-600" title="Cancelar" @click="cancelEditDest">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                </button>
              </template>

              <template v-else>
                <button
                  type="button"
                  class="flex-1 min-w-0 text-left rounded-lg px-2 py-1 -mx-2 hover:bg-white dark:hover:bg-gray-700/60 transition-colors"
                  @click="selectMaterialDestination(selectedParent.id)"
                >
                  <p class="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    <span class="truncate">{{ selectedParent.name }}</span>
                  </p>
                  <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{{ selectedParent.description || 'Sem descricao' }}</p>
                </button>
                <span
                  v-if="selectedMaterialDestId === selectedParent.id"
                  class="px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300"
                >Selecionado</span>
                <div v-if="isLoggedIn" class="flex items-center gap-1">
                  <button
                    class="px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors"
                    :class="selectedParent.active
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'"
                    @click="onToggleActive(selectedParent)"
                  >{{ selectedParent.active ? 'Ativo' : 'Inativo' }}</button>
                  <button class="p-1 rounded text-gray-400 hover:text-amber-500 dark:hover:text-amber-400 bg-white dark:bg-gray-700 shadow-sm" title="Editar" @click="startEditDest(selectedParent)">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg>
                  </button>
                  <button class="p-1 rounded text-gray-400 hover:text-red-500 dark:hover:text-red-400 bg-white dark:bg-gray-700 shadow-sm" title="Excluir" @click="onDeleteDest(selectedParent)">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79" /></svg>
                  </button>
                </div>
              </template>
            </div>
          </section>

          <!-- Children cards -->
          <section>
            <div class="flex items-center justify-between mb-3">
              <p class="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Sub-destinos</p>
              <button
                v-if="isLoggedIn && selectedParent.active && !(addingDest && newDestParentId === selectedParent.id)"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
                @click="startAddDest(selectedParent.id)"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                Novo sub-destino
              </button>
            </div>

            <div v-if="addingDest && newDestParentId === selectedParent.id" class="mb-3 rounded-xl border border-primary-300 dark:border-primary-700 bg-primary-50/40 dark:bg-primary-900/10 p-3 flex items-center gap-2">
              <input
                v-model="newDestName"
                placeholder="Nome do sub-destino"
                class="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-400 dark:focus:border-primary-500"
                autofocus
                @keydown.enter="confirmAddDest"
                @keydown.escape="cancelAddDest"
              />
              <input
                v-model="newDestDesc"
                placeholder="Descricao"
                class="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-400 dark:focus:border-primary-500"
                @keydown.enter="confirmAddDest"
                @keydown.escape="cancelAddDest"
              />
              <button class="p-2 text-green-500 hover:text-green-600" title="Salvar" @click="confirmAddDest">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
              </button>
              <button class="p-2 text-gray-400 hover:text-gray-600" title="Cancelar" @click="cancelAddDest">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div v-if="selectedChildren.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div
                v-for="child in selectedChildren"
                :key="child.id"
                class="group/card relative rounded-xl border bg-gray-50 dark:bg-gray-800 hover:border-primary-400 dark:hover:border-primary-600 hover:shadow-sm transition-all"
                :class="[
                  selectedMaterialDestId === child.id ? 'border-primary-500 dark:border-primary-500 ring-1 ring-primary-500/30' : 'border-gray-200 dark:border-gray-700',
                  !child.active ? 'opacity-60' : ''
                ]"
              >
                <template v-if="editingDestId === child.id">
                  <div class="p-4 space-y-2">
                    <input
                      v-model="editDestName"
                      class="w-full px-2 py-1 text-sm border border-primary-400 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none"
                      autofocus
                      @keydown.enter="confirmEditDest"
                      @keydown.escape="cancelEditDest"
                    />
                    <input
                      v-model="editDestDesc"
                      placeholder="Descricao..."
                      class="w-full px-2 py-1 text-sm border border-primary-400 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none"
                      @keydown.enter="confirmEditDest"
                      @keydown.escape="cancelEditDest"
                    />
                    <div class="flex justify-end gap-1">
                      <button class="p-1 rounded text-green-500 hover:text-green-600" title="Salvar" @click.stop="confirmEditDest">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                      </button>
                      <button class="p-1 rounded text-gray-400 hover:text-gray-600" title="Cancelar" @click.stop="cancelEditDest">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  </div>
                </template>

                <template v-else>
                  <button class="w-full text-left p-4 cursor-pointer" type="button" @click="selectMaterialDestination(child.id)">
                    <p class="text-sm font-bold text-gray-800 dark:text-gray-100 truncate pr-20">{{ child.name }}</p>
                    <p class="text-xs text-gray-400 dark:text-gray-500 mt-1 line-clamp-2">{{ child.description || 'Sem descricao' }}</p>
                    <p class="text-[11px] text-gray-400 dark:text-gray-500 mt-3">{{ materialCountForDestination(child.id) }} materiais</p>
                  </button>
                  <span
                    v-if="selectedMaterialDestId === child.id"
                    class="absolute bottom-2 left-4 px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300"
                  >Selecionado</span>
                  <span
                    class="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[11px] font-medium"
                    :class="child.active
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'"
                  >{{ child.active ? 'Ativo' : 'Inativo' }}</span>
                  <div v-if="isLoggedIn" class="absolute bottom-2 right-2 flex gap-0.5 opacity-0 group-hover/card:opacity-100 transition-opacity">
                    <button
                      class="p-1 rounded text-gray-400 hover:text-green-500 dark:hover:text-green-400 bg-white dark:bg-gray-700 shadow-sm"
                      :title="child.active ? 'Inativar' : 'Ativar'"
                      @click.stop="onToggleActive(child)"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                    </button>
                    <button class="p-1 rounded text-gray-400 hover:text-amber-500 dark:hover:text-amber-400 bg-white dark:bg-gray-700 shadow-sm" title="Editar" @click.stop="startEditDest(child)">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg>
                    </button>
                    <button class="p-1 rounded text-gray-400 hover:text-red-500 dark:hover:text-red-400 bg-white dark:bg-gray-700 shadow-sm" title="Excluir" @click.stop="onDeleteDest(child)">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79" /></svg>
                    </button>
                  </div>
                </template>
              </div>
            </div>

            <div v-else class="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
              Nenhum sub-destino cadastrado.
            </div>
          </section>

          <!-- Linked materials -->
          <section class="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div class="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3">
              <div class="flex-1 min-w-0">
                <p class="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Materiais utilizados</p>
                <p class="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                  {{ getDestFullName(selectedMaterialDestination?.id) }}
                </p>
                <p v-if="linkedMaterials.length" class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {{ linkedMaterialsPageStart }}-{{ linkedMaterialsPageEnd }} de {{ linkedMaterials.length }} materiais
                </p>
              </div>
              <button
                v-if="canLinkMaterial && !addingMaterial"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
                @click="startMaterialAdd"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                Adicionar material
              </button>
            </div>

            <div v-if="linkedMaterials.length" class="divide-y divide-gray-100 dark:divide-gray-800">
              <div
                v-for="variation in paginatedLinkedMaterials"
                :key="variation.id"
                class="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{{ materialLabel(variation) }}</p>
                  <p class="text-xs text-gray-400 dark:text-gray-500 truncate">{{ materialMeta(variation) || 'Sem hierarquia' }}</p>
                </div>
                <div class="text-right flex-shrink-0">
                  <p class="text-xs text-gray-400 dark:text-gray-500">Estoque</p>
                  <p class="text-sm font-semibold tabular-nums text-gray-800 dark:text-gray-100">{{ variation.stock }}</p>
                </div>
                <div class="text-right flex-shrink-0">
                  <p class="text-xs text-gray-400 dark:text-gray-500">Min.</p>
                  <p class="text-sm font-semibold tabular-nums text-gray-800 dark:text-gray-100">{{ variation.minStock || 0 }}</p>
                </div>
                <button
                  v-if="isLoggedIn"
                  class="p-1.5 rounded text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  title="Remover vinculo"
                  @click="removeMaterialFromDestination(variation)"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div
                v-if="linkedMaterialsTotalPages > 1"
                class="px-4 py-3 flex items-center justify-between gap-3 bg-gray-50 dark:bg-gray-800/50"
              >
                <p class="text-xs text-gray-400 dark:text-gray-500">
                  Pagina {{ linkedMaterialsPage }} de {{ linkedMaterialsTotalPages }}
                </p>
                <div class="flex items-center gap-2">
                  <button
                    class="px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-primary-400 dark:hover:border-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    :disabled="linkedMaterialsPage <= 1"
                    @click="goLinkedMaterialsPage(-1)"
                  >Anterior</button>
                  <button
                    class="px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-primary-400 dark:hover:border-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    :disabled="linkedMaterialsPage >= linkedMaterialsTotalPages"
                    @click="goLinkedMaterialsPage(1)"
                  >Proxima</button>
                </div>
              </div>
            </div>

            <div v-else class="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
              Nenhum material vinculado a este destino.
            </div>
          </section>
        </div>
      </template>
    </main>
  </div>

  <Teleport to="body">
    <div
      v-if="addingMaterial"
      class="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 px-4 py-6"
      @click.self="cancelMaterialAdd"
    >
      <div class="w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl flex flex-col">
        <div class="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
          <div class="flex-1 min-w-0">
            <p class="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Adicionar materiais</p>
            <p class="text-base font-semibold text-gray-800 dark:text-gray-100 truncate">{{ getDestFullName(selectedMaterialDestination?.id) }}</p>
          </div>
          <button
            class="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Fechar"
            @click="cancelMaterialAdd"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div class="p-5 border-b border-gray-100 dark:border-gray-800">
          <div class="relative">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 dark:text-gray-600 pointer-events-none" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0Z" /></svg>
            <input
              v-model="materialSearch"
              placeholder="Buscar material, variacao ou categoria..."
              class="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              autofocus
              @keydown.escape="cancelMaterialAdd"
            />
          </div>
          <p class="mt-2 text-xs text-gray-400 dark:text-gray-500">
            {{ pendingMaterialIds.length }} {{ pendingMaterialIds.length === 1 ? 'material selecionado' : 'materiais selecionados' }}
          </p>
          <div class="mt-3 flex items-center gap-1.5 text-sm flex-wrap">
            <button
              class="text-primary-600 dark:text-primary-400 hover:underline font-medium"
              @click="goMaterialRoot"
            >Catalogo</button>
            <template v-if="materialGroup">
              <svg class="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
              <button
                class="text-primary-600 dark:text-primary-400 hover:underline font-medium"
                :class="{ 'text-gray-800 dark:text-gray-100 no-underline': !materialCategory }"
                @click="goMaterialGroup"
              >{{ materialGroup }}</button>
            </template>
            <template v-if="materialCategory">
              <svg class="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
              <button
                class="text-primary-600 dark:text-primary-400 hover:underline font-medium"
                :class="{ 'text-gray-800 dark:text-gray-100 no-underline': !materialSubcategory }"
                @click="goMaterialCategory"
              >{{ materialCategory }}</button>
            </template>
            <template v-if="materialSubcategory">
              <svg class="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
              <button
                class="text-primary-600 dark:text-primary-400 hover:underline font-medium"
                :class="{ 'text-gray-800 dark:text-gray-100 no-underline': !selectedMaterialItem }"
                @click="goMaterialSubcategory"
              >{{ materialSubcategory }}</button>
            </template>
            <template v-if="selectedMaterialItem">
              <svg class="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
              <span class="font-semibold text-gray-800 dark:text-gray-100">{{ selectedMaterialItem.name }}</span>
            </template>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto p-5">
          <div class="flex items-center justify-between mb-3">
            <p class="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">{{ materialModalTitle }}</p>
            <div class="flex items-center gap-2 min-w-0">
              <p v-if="materialBreadcrumb.length" class="text-xs text-gray-400 dark:text-gray-500 truncate">{{ materialBreadcrumb.join(' > ') }}</p>
              <button
                v-if="currentScopeMaterialIds.length"
                type="button"
                class="shrink-0 rounded-lg bg-primary-100 px-3 py-1.5 text-xs font-medium text-primary-700 transition-colors hover:bg-primary-200 dark:bg-primary-900/30 dark:text-primary-300 dark:hover:bg-primary-900/50"
                @click="toggleCurrentScopeMaterials"
              >
                {{ allCurrentScopePending ? 'Remover nível' : 'Selecionar nível' }}
              </button>
            </div>
          </div>

          <div v-if="!materialGroup && materialGroups.length" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <button
              v-for="group in materialGroups"
              :key="group"
              type="button"
              class="group/block relative rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4 text-left hover:border-primary-400 dark:hover:border-primary-600 hover:shadow-sm transition-all"
              @click="selectMaterialGroup(group)"
            >
              <p class="text-sm font-bold text-gray-800 dark:text-gray-100 truncate">{{ group }}</p>
              <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">
                {{ items.filter(item => item.group === group && itemHasAvailableVariation(item)).length }} itens
              </p>
            </button>
          </div>

          <div v-else-if="materialGroup && !materialCategory && materialCategories.length" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <button
              v-for="category in materialCategories"
              :key="category"
              type="button"
              class="group/block relative rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4 text-left hover:border-primary-400 dark:hover:border-primary-600 hover:shadow-sm transition-all"
              @click="selectMaterialCategory(category)"
            >
              <p class="text-sm font-bold text-gray-800 dark:text-gray-100 truncate">{{ category }}</p>
              <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">
                {{ items.filter(item => item.group === materialGroup && item.category === category && itemHasAvailableVariation(item)).length }} itens
              </p>
            </button>
          </div>

          <div v-else-if="materialCategory && !materialSubcategory && materialSubcategories.length" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <button
              v-for="subcategory in materialSubcategories"
              :key="subcategory"
              type="button"
              class="group/block relative rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4 text-left hover:border-primary-400 dark:hover:border-primary-600 hover:shadow-sm transition-all"
              @click="selectMaterialSubcategory(subcategory)"
            >
              <p class="text-sm font-bold text-gray-800 dark:text-gray-100 truncate">{{ subcategory }}</p>
              <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">
                {{ items.filter(item => item.group === materialGroup && item.category === materialCategory && item.subcategory === subcategory && itemHasAvailableVariation(item)).length }} itens
              </p>
            </button>
          </div>

          <div v-else-if="!selectedMaterialItem && materialItems.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <button
              v-for="item in materialItems"
              :key="item.id"
              type="button"
              class="group/block relative rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4 text-left hover:border-primary-400 dark:hover:border-primary-600 hover:shadow-sm transition-all"
              @click="selectMaterialItem(item.id)"
            >
              <p class="text-sm font-bold text-gray-800 dark:text-gray-100 line-clamp-2">{{ item.name }}</p>
              <p class="mt-2 text-xs text-gray-400 dark:text-gray-500 line-clamp-2">
                {{ [item.group, item.category, item.subcategory].filter(Boolean).join(' > ') || 'Sem hierarquia' }}
              </p>
              <p class="mt-3 text-[11px] text-gray-400 dark:text-gray-500">{{ availableVariationsForItem(item.id).length }} variacoes</p>
            </button>
          </div>

          <div v-else-if="selectedMaterialItem && selectedMaterialItemVariations.length" class="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-900">
            <button
              v-for="variation in selectedMaterialItemVariations"
              :key="variation.id"
              type="button"
              class="w-full flex items-center gap-3 px-4 py-2.5 text-left border-b border-gray-100 dark:border-gray-800 last:border-b-0 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
              :class="isPendingMaterial(variation.id) ? 'bg-primary-50 dark:bg-primary-900/20' : ''"
              @click="togglePendingMaterial(variation.id)"
            >
              <span
                class="flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors"
                :class="isPendingMaterial(variation.id)
                  ? 'bg-primary-600 border-primary-600'
                  : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900'"
              >
                <svg v-if="isPendingMaterial(variation.id)" class="w-3 h-3 text-white" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
              </span>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{{ variationLabel(variation) }}</p>
                <p class="text-xs text-gray-400 dark:text-gray-500 truncate">{{ materialMeta(variation) || selectedMaterialItem.name }}</p>
              </div>
              <div class="flex items-center gap-2 flex-shrink-0">
                <span class="px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                  Estoque {{ variation.stock }}
                </span>
                <span
                  v-if="variation.minStock"
                  class="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                >
                  Min. {{ variation.minStock }}
                </span>
              </div>
            </button>
          </div>

          <p v-else class="px-5 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
            Nenhum material disponivel neste nivel.
          </p>
        </div>

        <div class="px-5 py-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-2">
          <button
            class="px-4 py-2 text-sm rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            @click="cancelMaterialAdd"
          >Cancelar</button>
          <button
            class="px-4 py-2 text-sm font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!pendingMaterialIds.length"
            @click="savePendingMaterials"
          >Salvar vinculos</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
button:not(:disabled) {
  cursor: pointer;
}
</style>
