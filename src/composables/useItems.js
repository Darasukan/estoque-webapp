import { ref, computed, watch } from 'vue'
import { loadItems, saveItems, resetItems, loadVariations, saveVariations, resetVariations } from '../services/storageService.js'
import { generateId } from '../utils/id.js'

// Shared state (singleton)
const items = ref(loadItems())
const variations = ref(loadVariations())
const activeGroup = ref(null)
const activeFilters = ref({})

// Auto-save
watch(items, (val) => saveItems(val), { deep: true })
watch(variations, (val) => saveVariations(val), { deep: true })

// ===== Faceted filter helpers (pure functions) =====
function _splitFilters(filters) {
  const h = {}, a = {}
  for (const [k, v] of Object.entries(filters)) {
    if (k.startsWith('attr:')) a[k] = v; else h[k] = v
  }
  return { hierarchy: h, attrs: a }
}

function _itemMatchesH(item, hF) {
  if (hF.category?.length && !hF.category.includes(item.category || '')) return false
  if (hF.subcategory?.length && !hF.subcategory.includes(item.subcategory || '')) return false
  if (hF.name?.length && !hF.name.includes(item.name)) return false
  if (hF.unit?.length && !hF.unit.includes(item.unit)) return false
  return true
}

function _varMatchesA(v, aF) {
  for (const [k, vals] of Object.entries(aF)) {
    if (!vals.includes(v.values?.[k.slice(5)] || '')) return false
  }
  return true
}

export function useItems() {

  // ===== CRUD =====
  function addItem(data) {
    const resolvedName = data.name || data.subcategory || data.category || data.group
    items.value.push({
      id: generateId('item'),
      name: resolvedName,
      group: data.group,
      category: data.category || null,
      subcategory: data.subcategory || null,
      unit: data.unit || 'UN',
      minStock: data.minStock ?? 0,
      attributes: data.attributes || []
    })
  }

  function editItem(id, changes) {
    const item = items.value.find(i => i.id === id)
    if (item) Object.assign(item, changes)
  }

  function deleteItem(id) {
    items.value = items.value.filter(i => i.id !== id)
    // Also delete all variations for this item
    variations.value = variations.value.filter(v => v.itemId !== id)
  }

  // ===== Variations CRUD =====
  function getVariationsForItem(itemId) {
    return variations.value.filter(v => v.itemId === itemId)
  }

  function addVariation(itemId, values = {}, stock = 0) {
    const v = {
      id: generateId('var'),
      itemId,
      values: { ...values },
      stock: Number(stock) || 0
    }
    variations.value.push(v)
    return v
  }

  function editVariation(id, changes) {
    const v = variations.value.find(v => v.id === id)
    if (v) {
      if (changes.values !== undefined) v.values = { ...changes.values }
      if (changes.stock !== undefined) v.stock = Number(changes.stock) || 0
    }
  }

  function deleteVariation(id) {
    variations.value = variations.value.filter(v => v.id !== id)
  }

  function getTotalStock(itemId) {
    return variations.value
      .filter(v => v.itemId === itemId)
      .reduce((sum, v) => sum + v.stock, 0)
  }

  // ===== Seed (mass data) =====
  function seedDatabase(seedItems, seedVars) {
    items.value = seedItems
    variations.value = seedVars
    activeGroup.value = null
    activeFilters.value = {}
  }

  // ===== Computed: unique hierarchy values =====
  const uniqueGroups = computed(() => {
    const set = new Set(items.value.map(i => i.group))
    return [...set].sort()
  })

  const uniqueCategories = computed(() => {
    const map = new Map()
    for (const item of items.value) {
      if (item.category) {
        const key = item.group
        if (!map.has(key)) map.set(key, new Set())
        map.get(key).add(item.category)
      }
    }
    // Return { group: [categories] }
    const result = {}
    for (const [group, cats] of map) {
      result[group] = [...cats].sort()
    }
    return result
  })

  const uniqueSubcategories = computed(() => {
    const map = new Map()
    for (const item of items.value) {
      if (item.subcategory && item.category) {
        const key = `${item.group}|||${item.category}`
        if (!map.has(key)) map.set(key, new Set())
        map.get(key).add(item.subcategory)
      }
    }
    const result = {}
    for (const [key, subs] of map) {
      result[key] = [...subs].sort()
    }
    return result
  })

  function getCategoriesForGroup(group) {
    return uniqueCategories.value[group] || []
  }

  function getSubcategoriesForCategory(group, category) {
    return uniqueSubcategories.value[`${group}|||${category}`] || []
  }

  // ===== Computed: catalog tree (for display) =====
  const catalogTree = computed(() => {
    const tree = new Map()

    for (const item of items.value) {
      // Group level
      if (!tree.has(item.group)) {
        tree.set(item.group, { name: item.group, categories: new Map(), items: [] })
      }
      const group = tree.get(item.group)

      if (!item.category) {
        group.items.push(item)
        continue
      }

      // Category level
      if (!group.categories.has(item.category)) {
        group.categories.set(item.category, { name: item.category, subcategories: new Map(), items: [] })
      }
      const cat = group.categories.get(item.category)

      if (!item.subcategory) {
        cat.items.push(item)
        continue
      }

      // Subcategory level
      if (!cat.subcategories.has(item.subcategory)) {
        cat.subcategories.set(item.subcategory, { name: item.subcategory, items: [] })
      }
      cat.subcategories.get(item.subcategory).items.push(item)
    }

    // Convert Maps to arrays
    const result = []
    for (const [, group] of tree) {
      const g = {
        name: group.name,
        items: group.items,
        categories: []
      }
      for (const [, cat] of group.categories) {
        const c = {
          name: cat.name,
          items: cat.items,
          subcategories: []
        }
        for (const [, sub] of cat.subcategories) {
          c.subcategories.push({ name: sub.name, items: sub.items })
        }
        g.categories.push(c)
      }
      result.push(g)
    }
    return result
  })

  // ===== Filtered tree for sidebar =====
  const visibleTree = computed(() => {
    if (!activeGroup.value) return catalogTree.value
    return catalogTree.value.filter(g => g.name === activeGroup.value)
  })

  // ===== Sidebar navigation =====
  function setActiveGroup(group) {
    activeGroup.value = activeGroup.value === group ? null : group
    activeFilters.value = {}
  }

  // ===== Bulk: rename group/category/subcategory across items =====
  function renameGroup(oldName, newName) {
    for (const item of items.value) {
      if (item.group === oldName) item.group = newName
    }
  }

  function renameCategory(group, oldName, newName) {
    for (const item of items.value) {
      if (item.group === group && item.category === oldName) item.category = newName
    }
  }

  function renameSubcategory(group, category, oldName, newName) {
    for (const item of items.value) {
      if (item.group === group && item.category === category && item.subcategory === oldName) {
        item.subcategory = newName
      }
    }
  }

  // ===== Bulk delete hierarchy =====
  function deleteGroup(groupName) {
    const ids = items.value.filter(i => i.group === groupName).map(i => i.id)
    items.value = items.value.filter(i => i.group !== groupName)
    variations.value = variations.value.filter(v => !ids.includes(v.itemId))
  }

  function deleteCategory(group, categoryName) {
    const ids = items.value.filter(i => i.group === group && i.category === categoryName).map(i => i.id)
    items.value = items.value.filter(i => !(i.group === group && i.category === categoryName))
    variations.value = variations.value.filter(v => !ids.includes(v.itemId))
  }

  function deleteSubcategory(group, category, subcategoryName) {
    const ids = items.value.filter(i => i.group === group && i.category === category && i.subcategory === subcategoryName).map(i => i.id)
    items.value = items.value.filter(i => !(i.group === group && i.category === category && i.subcategory === subcategoryName))
    variations.value = variations.value.filter(v => !ids.includes(v.itemId))
  }

  function countItemsInGroup(group) {
    return items.value.filter(i => i.group === group).length
  }

  function countItemsInCategory(group, category) {
    return items.value.filter(i => i.group === group && i.category === category).length
  }

  function countItemsInSubcategory(group, category, subcategory) {
    return items.value.filter(i => i.group === group && i.category === category && i.subcategory === subcategory).length
  }

  // ===== Attribute management =====
  function getItemsForSubcategory(group, category, subcategory) {
    return items.value.filter(i => i.group === group && i.category === category && i.subcategory === subcategory)
  }

  function renameAttribute(itemId, oldName, newName) {
    const item = items.value.find(i => i.id === itemId)
    if (!item) return
    const idx = item.attributes.indexOf(oldName)
    if (idx < 0) return
    item.attributes[idx] = newName
    // Update all variations for this item
    for (const v of variations.value) {
      if (v.itemId === itemId && oldName in v.values) {
        v.values[newName] = v.values[oldName]
        delete v.values[oldName]
      }
    }
  }

  function addAttribute(itemId, attrName) {
    const item = items.value.find(i => i.id === itemId)
    if (!item) return
    if (item.attributes.includes(attrName)) return
    item.attributes.push(attrName)
  }

  function removeAttribute(itemId, attrName) {
    const item = items.value.find(i => i.id === itemId)
    if (!item) return
    item.attributes = item.attributes.filter(a => a !== attrName)
    // Clean up variation values
    for (const v of variations.value) {
      if (v.itemId === itemId && attrName in v.values) {
        delete v.values[attrName]
      }
    }
  }

  // ===== Reset =====
  function resetAll() {
    items.value = resetItems()
    variations.value = resetVariations()
    activeGroup.value = null
    activeFilters.value = {}
  }

  // ===== Faceted Filtering =====
  function toggleFilter(facetKey, value) {
    const f = { ...activeFilters.value }
    if (!f[facetKey]) {
      f[facetKey] = [value]
    } else {
      const idx = f[facetKey].indexOf(value)
      if (idx >= 0) {
        const arr = [...f[facetKey]]
        arr.splice(idx, 1)
        arr.length === 0 ? delete f[facetKey] : (f[facetKey] = arr)
      } else {
        f[facetKey] = [...f[facetKey], value]
      }
    }
    activeFilters.value = f
  }

  function clearFilters() {
    activeFilters.value = {}
  }

  const groupItems = computed(() => {
    if (!activeGroup.value) return []
    return items.value.filter(i => i.group === activeGroup.value)
  })

  const filteredResults = computed(() => {
    const all = groupItems.value
    if (!all.length) return []
    const { hierarchy, attrs } = _splitFilters(activeFilters.value)
    let r = all
    if (Object.keys(hierarchy).length) r = r.filter(i => _itemMatchesH(i, hierarchy))
    if (Object.keys(attrs).length) {
      r = r.filter(item => {
        const vs = variations.value.filter(v => v.itemId === item.id)
        return vs.some(v => _varMatchesA(v, attrs))
      })
    }
    return r
  })

  const facets = computed(() => {
    const all = groupItems.value
    if (!all.length) return []
    const { hierarchy: hF, attrs: aF } = _splitFilters(activeFilters.value)
    const out = []

    // Hierarchy facets
    for (const d of [
      { key: 'category', label: 'Categoria', get: i => i.category || '' },
      { key: 'subcategory', label: 'Subcategoria', get: i => i.subcategory || '' },
      { key: 'name', label: 'Item', get: i => {
        // Only expose name as a facet value when it differs from the last hierarchy level
        const lastLevel = i.subcategory || i.category || i.group
        return i.name !== lastLevel ? i.name : ''
      }},
      { key: 'unit', label: 'Unidade', get: i => i.unit }
    ]) {
      const oH = { ...hF }; delete oH[d.key]
      let c = all
      if (Object.keys(oH).length) c = c.filter(i => _itemMatchesH(i, oH))
      if (Object.keys(aF).length) {
        c = c.filter(item => {
          const vs = variations.value.filter(v => v.itemId === item.id)
          return vs.some(v => _varMatchesA(v, aF))
        })
      }
      const counts = {}
      for (const item of c) { const val = d.get(item); if (val) counts[val] = (counts[val] || 0) + 1 }
      const opts = Object.entries(counts).map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value))
      if (opts.length >= 2 || hF[d.key]?.length) {
        out.push({ key: d.key, label: d.label, options: opts, selected: hF[d.key] || [] })
      }
    }

    // Attribute facets
    const attrSet = new Set()
    for (const item of all) for (const a of item.attributes || []) attrSet.add(a)
    for (const an of [...attrSet].sort()) {
      const fk = `attr:${an}`
      let c = all
      if (Object.keys(hF).length) c = c.filter(i => _itemMatchesH(i, hF))
      const oA = { ...aF }; delete oA[fk]
      const counts = {}
      for (const item of c) {
        if (!item.attributes?.includes(an)) continue
        for (const v of variations.value.filter(v => v.itemId === item.id)) {
          if (Object.keys(oA).length && !_varMatchesA(v, oA)) continue
          const val = v.values?.[an] || ''
          if (val) counts[val] = (counts[val] || 0) + 1
        }
      }
      const opts = Object.entries(counts).map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value))
      if (opts.length >= 2 || aF[fk]?.length) {
        out.push({ key: fk, label: an, options: opts, selected: aF[fk] || [] })
      }
    }

    return out
  })

  const hasActiveFilters = computed(() => Object.keys(activeFilters.value).length > 0)

  return {
    items,
    variations,
    activeGroup,
    // CRUD
    addItem, editItem, deleteItem,
    // Variations
    getVariationsForItem, addVariation, editVariation, deleteVariation, getTotalStock,
    // Hierarchy lookups
    uniqueGroups, getCategoriesForGroup, getSubcategoriesForCategory,
    // Catalog tree
    catalogTree, visibleTree,
    // Bulk rename
    renameGroup, renameCategory, renameSubcategory,
    // Bulk delete hierarchy
    deleteGroup, deleteCategory, deleteSubcategory,
    countItemsInGroup, countItemsInCategory, countItemsInSubcategory,
    // Attribute management
    getItemsForSubcategory, renameAttribute, addAttribute, removeAttribute,
    // Navigation
    setActiveGroup,
    // Faceted filtering
    groupItems, filteredResults, facets, hasActiveFilters,
    toggleFilter, clearFilters,
    resetAll,
    // Dev / seed
    seedDatabase
  }
}
