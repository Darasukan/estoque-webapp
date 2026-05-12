import { ref, computed, watch, nextTick } from 'vue'
import { useItems } from './useItems.js'
import { useToast } from './useToast.js'
import { useLocations } from './useLocations.js'
import { units } from '../utils/units.js'

export function useEditHierarchyState() {
const {
  items,
  uniqueGroups, getCategoriesForGroup, getSubcategoriesForCategory,
  renameGroup, renameCategory, renameSubcategory,
  moveCategory, moveSubcategory, moveItem,
  deleteGroup, deleteCategory, deleteSubcategory,
  countItemsInGroup, countItemsInCategory, countItemsInSubcategory,
  getItemsForSubcategory, renameAttribute, addAttribute, removeAttribute,
  getVariationsForItem, addItem, editItem, deleteItem,
  addVariation, editVariation, deleteVariation,
  reorderGroups, reorderCategories, reorderSubcategories, reorderItemAttributes
} = useItems()

const { success, error } = useToast()
const { activeLocais, groupedLocais } = useLocations()

// Returns unique extra-field keys used across all variations of an item
function getItemExtraKeys(itemId) {
  const vars = getVariationsForItem(itemId)
  const keys = new Set()
  for (const v of vars) for (const k of Object.keys(v.extras || {})) keys.add(k)
  return [...keys]
}

// ===== Navigation =====
const selectedGroup = ref(null)
const selectedCategory = ref(null)
const selectedSubcategory = ref(null)
const groupSearch = ref('')
const searchQ = computed(() => groupSearch.value.trim().toLowerCase())

const filteredGroupList = computed(() => {
  const q = searchQ.value
  if (!q) return uniqueGroups.value
  return uniqueGroups.value.filter(g => {
    if (g.toLowerCase().includes(q)) return true
    const cats = getCategoriesForGroup(g)
    for (const c of cats) {
      if (c.toLowerCase().includes(q)) return true
      const subs = getSubcategoriesForCategory(g, c)
      if (subs.some(s => s.toLowerCase().includes(q))) return true
    }
    return false
  })
})

// Auto-navigate when the query uniquely points to one group+category
watch(searchQ, async (q) => {
  if (!q) return
  const matches = []
  for (const g of uniqueGroups.value) {
    for (const c of getCategoriesForGroup(g)) {
      const subs = getSubcategoriesForCategory(g, c)
      if (subs.some(s => s.toLowerCase().includes(q))) {
        matches.push({ g, c })
      }
    }
  }
  if (matches.length === 1) {
    selectedGroup.value = matches[0].g
    await nextTick() // let selectedGroup watcher reset selectedCategory first
    selectedCategory.value = matches[0].c
  }
})

watch(selectedGroup, () => { selectedCategory.value = null; selectedSubcategory.value = null; cancelEdit(); cancelDelete(); cancelMove() })
watch(selectedCategory, () => { selectedSubcategory.value = null; cancelAddSubcategory(); cancelEdit(); cancelDelete(); cancelMove() })
watch(selectedSubcategory, () => { expandedItemId.value = null; cancelAddVariation(); cancelEditVariation(); cancelEdit(); cancelDelete(); cancelMove() })

watch(uniqueGroups, (groups) => {
  if (selectedGroup.value && !groups.includes(selectedGroup.value)) selectedGroup.value = null
})

// ===== Inline editing =====
const editing = ref(null)
const editValue = ref('')

function startEdit(type, oldName, group = null, category = null) {
  editing.value = { type, oldName, group, category }
  editValue.value = oldName
  cancelDelete()
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
    selectedGroup.value = newName
    success(`Grupo renomeado para "${newName}".`)
  } else if (e.type === 'category') {
    renameCategory(e.group, e.oldName, newName)
    if (selectedCategory.value === e.oldName) selectedCategory.value = newName
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

function isEditing(type, name, group = null, category = null) {
  const e = editing.value
  if (!e || e.type !== type || e.oldName !== name) return false
  if (type === 'category' && e.group !== group) return false
  if (type === 'subcategory' && (e.group !== group || e.category !== category)) return false
  return true
}

// ===== Inline delete confirmation =====
const deletingKey = ref(null)

function dKey(type, group = null, cat = null, sub = null) {
  return [type, group, cat, sub].join('|||')
}

function requestDelete(type, group = null, cat = null, sub = null) {
  deletingKey.value = dKey(type, group, cat, sub)
  cancelEdit()
}

function isDeleting(type, group = null, cat = null, sub = null) {
  return deletingKey.value === dKey(type, group, cat, sub)
}

function cancelDelete() { deletingKey.value = null }

function confirmDelete() {
  const k = deletingKey.value
  if (!k) return
  const [type, g, c, s] = k.split('|||').map(v => v === 'null' ? null : v)
  if (type === 'group') {
    if (selectedGroup.value === g) selectedGroup.value = null
    deleteGroup(g)
    success(`Grupo "${g}" excluído.`)
  } else if (type === 'category') {
    if (selectedCategory.value === c) selectedCategory.value = null
    deleteCategory(g, c)
    success(`Categoria "${c}" excluída.`)
  } else if (type === 'subcategory') {
    if (selectedSubcategory.value === s) selectedSubcategory.value = null
    deleteSubcategory(g, c, s)
    success(`Subcategoria "${s}" excluída.`)
  }
  deletingKey.value = null
}

// ===== Move hierarchy =====
const moving = ref(null)
const moveTargetGroup = ref('')
const moveTargetCategory = ref('')
const moveTargetSubcategory = ref('')

const moveTargetCategories = computed(() =>
  moveTargetGroup.value ? getCategoriesForGroup(moveTargetGroup.value) : []
)

const moveTargetSubcategories = computed(() =>
  moveTargetGroup.value && moveTargetCategory.value
    ? getSubcategoriesForCategory(moveTargetGroup.value, moveTargetCategory.value)
    : []
)

watch(moveTargetGroup, (group) => {
  if (!moving.value) return
  const categories = group ? getCategoriesForGroup(group) : []
  if (moving.value.type === 'subcategory' && !categories.includes(moveTargetCategory.value)) {
    moveTargetCategory.value = categories[0] || ''
  } else if (moving.value.type === 'item' && moveTargetCategory.value && !categories.includes(moveTargetCategory.value)) {
    moveTargetCategory.value = ''
  }
  moveTargetSubcategory.value = ''
})

watch(moveTargetCategory, (category) => {
  if (!moving.value || moving.value.type !== 'item') return
  const subcategories = moveTargetGroup.value && category
    ? getSubcategoriesForCategory(moveTargetGroup.value, category)
    : []
  if (moveTargetSubcategory.value && !subcategories.includes(moveTargetSubcategory.value)) {
    moveTargetSubcategory.value = ''
  }
})

function startMoveCategory(group, category) {
  moving.value = { type: 'category', group, category }
  moveTargetGroup.value = group
  moveTargetCategory.value = ''
  moveTargetSubcategory.value = ''
  cancelEdit()
  cancelDelete()
}

function startMoveSubcategory(group, category, subcategory) {
  moving.value = { type: 'subcategory', group, category, subcategory }
  moveTargetGroup.value = group
  moveTargetCategory.value = category
  moveTargetSubcategory.value = ''
  cancelEdit()
  cancelDelete()
}

function startMoveItem(item) {
  moving.value = { type: 'item', item }
  moveTargetGroup.value = item.group || ''
  moveTargetCategory.value = item.category || ''
  moveTargetSubcategory.value = item.subcategory || ''
  cancelEdit()
  cancelDelete()
}

function cancelMove() {
  moving.value = null
  moveTargetGroup.value = ''
  moveTargetCategory.value = ''
  moveTargetSubcategory.value = ''
}

async function saveMove() {
  const move = moving.value
  if (!move) return
  const targetGroup = moveTargetGroup.value
  const targetCategory = moveTargetCategory.value
  const targetSubcategory = moveTargetSubcategory.value
  if (!targetGroup) {
    error('Escolha um grupo de destino.')
    return
  }
  try {
    if (move.type === 'category') {
      if (move.group === targetGroup) { cancelMove(); return }
      await moveCategory(move.group, move.category, targetGroup)
      selectedGroup.value = targetGroup
      await nextTick()
      selectedCategory.value = move.category
      success(`Categoria "${move.category}" movida.`)
    } else if (move.type === 'subcategory') {
      if (!targetCategory) {
        error('Escolha uma categoria de destino.')
        return
      }
      if (move.group === targetGroup && move.category === targetCategory) { cancelMove(); return }
      await moveSubcategory(move.group, move.category, move.subcategory, targetGroup, targetCategory)
      selectedGroup.value = targetGroup
      await nextTick()
      selectedCategory.value = targetCategory
      selectedSubcategory.value = move.subcategory
      success(`Subcategoria "${move.subcategory}" movida.`)
    } else if (move.type === 'item') {
      if (targetSubcategory && !targetCategory) {
        error('Escolha uma categoria antes da subcategoria.')
        return
      }
      const result = await moveItem(
        move.item.id,
        targetGroup,
        targetCategory || null,
        targetSubcategory || null
      )
      if (!result?.ok) {
        error(result?.error || 'NÃ£o foi possÃ­vel mover o item.')
        return
      }
      selectedGroup.value = targetGroup
      await nextTick()
      selectedCategory.value = targetCategory || null
      await nextTick()
      selectedSubcategory.value = targetSubcategory || null
      success(`Item "${move.item.name}" movido.`)
    }
    cancelMove()
  } catch (err) {
    error(err?.message || 'NÃ£o foi possÃ­vel mover.')
  }
}

// ===== Attribute editing =====
const editingAttr = ref(null)
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

function onRemoveAttr(itemId, attrName) {
  removeAttribute(itemId, attrName)
  success(`Atributo "${attrName}" removido.`)
}

// ===== Item unit editing =====
const editingUnitItemId = ref(null)
const editUnitValue = ref('')

function startEditUnit(item) {
  editingUnitItemId.value = item.id
  editUnitValue.value = item.unit || 'UN'
}

function saveEditUnit(itemId) {
  editItem(itemId, { unit: editUnitValue.value })
  editingUnitItemId.value = null
  editUnitValue.value = ''
}

function cancelEditUnit() {
  editingUnitItemId.value = null
  editUnitValue.value = ''
}

// ===== Item minStock editing =====
const editingMinStockItemId = ref(null)
const editMinStockValue = ref(0)

function startEditMinStock(item) {
  editingMinStockItemId.value = item.id
  editMinStockValue.value = item.minStock ?? 0
}

function saveEditMinStock(itemId) {
  editItem(itemId, { minStock: Number(editMinStockValue.value) || 0 })
  editingMinStockItemId.value = null
}

function cancelEditMinStock() {
  editingMinStockItemId.value = null
}

// ===== Item location editing =====
const editingLocationItemId = ref(null)
const editLocationValue = ref('')

function startEditLocation(item) {
  editingLocationItemId.value = item.id
  editLocationValue.value = item.location || ''
}

function saveEditLocation(itemId) {
  editItem(itemId, { location: editLocationValue.value.trim() })
  editingLocationItemId.value = null
  editLocationValue.value = ''
}

function cancelEditLocation() {
  editingLocationItemId.value = null
  editLocationValue.value = ''
}

function onLocationChange(itemId) {
  saveEditLocation(itemId)
}

function onEditLocationKeydown(e, itemId) {
  if (e.key === 'Enter') saveEditLocation(itemId)
  else if (e.key === 'Escape') cancelEditLocation()
}

function isEditingAttr(itemId, attrName) {
  return editingAttr.value?.itemId === itemId && editingAttr.value?.oldName === attrName
}

// ===== Inline add item =====
const categoryDirectKey = '__category_direct__'
const addingItemForSub = ref(null)
const newItemName = ref('')
const newItemAttrs = ref([])
const newItemAttrInput = ref('')

function normName(value) {
  return String(value || '').trim().toLowerCase()
}

function isCategoryModelItem(item) {
  return Boolean(item?.category && !item?.subcategory && normName(item.name) === normName(item.category) && !getVariationsForItem(item.id).length)
}

function isSubcategoryModelItem(item) {
  return Boolean(item?.subcategory && normName(item.name) === normName(item.subcategory) && !getVariationsForItem(item.id).length)
}

const categoryDirectItems = computed(() =>
  selectedGroup.value && selectedCategory.value
    ? items.value.filter(i =>
        i.group === selectedGroup.value &&
        i.category === selectedCategory.value &&
        !i.subcategory &&
        !isCategoryModelItem(i)
      )
    : []
)

function getCategoryModelAttrs(group = selectedGroup.value, category = selectedCategory.value) {
  const model = items.value.find(i => i.group === group && i.category === category && !i.subcategory && isCategoryModelItem(i))
  return [...(model?.attributes || [])]
}

function getSubcategoryModelAttrs(group, category, subcategory) {
  const model = getItemsForSubcategory(group, category, subcategory).find(isSubcategoryModelItem)
  return [...(model?.attributes || [])]
}

function getVisibleItemsForSubcategory(group, category, subcategory) {
  return getItemsForSubcategory(group, category, subcategory).filter(item => !isSubcategoryModelItem(item))
}

function countVisibleItemsInSubcategory(group, category, subcategory) {
  return getVisibleItemsForSubcategory(group, category, subcategory).length
}

function inheritedItemAttrs(sub) {
  const targetSub = sub === categoryDirectKey ? null : sub
  if (targetSub) {
    const subModelAttrs = getSubcategoryModelAttrs(selectedGroup.value, selectedCategory.value, targetSub)
    if (subModelAttrs.length) return subModelAttrs
  }
  return getCategoryModelAttrs()
}

function startAddItem(sub) {
  addingItemForSub.value = sub
  newItemName.value = ''
  newItemAttrs.value = inheritedItemAttrs(sub)
  newItemAttrInput.value = ''
  cancelEdit()
  cancelDelete()
}

function cancelAddItem() {
  addingItemForSub.value = null
}

function addNewItemAttr() {
  const val = newItemAttrInput.value.trim()
  if (!val) return
  if (!newItemAttrs.value.includes(val)) newItemAttrs.value.push(val)
  newItemAttrInput.value = ''
}

function onNewItemAttrKeydown(e) {
  if (e.key === 'Enter') { e.preventDefault(); addNewItemAttr() }
  else if (e.key === 'Backspace' && newItemAttrInput.value === '' && newItemAttrs.value.length > 0) {
    newItemAttrs.value.pop()
  }
}

async function saveAddItem(sub) {
  if (!selectedGroup.value) return
  const targetSub = sub === categoryDirectKey ? null : sub
  // Inherit unit from existing items in the category, minStock from the subcategory
  const catItems = items.value.filter(i => i.group === selectedGroup.value && i.category === selectedCategory.value)
  const subItems = targetSub ? getItemsForSubcategory(selectedGroup.value, selectedCategory.value, targetSub) : categoryDirectItems.value
  const inheritedUnit = catItems[0]?.unit || 'UN'
  const inheritedMinStock = subItems[0]?.minStock ?? 0
  const result = await addItem({
    group: selectedGroup.value,
    category: selectedCategory.value || null,
    subcategory: targetSub || null,
    name: newItemName.value.trim() || null,
    unit: inheritedUnit,
    minStock: inheritedMinStock,
    attributes: [...newItemAttrs.value]
  })
  if (!result.ok) { error(result.error); return }
  success(targetSub ? `Item adicionado em "${targetSub}".` : `Item adicionado em "${selectedCategory.value}".`)
  cancelAddItem()
}

function onNewItemKeydown(e) {
  if (e.key === 'Enter') saveAddItem(addingItemForSub.value)
  else if (e.key === 'Escape') cancelAddItem()
}

// ===== Variation management =====
const expandedItemId = ref(null)

function toggleItemExpand(itemId) {
  if (expandedItemId.value === itemId) {
    expandedItemId.value = null
    cancelAddVariation()
    cancelEditVariation()
  } else {
    expandedItemId.value = itemId
    cancelAddVariation()
    cancelEditVariation()
  }
}

const addingVariationForItemId = ref(null)
const newVariationValues = ref({})
const newVariationStock = ref(0)

function startAddVariation(item) {
  addingVariationForItemId.value = item.id
  newVariationValues.value = Object.fromEntries((item.attributes || []).map(a => [a, '']))
  newVariationStock.value = 0
}

function cancelAddVariation() {
  addingVariationForItemId.value = null
  newVariationValues.value = {}
  newVariationStock.value = 0
}

async function saveAddVariation(item) {
  const result = await addVariation(item.id, { ...newVariationValues.value }, newVariationStock.value)
  if (!result.ok) { error(result.error || 'Variação duplicada.'); return }
  success('Variação adicionada.')
  cancelAddVariation()
}

const editingVariationId = ref(null)
const editingVariationValues = ref({})
const editingVariationStock = ref(0)

function startEditVariation(variation) {
  editingVariationId.value = variation.id
  editingVariationValues.value = { ...variation.values }
  editingVariationStock.value = variation.stock
  cancelAddVariation()
}

function cancelEditVariation() {
  editingVariationId.value = null
  editingVariationValues.value = {}
  editingVariationStock.value = 0
}

async function saveEditVariation() {
  const result = await editVariation(editingVariationId.value, {
    values: { ...editingVariationValues.value },
    stock: editingVariationStock.value
  })
  if (!result.ok) { error(result.error || 'Erro ao salvar.'); return }
  success('Variação atualizada.')
  cancelEditVariation()
}

function onDeleteVariation(id) {
  deleteVariation(id)
  success('Variação removida.')
}

// ===== Computed helpers =====
const groupCategories = computed(() =>
  selectedGroup.value ? getCategoriesForGroup(selectedGroup.value) : []
)

const filteredCategoryList = computed(() => {
  const q = searchQ.value
  if (!q || !selectedGroup.value) return groupCategories.value
  return groupCategories.value.filter(c => {
    if (c.toLowerCase().includes(q)) return true
    const subs = getSubcategoriesForCategory(selectedGroup.value, c)
    return subs.some(s => s.toLowerCase().includes(q))
  })
})

const categorySubcategories = computed(() =>
  selectedGroup.value && selectedCategory.value
    ? getSubcategoriesForCategory(selectedGroup.value, selectedCategory.value)
    : []
)

const filteredSubcategoryList = computed(() => {
  const q = searchQ.value
  if (!q) return categorySubcategories.value
  return categorySubcategories.value.filter(s => s.toLowerCase().includes(q))
})

// ===== Create group =====
const addingGroup = ref(false)
const newGroupName = ref('')

function startAddGroup() {
  addingGroup.value = true
  newGroupName.value = ''
  cancelEdit()
  cancelDelete()
}
function cancelAddGroup() {
  addingGroup.value = false
  newGroupName.value = ''
}
async function saveAddGroup() {
  const name = newGroupName.value.trim()
  if (!name) { cancelAddGroup(); return }
  if (uniqueGroups.value.includes(name)) { error(`Grupo "${name}" já existe.`); return }
  const result = await addItem({ group: name })
  if (!result.ok) { error(result.error); return }
  selectedGroup.value = name
  success(`Grupo "${name}" criado.`)
  cancelAddGroup()
}
function onAddGroupKeydown(e) {
  if (e.key === 'Enter') saveAddGroup()
  else if (e.key === 'Escape') cancelAddGroup()
}

// ===== Create category =====
const addingCategory = ref(false)
const newCategoryName = ref('')
const newCategoryAttrs = ref([])
const newCategoryAttrInput = ref('')

function startAddCategory() {
  addingCategory.value = true
  newCategoryName.value = ''
  newCategoryAttrs.value = []
  newCategoryAttrInput.value = ''
  cancelEdit()
  cancelDelete()
}
function cancelAddCategory() {
  addingCategory.value = false
  newCategoryName.value = ''
  newCategoryAttrs.value = []
  newCategoryAttrInput.value = ''
}
function addNewCategoryAttr() {
  const val = newCategoryAttrInput.value.trim()
  if (!val) return
  if (!newCategoryAttrs.value.includes(val)) newCategoryAttrs.value.push(val)
  newCategoryAttrInput.value = ''
}
function onNewCategoryAttrKeydown(e) {
  if (e.key === 'Enter') { e.preventDefault(); addNewCategoryAttr() }
  else if (e.key === 'Backspace' && newCategoryAttrInput.value === '' && newCategoryAttrs.value.length > 0) {
    newCategoryAttrs.value.pop()
  }
}
async function saveAddCategory() {
  const name = newCategoryName.value.trim()
  if (!name) { cancelAddCategory(); return }
  const existing = getCategoriesForGroup(selectedGroup.value)
  if (existing.includes(name)) { error(`Categoria "${name}" já existe.`); return }
  const result = await addItem({ group: selectedGroup.value, category: name, attributes: [...newCategoryAttrs.value] })
  if (!result.ok) { error(result.error); return }
  success(`Categoria "${name}" criada.`)
  cancelAddCategory()
}
function onAddCategoryKeydown(e) {
  if (e.key === 'Enter') saveAddCategory()
  else if (e.key === 'Escape') cancelAddCategory()
}

// ===== Create subcategory =====
const addingSubcategory = ref(false)
const newSubcategoryName = ref('')
const newSubcategoryUnit = ref('UN')
const newSubcategoryAttrs = ref([])
const newSubcategoryAttrInput = ref('')

function startAddSubcategory() {
  addingSubcategory.value = true
  newSubcategoryName.value = ''
  newSubcategoryUnit.value = 'UN'
  newSubcategoryAttrs.value = getCategoryModelAttrs()
  newSubcategoryAttrInput.value = ''
  cancelEdit()
  cancelDelete()
}
function cancelAddSubcategory() {
  addingSubcategory.value = false
  newSubcategoryName.value = ''
  newSubcategoryUnit.value = 'UN'
  newSubcategoryAttrs.value = []
  newSubcategoryAttrInput.value = ''
}
function addNewSubcategoryAttr() {
  const val = newSubcategoryAttrInput.value.trim()
  if (!val) return
  if (!newSubcategoryAttrs.value.includes(val)) newSubcategoryAttrs.value.push(val)
  newSubcategoryAttrInput.value = ''
}
function onNewSubcategoryAttrKeydown(e) {
  if (e.key === 'Enter') { e.preventDefault(); addNewSubcategoryAttr() }
  else if (e.key === 'Backspace' && newSubcategoryAttrInput.value === '' && newSubcategoryAttrs.value.length > 0) {
    newSubcategoryAttrs.value.pop()
  }
}
async function saveAddSubcategory() {
  const name = newSubcategoryName.value.trim()
  if (!name) { cancelAddSubcategory(); return }
  const existing = getSubcategoriesForCategory(selectedGroup.value, selectedCategory.value)
  if (existing.includes(name)) { error(`Subcategoria "${name}" já existe.`); return }
  const result = await addItem({
    group: selectedGroup.value,
    category: selectedCategory.value,
    subcategory: name,
    unit: newSubcategoryUnit.value,
    attributes: [...newSubcategoryAttrs.value],
  })
  if (!result.ok) { error(result.error); return }
  success(`Subcategoria "${name}" criada.`)
  cancelAddSubcategory()
}
function onAddSubcategoryKeydown(e) {
  if (e.key === 'Enter') saveAddSubcategory()
  else if (e.key === 'Escape') cancelAddSubcategory()
}

// ===== Drag and drop reorder =====
const dragCtx = ref(null)   // { type, from }
const dragToIdx = ref(null)

function onDragStart(type, from, e) {
  dragCtx.value = { type, from }
  dragToIdx.value = null
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', '')
}

function onDragOver(type, to, e) {
  if (dragCtx.value?.type !== type) return
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  dragToIdx.value = to
}

function onDrop(type, to, e) {
  e.preventDefault()
  const from = dragCtx.value?.from
  if (dragCtx.value?.type !== type || from == null || from === to) { onDragEnd(); return }
  if (type === 'group') reorderGroups(from, to)
  else if (type === 'category') reorderCategories(selectedGroup.value, from, to)
  else if (type === 'subcategory') reorderSubcategories(selectedGroup.value, selectedCategory.value, from, to)
  else if (type.startsWith('attr:')) reorderItemAttributes(type.slice(5), from, to)
  onDragEnd()
}

function onDragEnd() {
  dragCtx.value = null
  dragToIdx.value = null
}

function isDraggingType(type) { return dragCtx.value?.type === type }
function isDragFrom(type, idx) { return dragCtx.value?.type === type && dragCtx.value.from === idx }
function isDragTarget(type, idx) { return dragCtx.value?.type === type && dragToIdx.value === idx && dragCtx.value.from !== idx }
  return {
    units,
    activeLocais,
    groupedLocais,
    uniqueGroups,
    getCategoriesForGroup,
    getSubcategoriesForCategory,
    countItemsInGroup,
    countItemsInCategory,
    countItemsInSubcategory,
    getItemsForSubcategory,
    getVariationsForItem,
    getItemExtraKeys,
    selectedGroup,
    selectedCategory,
    selectedSubcategory,
    groupSearch,
    filteredGroupList,
    editing,
    editValue,
    startEdit,
    cancelEdit,
    saveEdit,
    onEditKeydown,
    isEditing,
    requestDelete,
    isDeleting,
    cancelDelete,
    confirmDelete,
    moving,
    moveTargetGroup,
    moveTargetCategory,
    moveTargetSubcategory,
    moveTargetCategories,
    moveTargetSubcategories,
    startMoveCategory,
    startMoveSubcategory,
    startMoveItem,
    cancelMove,
    saveMove,
    editingAttr,
    editAttrValue,
    addingAttrItemId,
    newAttrName,
    startAttrEdit,
    saveAttrEdit,
    cancelAttrEdit,
    onAttrEditKeydown,
    startAddAttr,
    saveNewAttr,
    cancelAddAttr,
    onNewAttrKeydown,
    onRemoveAttr,
    editingUnitItemId,
    editUnitValue,
    startEditUnit,
    saveEditUnit,
    cancelEditUnit,
    editingMinStockItemId,
    editMinStockValue,
    startEditMinStock,
    saveEditMinStock,
    cancelEditMinStock,
    editingLocationItemId,
    editLocationValue,
    startEditLocation,
    saveEditLocation,
    cancelEditLocation,
    onLocationChange,
    onEditLocationKeydown,
    isEditingAttr,
    categoryDirectItems,
    getCategoryModelAttrs,
    getSubcategoryModelAttrs,
    getVisibleItemsForSubcategory,
    countVisibleItemsInSubcategory,
    categoryDirectKey,
    addingItemForSub,
    newItemName,
    newItemAttrs,
    newItemAttrInput,
    startAddItem,
    cancelAddItem,
    addNewItemAttr,
    onNewItemAttrKeydown,
    saveAddItem,
    onNewItemKeydown,
    expandedItemId,
    toggleItemExpand,
    addingVariationForItemId,
    newVariationValues,
    newVariationStock,
    startAddVariation,
    cancelAddVariation,
    saveAddVariation,
    editingVariationId,
    editingVariationValues,
    editingVariationStock,
    startEditVariation,
    cancelEditVariation,
    saveEditVariation,
    onDeleteVariation,
    groupCategories,
    filteredCategoryList,
    categorySubcategories,
    filteredSubcategoryList,
    addingGroup,
    newGroupName,
    startAddGroup,
    cancelAddGroup,
    saveAddGroup,
    onAddGroupKeydown,
    addingCategory,
    newCategoryName,
    newCategoryAttrs,
    newCategoryAttrInput,
    addNewCategoryAttr,
    onNewCategoryAttrKeydown,
    startAddCategory,
    cancelAddCategory,
    saveAddCategory,
    onAddCategoryKeydown,
    addingSubcategory,
    newSubcategoryName,
    newSubcategoryUnit,
    newSubcategoryAttrs,
    newSubcategoryAttrInput,
    addNewSubcategoryAttr,
    onNewSubcategoryAttrKeydown,
    startAddSubcategory,
    cancelAddSubcategory,
    saveAddSubcategory,
    onAddSubcategoryKeydown,
    dragCtx,
    dragToIdx,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
    isDraggingType,
    isDragFrom,
    isDragTarget,
  }
}
