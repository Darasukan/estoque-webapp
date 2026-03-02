<script setup>
import { ref, computed } from 'vue'
import { useItems } from '../composables/useItems.js'
import { useToast } from '../composables/useToast.js'

const {
  uniqueGroups, getCategoriesForGroup, getSubcategoriesForCategory,
  renameGroup, renameCategory, renameSubcategory,
  deleteGroup, deleteCategory, deleteSubcategory,
  countItemsInGroup, countItemsInCategory, countItemsInSubcategory,
  getItemsForSubcategory, renameAttribute, addAttribute, removeAttribute,
  getVariationsForItem
} = useItems()

const { success } = useToast()

// ===== Search =====
const searchQuery = ref('')
const searchNorm = computed(() => searchQuery.value.trim().toLowerCase())

function matchesSearch(text) {
  if (!searchNorm.value) return true
  return (text || '').toLowerCase().includes(searchNorm.value)
}

const filteredGroups = computed(() => {
  if (!searchNorm.value) return uniqueGroups.value
  return uniqueGroups.value.filter(g => {
    if (matchesSearch(g)) return true
    const cats = getCategoriesForGroup(g)
    for (const c of cats) {
      if (matchesSearch(c)) return true
      const subs = getSubcategoriesForCategory(g, c)
      if (subs.some(s => matchesSearch(s))) return true
    }
    return false
  })
})

function filteredCategories(group) {
  const cats = getCategoriesForGroup(group)
  if (!searchNorm.value) return cats
  return cats.filter(c => {
    if (matchesSearch(c) || matchesSearch(group)) return true
    return getSubcategoriesForCategory(group, c).some(s => matchesSearch(s))
  })
}

function filteredSubcategories(group, cat) {
  const subs = getSubcategoriesForCategory(group, cat)
  if (!searchNorm.value) return subs
  // If group or category matches, show all subs; otherwise filter
  if (matchesSearch(group) || matchesSearch(cat)) return subs
  return subs.filter(s => matchesSearch(s))
}

// Auto-expand when searching
function isGroupExpanded(group) {
  if (searchNorm.value) return true
  return !!expandedGroups.value[group]
}

function isCategoryExpanded(group, cat) {
  if (searchNorm.value) return true
  return !!expandedCategories.value[group + '|||' + cat]
}

// ===== Editing state =====
const editing = ref(null) // { type, group?, category?, oldName }
const editValue = ref('')

function startEdit(type, oldName, group = null, category = null) {
  editing.value = { type, group, category, oldName }
  editValue.value = oldName
}

function cancelEdit() {
  editing.value = null
  editValue.value = ''
}

function saveEdit() {
  const e = editing.value
  if (!e) return
  const newName = editValue.value.trim()
  if (!newName || newName === e.oldName) { cancelEdit(); return }

  if (e.type === 'group') {
    renameGroup(e.oldName, newName)
    success(`Grupo renomeado para "${newName}".`)
  } else if (e.type === 'category') {
    renameCategory(e.group, e.oldName, newName)
    success(`Categoria renomeada para "${newName}".`)
  } else if (e.type === 'subcategory') {
    renameSubcategory(e.group, e.category, e.oldName, newName)
    success(`Subcategoria renomeada para "${newName}".`)
  }
  cancelEdit()
}

function onEditKeydown(e) {
  if (e.key === 'Enter') saveEdit()
  else if (e.key === 'Escape') cancelEdit()
}

// ===== Delete =====
function onDeleteGroup(group) {
  const count = countItemsInGroup(group)
  if (!confirm(`Excluir grupo "${group}" e seus ${count} item(ns)?`)) return
  deleteGroup(group)
  success(`Grupo "${group}" excluído.`)
}

function onDeleteCategory(group, cat) {
  const count = countItemsInCategory(group, cat)
  if (!confirm(`Excluir categoria "${cat}" e seus ${count} item(ns)?`)) return
  deleteCategory(group, cat)
  success(`Categoria "${cat}" excluída.`)
}

function onDeleteSubcategory(group, cat, sub) {
  const count = countItemsInSubcategory(group, cat, sub)
  if (!confirm(`Excluir subcategoria "${sub}" e seus ${count} item(ns)?`)) return
  deleteSubcategory(group, cat, sub)
  success(`Subcategoria "${sub}" excluída.`)
}

// Check if currently editing this specific item
function isEditing(type, name, group = null, category = null) {
  const e = editing.value
  if (!e || e.type !== type || e.oldName !== name) return false
  if (type === 'category' && e.group !== group) return false
  if (type === 'subcategory' && (e.group !== group || e.category !== category)) return false
  return true
}

// ===== Expand/collapse groups =====
const expandedGroups = ref({})

function toggleGroup(group) {
  expandedGroups.value = { ...expandedGroups.value, [group]: !expandedGroups.value[group] }
}

const expandedCategories = ref({})

function toggleCategory(key) {
  expandedCategories.value = { ...expandedCategories.value, [key]: !expandedCategories.value[key] }
}

// ===== Items within subcategories =====
const expandedSubcategories = ref({})

function toggleSubcategory(key) {
  expandedSubcategories.value = { ...expandedSubcategories.value, [key]: !expandedSubcategories.value[key] }
}

function isSubcategoryExpanded(group, cat, sub) {
  return !!expandedSubcategories.value[group + '|||' + cat + '|||' + sub]
}

// ===== Attribute editing =====
const editingAttr = ref(null) // { itemId, oldName }
const editAttrValue = ref('')
const addingAttrItemId = ref(null)
const newAttrName = ref('')

function startAttrEdit(itemId, attrName) {
  editingAttr.value = { itemId, oldName: attrName }
  editAttrValue.value = attrName
}

function saveAttrEdit() {
  if (!editingAttr.value) return
  const newName = editAttrValue.value.trim()
  if (!newName || newName === editingAttr.value.oldName) { cancelAttrEdit(); return }
  renameAttribute(editingAttr.value.itemId, editingAttr.value.oldName, newName)
  success(`Atributo renomeado para "${newName}".`)
  cancelAttrEdit()
}

function cancelAttrEdit() {
  editingAttr.value = null
  editAttrValue.value = ''
}

function onAttrEditKeydown(e) {
  if (e.key === 'Enter') saveAttrEdit()
  else if (e.key === 'Escape') cancelAttrEdit()
}

function startAddAttr(itemId) {
  addingAttrItemId.value = itemId
  newAttrName.value = ''
}

function saveNewAttr() {
  const name = newAttrName.value.trim()
  if (!name) { cancelAddAttr(); return }
  addAttribute(addingAttrItemId.value, name)
  success(`Atributo "${name}" adicionado.`)
  cancelAddAttr()
}

function cancelAddAttr() {
  addingAttrItemId.value = null
  newAttrName.value = ''
}

function onNewAttrKeydown(e) {
  if (e.key === 'Enter') saveNewAttr()
  else if (e.key === 'Escape') cancelAddAttr()
}

function onRemoveAttr(itemId, attrName, item) {
  const varCount = getVariationsForItem(itemId).length
  const msg = varCount > 0
    ? `Remover atributo "${attrName}" de "${item.name}"? Os valores desse atributo serão apagados de ${varCount} variação(ões).`
    : `Remover atributo "${attrName}" de "${item.name}"?`
  if (!confirm(msg)) return
  removeAttribute(itemId, attrName)
  success(`Atributo "${attrName}" removido.`)
}

function isEditingAttr(itemId, attrName) {
  return editingAttr.value?.itemId === itemId && editingAttr.value?.oldName === attrName
}
</script>

<template>
  <div class="max-w-3xl mx-auto space-y-3">

    <!-- Search -->
    <div v-if="uniqueGroups.length > 0" class="relative mb-1">
      <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
      </svg>
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Pesquisar grupo, categoria ou subcategoria..."
        class="w-full pl-9 pr-8 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
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

    <!-- Empty -->
    <div v-if="uniqueGroups.length === 0" class="text-center py-16 text-gray-400 dark:text-gray-500">
      <svg class="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
      </svg>
      <p class="text-lg">Nenhuma hierarquia cadastrada.</p>
      <p class="text-sm mt-1">Cadastre itens na aba <strong>Novo Item</strong> para criar grupos, categorias e subcategorias.</p>
    </div>

    <!-- Group cards -->
    <!-- No search results -->
    <div v-if="filteredGroups.length === 0 && searchNorm" class="text-center py-10 text-gray-400 dark:text-gray-500">
      <p class="text-sm">Nenhum resultado para "{{ searchQuery }}".</p>
    </div>

    <div
      v-for="group in filteredGroups"
      :key="group"
      class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden"
    >
      <!-- Group header -->
      <div class="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-700/50">
        <!-- Expand toggle -->
        <button
          class="p-0.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          @click="toggleGroup(group)"
        >
          <svg
            class="w-4 h-4 transition-transform duration-200"
            :class="{ 'rotate-90': expandedGroups[group] }"
            fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>

        <!-- Group icon -->
        <div class="w-7 h-7 rounded bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
          <svg class="w-4 h-4 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
          </svg>
        </div>

        <!-- Name or edit input -->
        <template v-if="isEditing('group', group)">
          <input
            v-model="editValue"
            class="flex-1 px-2 py-1 text-sm font-bold border border-primary-400 dark:border-primary-500 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none"
            @keydown="onEditKeydown"
            ref="editInput"
            autofocus
          />
          <button class="p-1 text-green-500 hover:text-green-600 transition-colors" title="Salvar" @click="saveEdit">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
          </button>
          <button class="p-1 text-gray-400 hover:text-gray-600 transition-colors" title="Cancelar" @click="cancelEdit">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        </template>
        <template v-else>
          <span class="flex-1 text-sm font-bold text-gray-800 dark:text-gray-100 truncate cursor-pointer" @click="toggleGroup(group)">{{ group }}</span>
          <span class="text-xs text-gray-400 dark:text-gray-500 tabular-nums mr-1">{{ countItemsInGroup(group) }} itens</span>
          <button class="p-1 text-gray-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors" title="Renomear" @click.stop="startEdit('group', group)">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg>
          </button>
          <button class="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors" title="Excluir grupo" @click.stop="onDeleteGroup(group)">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79" /></svg>
          </button>
        </template>
      </div>

      <!-- Categories (expanded) -->
      <div v-if="isGroupExpanded(group)" class="divide-y divide-gray-100 dark:divide-gray-700/50">
        <template v-if="filteredCategories(group).length === 0 && getCategoriesForGroup(group).length === 0">
          <p class="px-4 py-3 text-sm text-gray-400 dark:text-gray-500 italic pl-14">Sem categorias — itens ficam direto no grupo.</p>
        </template>

        <div v-for="cat in filteredCategories(group)" :key="cat">
          <!-- Category row -->
          <div class="flex items-center gap-2 px-4 py-2.5 pl-10 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
            <!-- Expand toggle -->
            <button
              class="p-0.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              @click="toggleCategory(group + '|||' + cat)"
            >
              <svg
                class="w-3.5 h-3.5 transition-transform duration-200"
                :class="{ 'rotate-90': expandedCategories[group + '|||' + cat] }"
                fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </button>

            <!-- Category icon -->
            <div class="w-6 h-6 rounded bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
              <svg class="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
              </svg>
            </div>

            <!-- Name or edit -->
            <template v-if="isEditing('category', cat, group)">
              <input
                v-model="editValue"
                class="flex-1 px-2 py-1 text-sm border border-primary-400 dark:border-primary-500 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none"
                @keydown="onEditKeydown"
                autofocus
              />
              <button class="p-1 text-green-500 hover:text-green-600 transition-colors" title="Salvar" @click="saveEdit">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
              </button>
              <button class="p-1 text-gray-400 hover:text-gray-600 transition-colors" title="Cancelar" @click="cancelEdit">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              </button>
            </template>
            <template v-else>
              <span class="flex-1 text-sm font-semibold text-gray-700 dark:text-gray-200 truncate cursor-pointer" @click="toggleCategory(group + '|||' + cat)">{{ cat }}</span>
              <span class="text-xs text-gray-400 dark:text-gray-500 tabular-nums mr-1">{{ countItemsInCategory(group, cat) }}</span>
              <button class="p-1 text-gray-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors" title="Renomear" @click.stop="startEdit('category', cat, group)">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg>
              </button>
              <button class="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors" title="Excluir categoria" @click.stop="onDeleteCategory(group, cat)">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79" /></svg>
              </button>
            </template>
          </div>

          <!-- Subcategories -->
          <template v-if="isCategoryExpanded(group, cat)">
            <div
              v-for="sub in filteredSubcategories(group, cat)"
              :key="sub"
              class="flex items-center gap-2 px-4 py-2 pl-16 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
            >
              <!-- Expand toggle -->
              <button
                class="p-0.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                @click="toggleSubcategory(group + '|||' + cat + '|||' + sub)"
              >
                <svg
                  class="w-3 h-3 transition-transform duration-200"
                  :class="{ 'rotate-90': isSubcategoryExpanded(group, cat, sub) }"
                  fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </button>

              <!-- Subcategory icon -->
              <div class="w-5 h-5 rounded bg-gray-100 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
                <svg class="w-3 h-3 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                </svg>
              </div>

              <!-- Name or edit -->
              <template v-if="isEditing('subcategory', sub, group, cat)">
                <input
                  v-model="editValue"
                  class="flex-1 px-2 py-1 text-sm border border-primary-400 dark:border-primary-500 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none"
                  @keydown="onEditKeydown"
                  autofocus
                />
                <button class="p-1 text-green-500 hover:text-green-600 transition-colors" title="Salvar" @click="saveEdit">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                </button>
                <button class="p-1 text-gray-400 hover:text-gray-600 transition-colors" title="Cancelar" @click="cancelEdit">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                </button>
              </template>
              <template v-else>
                <span class="flex-1 text-sm text-gray-600 dark:text-gray-300 truncate cursor-pointer" @click="toggleSubcategory(group + '|||' + cat + '|||' + sub)">{{ sub }}</span>
                <span class="text-xs text-gray-400 dark:text-gray-500 tabular-nums mr-1">{{ countItemsInSubcategory(group, cat, sub) }}</span>
                <button class="p-1 text-gray-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors" title="Renomear" @click.stop="startEdit('subcategory', sub, group, cat)">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg>
                </button>
                <button class="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors" title="Excluir subcategoria" @click.stop="onDeleteSubcategory(group, cat, sub)">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79" /></svg>
                </button>
              </template>
            </div>

            <!-- No subcategories -->
            <p
              v-if="filteredSubcategories(group, cat).length === 0 && getSubcategoriesForCategory(group, cat).length === 0"
              class="px-4 py-2 pl-20 text-xs text-gray-400 dark:text-gray-500 italic"
            >
              Sem subcategorias.
            </p>

            <!-- Items inside subcategory (when expanded) -->
            <template v-for="sub in filteredSubcategories(group, cat)" :key="'items-' + sub">
              <template v-if="isSubcategoryExpanded(group, cat, sub)">
                <div
                  v-for="item in getItemsForSubcategory(group, cat, sub)"
                  :key="item.id"
                  class="ml-24 mr-4 mb-2 mt-1 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200/70 dark:border-gray-600/40 overflow-hidden"
                >
                  <!-- Item header -->
                  <div class="flex items-center gap-2 px-3 py-2">
                    <svg class="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
                      <path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6Z" />
                    </svg>
                    <span class="text-xs font-medium text-gray-600 dark:text-gray-300 flex-1">{{ item.name }}</span>
                    <span class="text-[10px] text-gray-400 dark:text-gray-500">{{ (item.attributes || []).length }} atrib.</span>
                  </div>

                  <!-- Attributes list -->
                  <div v-if="item.attributes?.length" class="border-t border-gray-200/50 dark:border-gray-600/30">
                    <div
                      v-for="attr in item.attributes"
                      :key="attr"
                      class="flex items-center gap-2 px-3 py-1.5 hover:bg-white/50 dark:hover:bg-gray-600/20 transition-colors group"
                    >
                      <!-- Editing attribute -->
                      <template v-if="isEditingAttr(item.id, attr)">
                        <svg class="w-3 h-3 text-primary-400 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        <input
                          v-model="editAttrValue"
                          class="flex-1 px-2 py-0.5 text-xs border border-primary-400 dark:border-primary-500 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none"
                          @keydown="onAttrEditKeydown"
                          autofocus
                        />
                        <button class="p-0.5 text-green-500 hover:text-green-600 transition-colors" title="Salvar" @click="saveAttrEdit">
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                        </button>
                        <button class="p-0.5 text-gray-400 hover:text-gray-600 transition-colors" title="Cancelar" @click="cancelAttrEdit">
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                        </button>
                      </template>

                      <!-- Display attribute -->
                      <template v-else>
                        <svg class="w-3 h-3 text-gray-300 dark:text-gray-600 flex-shrink-0" fill="currentColor" viewBox="0 0 8 8">
                          <circle cx="4" cy="4" r="3" />
                        </svg>
                        <span class="flex-1 text-xs text-gray-600 dark:text-gray-400">{{ attr }}</span>
                        <button
                          class="p-0.5 text-gray-300 dark:text-gray-600 hover:text-amber-500 dark:hover:text-amber-400 opacity-0 group-hover:opacity-100 transition-all"
                          title="Renomear atributo"
                          @click.stop="startAttrEdit(item.id, attr)"
                        >
                          <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg>
                        </button>
                        <button
                          class="p-0.5 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                          title="Remover atributo"
                          @click.stop="onRemoveAttr(item.id, attr, item)"
                        >
                          <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                        </button>
                      </template>
                    </div>
                  </div>

                  <!-- No attributes -->
                  <div v-else class="border-t border-gray-200/50 dark:border-gray-600/30 px-3 py-1.5">
                    <span class="text-[11px] text-gray-400 dark:text-gray-500 italic">Sem atributos</span>
                  </div>

                  <!-- Add attribute row -->
                  <div class="border-t border-gray-200/50 dark:border-gray-600/30 px-3 py-1.5">
                    <template v-if="addingAttrItemId === item.id">
                      <div class="flex items-center gap-2">
                        <input
                          v-model="newAttrName"
                          placeholder="Nome do atributo..."
                          class="flex-1 px-2 py-0.5 text-xs border border-primary-400 dark:border-primary-500 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none"
                          @keydown="onNewAttrKeydown"
                          autofocus
                        />
                        <button class="p-0.5 text-green-500 hover:text-green-600 transition-colors" @click="saveNewAttr">
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                        </button>
                        <button class="p-0.5 text-gray-400 hover:text-gray-600 transition-colors" @click="cancelAddAttr">
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    </template>
                    <button
                      v-else
                      class="text-[11px] text-primary-500 dark:text-primary-400 hover:text-primary-600 dark:hover:text-primary-300 font-medium transition-colors"
                      @click="startAddAttr(item.id)"
                    >
                      + Adicionar atributo
                    </button>
                  </div>
                </div>
              </template>
            </template>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
