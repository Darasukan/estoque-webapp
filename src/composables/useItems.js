import { ref, computed } from 'vue'
import * as api from '../services/api.js'

/**
 * Returns the stock alert status for a single variation.
 * 'zero'     — qty is 0
 * 'critical' — qty <= minStock (requires minStock > 0)
 * 'alert'    — qty <= minStock * 2 (requires minStock > 0)
 * 'ok'       — no issue
 */
export function stockAlertStatus(variation, item) {
  const min = variation.minStock ?? 0
  if (variation.stock <= 0) return 'zero'
  if (min > 0 && variation.stock <= min) return 'critical'
  if (min > 0 && variation.stock <= min * 2) return 'alert'
  return 'ok'
}

// Shared state (singleton)
const items = ref([])
const variations = ref([])
const orderData = ref({})
const activeGroup = ref(null)
const activeCategory = ref(null)
const activeSubcategory = ref(null)
const activeFilters = ref({})
const viewingItemId = ref(null) // item currently open in detail view
const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })

function compareText(a, b) {
  return collator.compare(String(a || ''), String(b || ''))
}

function variationSortText(variation) {
  const values = Object.entries(variation.values || {}).map(([key, value]) => `${key}: ${value}`)
  const extras = Object.entries(variation.extras || {}).map(([key, value]) => `${key}: ${value}`)
  return [...values, ...extras].filter(Boolean).join(' ')
}

function normalizeDuplicateText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(d[aeo]s?|de|para|por|com|em|a|o|as|os)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')
}

function itemDuplicateName(item) {
  return item.name || item.subcategory || item.category || item.group
}

function sortItems(list) {
  return [...list].sort((a, b) =>
    compareText(a.group, b.group) ||
    compareText(a.category, b.category) ||
    compareText(a.subcategory, b.subcategory) ||
    compareText(a.name, b.name) ||
    String(a.id || '').localeCompare(String(b.id || ''))
  )
}

function sortVariations(list) {
  return [...list].sort((a, b) =>
    compareText(variationSortText(a), variationSortText(b)) ||
    String(a.id || '').localeCompare(String(b.id || ''))
  )
}

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

// ===== Validation helpers =====

/**
 * Sanitizes a numeric value:
 * - Converts strings to numbers
 * - Returns 0 for NaN, Infinity, or text
 * - Clamps to minimum (default 0, so negatives become 0)
 */
function _sanitizeNumber(val, min = 0) {
  const n = Number(val)
  if (!isFinite(n) || isNaN(n)) return min
  return Math.max(min, Math.round(n))
}

/**
 * Checks if a variation with the exact same attribute values already exists
 * for the given item. Optionally excludes one variation id (for edits).
 */
function _hasDuplicateVariation(itemId, values, excludeId = null) {
  return variations.value.some(v => {
    if (v.itemId !== itemId) return false
    if (v.id === excludeId) return false
    const keys = Object.keys(values)
    if (keys.length !== Object.keys(v.values || {}).length) return false
    return keys.every(k => normalizeDuplicateText(v.values[k]) === normalizeDuplicateText(values[k]))
  })
}

function _findDuplicateItem(data, excludeId = null) {
  const group = normalizeDuplicateText(data.group)
  const category = normalizeDuplicateText(data.category)
  const subcategory = normalizeDuplicateText(data.subcategory)
  const name = normalizeDuplicateText(data.name || data.subcategory || data.category || data.group)
  if (!group || !name) return null

  return items.value.find(item => {
    if (item.id === excludeId) return false
    return normalizeDuplicateText(item.group) === group &&
      normalizeDuplicateText(item.category) === category &&
      normalizeDuplicateText(item.subcategory) === subcategory &&
      normalizeDuplicateText(itemDuplicateName(item)) === name
  }) || null
}

export function useItems() {

  // ===== Load from API =====
  async function loadData() {
    const [itemsRes, varsRes, orderRes] = await Promise.allSettled([
      api.getItems(),
      api.getVariations(),
      api.getDisplayOrder()
    ])
    if (itemsRes.status === 'fulfilled') items.value = sortItems(itemsRes.value)
    if (varsRes.status === 'fulfilled') variations.value = sortVariations(varsRes.value)
    if (orderRes.status === 'fulfilled') orderData.value = orderRes.value || {}
  }

  // ===== CRUD =====
  async function addItem(data) {
    const resolvedName = data.name || data.subcategory || data.category || data.group
    const duplicate = _findDuplicateItem({ ...data, name: resolvedName })
    if (duplicate) {
      return {
        ok: false,
        error: `Já existe um item parecido neste caminho: "${itemDuplicateName(duplicate)}".`,
        duplicate,
      }
    }
    const created = await api.createItem({
      name: resolvedName,
      group: data.group,
      category: data.category || null,
      subcategory: data.subcategory || null,
      unit: data.unit || 'UN',
      minStock: _sanitizeNumber(data.minStock),
      attributes: data.attributes || [],
      location: data.location || ''
    })
    items.value.push(created)
    items.value = sortItems(items.value)
    return { ok: true, item: created }
  }

  async function editItem(id, changes) {
    const item = items.value.find(i => i.id === id)
    if (!item) return { ok: false, error: 'Item não encontrado.' }
    if (changes.minStock !== undefined) changes.minStock = _sanitizeNumber(changes.minStock)
    const merged = { ...item, ...changes }
    const duplicate = _findDuplicateItem(merged, id)
    if (duplicate) {
      return {
        ok: false,
        error: `Já existe um item parecido neste caminho: "${itemDuplicateName(duplicate)}".`,
        duplicate,
      }
    }
    await api.updateItem(id, merged)
    Object.assign(item, changes)
    items.value = sortItems(items.value)
    return { ok: true, item }
  }

  async function deleteItem(id) {
    await api.deleteItem(id)
    items.value = items.value.filter(i => i.id !== id)
    variations.value = variations.value.filter(v => v.itemId !== id)
  }

  // ===== Variations CRUD =====
  function getVariationsForItem(itemId) {
    return sortVariations(variations.value.filter(v => v.itemId === itemId))
  }

  /**
   * Returns { ok: true, variation } on success
   * Returns { ok: false, error: string } on validation failure
   */
  async function addVariation(itemId, values = {}, stock = 0, minStock = 0, extras = {}, location = '', destinations = []) {
    const sanitizedStock = _sanitizeNumber(stock)
    const sanitizedMinStock = _sanitizeNumber(minStock)
    if (_hasDuplicateVariation(itemId, values)) {
      return { ok: false, error: 'Já existe uma variação com esses mesmos atributos.' }
    }
    const created = await api.createVariation({
      itemId,
      values: { ...values },
      stock: sanitizedStock,
      minStock: sanitizedMinStock,
      initialStock: sanitizedStock,
      extras: { ...extras },
      location: location || '',
      destinations: Array.isArray(destinations) ? [...destinations] : [],
    })
    variations.value.push(created)
    variations.value = sortVariations(variations.value)
    return { ok: true, variation: created }
  }

  async function editVariation(id, changes) {
    const v = variations.value.find(v => v.id === id)
    if (!v) return { ok: false, error: 'Variação não encontrada.' }
    if (changes.values !== undefined) {
      if (_hasDuplicateVariation(v.itemId, changes.values, id)) {
        return { ok: false, error: 'Já existe uma variação com esses mesmos atributos.' }
      }
    }
    const updated = { ...v }
    if (changes.values !== undefined) updated.values = { ...changes.values }
    if (changes.stock !== undefined) updated.stock = _sanitizeNumber(changes.stock)
    if (changes.minStock !== undefined) updated.minStock = _sanitizeNumber(changes.minStock)
    if (changes.extras !== undefined) updated.extras = { ...changes.extras }
    if (changes.location !== undefined) updated.location = changes.location
    if (changes.destinations !== undefined) updated.destinations = Array.isArray(changes.destinations) ? [...changes.destinations] : []
    const result = await api.updateVariation(id, updated)
    Object.assign(v, result)
    variations.value = sortVariations(variations.value)
    return { ok: true }
  }

  async function deleteVariation(id) {
    await api.deleteVariation(id)
    variations.value = variations.value.filter(v => v.id !== id)
  }

  function getTotalStock(itemId) {
    return variations.value
      .filter(v => v.itemId === itemId)
      .reduce((sum, v) => sum + v.stock, 0)
  }

  // ===== Seed (mass data) =====
  async function seedDatabase(seedItems, seedVars, seedExtras = {}) {
    await api.seedPopulate(seedItems, seedVars, seedExtras)
    items.value = sortItems(seedItems)
    variations.value = sortVariations(seedVars)
    activeGroup.value = null
    activeFilters.value = {}
    window.dispatchEvent(new CustomEvent('app:data-invalidated'))
  }

  // ===== Computed: unique hierarchy values =====

  // Apply a stored order to a list: ordered items first, then any new ones appended
  function _applyOrder(all, stored) {
    const sortedAll = [...all].sort(compareText)
    if (!stored || !stored.length) return sortedAll
    return [
      ...stored.filter(x => sortedAll.includes(x)),
      ...sortedAll.filter(x => !stored.includes(x))
    ]
  }

  const uniqueGroups = computed(() => {
    const all = [...new Set(items.value.map(i => i.group))]
    return _applyOrder(all, orderData.value.groups)
  })

  const uniqueCategories = computed(() => {
    const map = new Map()
    for (const item of items.value) {
      if (item.category) {
        if (!map.has(item.group)) map.set(item.group, new Set())
        map.get(item.group).add(item.category)
      }
    }
    const result = {}
    for (const [group, cats] of map) {
      result[group] = _applyOrder([...cats], orderData.value.categories?.[group])
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
      result[key] = _applyOrder([...subs], orderData.value.subcategories?.[key])
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
    activeCategory.value = null
    activeSubcategory.value = null
    activeFilters.value = {}
  }

  function setActiveCategory(cat) {
    activeCategory.value = cat
    activeSubcategory.value = null
    activeFilters.value = {}
  }

  function setActiveSubcategory(sub) {
    activeSubcategory.value = sub
    activeFilters.value = {}
  }

  // ===== Bulk: rename group/category/subcategory across items =====
  async function renameGroup(oldName, newName) {
    const affected = items.value.filter(i => i.group === oldName)
    for (const item of affected) item.group = newName
    await Promise.all(affected.map(i => api.updateItem(i.id, { ...i })))
  }

  async function renameCategory(group, oldName, newName) {
    const affected = items.value.filter(i => i.group === group && i.category === oldName)
    for (const item of affected) item.category = newName
    await Promise.all(affected.map(i => api.updateItem(i.id, { ...i })))
  }

  async function renameSubcategory(group, category, oldName, newName) {
    const affected = items.value.filter(i => i.group === group && i.category === category && i.subcategory === oldName)
    for (const item of affected) item.subcategory = newName
    await Promise.all(affected.map(i => api.updateItem(i.id, { ...i })))
  }

  // ===== Bulk move hierarchy =====
  async function moveCategory(oldGroup, categoryName, newGroup) {
    const affected = items.value.filter(i => i.group === oldGroup && i.category === categoryName)
    for (const item of affected) item.group = newGroup
    await Promise.all(affected.map(i => api.updateItem(i.id, { ...i })))
    items.value = sortItems(items.value)
  }

  async function moveSubcategory(oldGroup, oldCategory, subcategoryName, newGroup, newCategory) {
    const affected = items.value.filter(i =>
      i.group === oldGroup &&
      i.category === oldCategory &&
      i.subcategory === subcategoryName
    )
    for (const item of affected) {
      item.group = newGroup
      item.category = newCategory
    }
    await Promise.all(affected.map(i => api.updateItem(i.id, { ...i })))
    items.value = sortItems(items.value)
  }

  async function moveItem(itemId, newGroup, newCategory = null, newSubcategory = null) {
    const item = items.value.find(i => i.id === itemId)
    if (!item) return { ok: false, error: 'Item nÃ£o encontrado.' }
    item.group = newGroup
    item.category = newCategory || null
    item.subcategory = newSubcategory || null
    await api.updateItem(item.id, { ...item })
    items.value = sortItems(items.value)
    return { ok: true, item }
  }

  // ===== Bulk delete hierarchy =====
  async function deleteGroup(groupName) {
    const ids = items.value.filter(i => i.group === groupName).map(i => i.id)
    await Promise.all(ids.map(id => api.deleteItem(id)))
    items.value = items.value.filter(i => i.group !== groupName)
    variations.value = variations.value.filter(v => !ids.includes(v.itemId))
  }

  async function deleteCategory(group, categoryName) {
    const ids = items.value.filter(i => i.group === group && i.category === categoryName).map(i => i.id)
    await Promise.all(ids.map(id => api.deleteItem(id)))
    items.value = items.value.filter(i => !(i.group === group && i.category === categoryName))
    variations.value = variations.value.filter(v => !ids.includes(v.itemId))
  }

  async function deleteSubcategory(group, category, subcategoryName) {
    const ids = items.value.filter(i => i.group === group && i.category === category && i.subcategory === subcategoryName).map(i => i.id)
    await Promise.all(ids.map(id => api.deleteItem(id)))
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

  async function renameAttribute(itemId, oldName, newName) {
    const item = items.value.find(i => i.id === itemId)
    if (!item) return
    const idx = item.attributes.indexOf(oldName)
    if (idx < 0) return
    item.attributes[idx] = newName
    const affectedVars = []
    for (const v of variations.value) {
      if (v.itemId === itemId && oldName in v.values) {
        v.values[newName] = v.values[oldName]
        delete v.values[oldName]
        affectedVars.push(v)
      }
    }
    await api.updateItem(itemId, { ...item })
    await Promise.all(affectedVars.map(v => api.updateVariation(v.id, { ...v })))
  }

  async function addAttribute(itemId, attrName) {
    const item = items.value.find(i => i.id === itemId)
    if (!item) return
    if (item.attributes.includes(attrName)) return
    item.attributes.push(attrName)
    await api.updateItem(itemId, { ...item })
  }

  async function removeAttribute(itemId, attrName) {
    const item = items.value.find(i => i.id === itemId)
    if (!item) return
    item.attributes = item.attributes.filter(a => a !== attrName)
    const affectedVars = []
    for (const v of variations.value) {
      if (v.itemId === itemId && attrName in v.values) {
        delete v.values[attrName]
        affectedVars.push(v)
      }
    }
    await api.updateItem(itemId, { ...item })
    await Promise.all(affectedVars.map(v => api.updateVariation(v.id, { ...v })))
  }

  // ===== Reorder =====
  function _splice(arr, from, to) {
    const r = [...arr]
    const [item] = r.splice(from, 1)
    r.splice(to, 0, item)
    return r
  }

  async function reorderGroups(from, to) {
    orderData.value = { ...orderData.value, groups: _splice(uniqueGroups.value, from, to) }
    await api.saveDisplayOrder(orderData.value)
  }

  async function reorderCategories(group, from, to) {
    const list = getCategoriesForGroup(group)
    orderData.value = { ...orderData.value, categories: { ...orderData.value.categories, [group]: _splice(list, from, to) } }
    await api.saveDisplayOrder(orderData.value)
  }

  async function reorderSubcategories(group, category, from, to) {
    const key = `${group}|||${category}`
    const list = getSubcategoriesForCategory(group, category)
    orderData.value = { ...orderData.value, subcategories: { ...orderData.value.subcategories, [key]: _splice(list, from, to) } }
    await api.saveDisplayOrder(orderData.value)
  }

  async function reorderItemAttributes(itemId, from, to) {
    const item = items.value.find(i => i.id === itemId)
    if (!item) return
    item.attributes = _splice(item.attributes, from, to)
    await api.updateItem(itemId, { ...item })
  }

  // ===== Reset =====
  async function resetAll() {
    await api.seedReset()
    items.value = []
    variations.value = []
    orderData.value = {}
    activeGroup.value = null
    activeFilters.value = {}
  }

  // ===== Viewing item =====
  function setViewingItem(id) {
    if (viewingItemId.value !== (id || null)) {
      activeFilters.value = {}
    }
    viewingItemId.value = id || null
  }

  // ===== Faceted Filtering =====
  function toggleFilter(facetKey, value) {
    // Hierarchy facets act as navigation instead of plain filters
    if (facetKey === 'category') {
      // Toggle: if already navigated to this category, go back; otherwise navigate into it
      if (activeCategory.value === value) {
        setActiveCategory(null)
      } else {
        setActiveCategory(value)
      }
      return
    }
    if (facetKey === 'subcategory') {
      if (activeSubcategory.value === value) {
        setActiveSubcategory(null)
      } else {
        setActiveSubcategory(value)
      }
      return
    }

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
    activeCategory.value = null
    activeSubcategory.value = null
    activeFilters.value = {}
  }

  const groupItems = computed(() => {
    if (!activeGroup.value) return []
    return items.value.filter(i => i.group === activeGroup.value)
  })

  // Items scoped to the current navigation path (group + category + subcategory)
  const navigationItems = computed(() => {
    let r = groupItems.value
    if (activeCategory.value) r = r.filter(i => i.category === activeCategory.value)
    if (activeSubcategory.value) r = r.filter(i => i.subcategory === activeSubcategory.value)
    return sortItems(r)
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
    return sortItems(r)
  })

  const facets = computed(() => {
    const all = navigationItems.value
    if (!all.length) return []
    const { hierarchy: hF, attrs: aF } = _splitFilters(activeFilters.value)
    const out = []

    // ── When a specific item is open, show ONLY that item's attribute facets ──
    if (viewingItemId.value) {
      const item = items.value.find(i => i.id === viewingItemId.value)
      if (!item) return []
      const itemVars = variations.value.filter(v => v.itemId === item.id)
      for (const an of (item.attributes || [])) {
        const fk = `attr:${an}`
        const counts = {}
        for (const v of itemVars) {
          const val = v.values?.[an] || ''
          if (val) counts[val] = (counts[val] || 0) + 1
        }
        const opts = Object.entries(counts).map(([value, count]) => ({ value, count })).sort((a, b) => compareText(a.value, b.value))
        if (opts.length >= 2) {
          out.push({ key: fk, label: an, options: opts, selected: aF[fk] || [] })
        }
      }
      return out
    }

    // ── Normal group view: hierarchy + attribute facets ──

    // Hierarchy facets — skip levels already determined by navigation
    for (const d of [
      { key: 'category', label: 'Categoria', get: i => i.category || '' },
      { key: 'subcategory', label: 'Subcategoria', get: i => i.subcategory || '' },
      { key: 'name', label: 'Item', get: i => {
        const lastLevel = i.subcategory || i.category || i.group
        return i.name !== lastLevel ? i.name : ''
      }},
      { key: 'unit', label: 'Unidade', get: i => i.unit }
    ]) {
      // Skip hierarchy facets already resolved by navigation
      if (d.key === 'category' && activeCategory.value) continue
      if (d.key === 'subcategory' && activeSubcategory.value) continue

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
      const opts = Object.entries(counts).map(([value, count]) => ({ value, count })).sort((a, b) => compareText(a.value, b.value))
      if (opts.length >= 2 || hF[d.key]?.length) {
        out.push({ key: d.key, label: d.label, options: opts, selected: hF[d.key] || [] })
      }
    }

    // Attribute facets — scoped to navigation + hierarchy filters
    const hFilteredItems = Object.keys(hF).length ? all.filter(i => _itemMatchesH(i, hF)) : all
    const attrSet = new Set()
    for (const item of hFilteredItems) for (const a of item.attributes || []) attrSet.add(a)
    for (const an of [...attrSet].sort(compareText)) {
      const fk = `attr:${an}`
      let c = hFilteredItems
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
      const opts = Object.entries(counts).map(([value, count]) => ({ value, count })).sort((a, b) => compareText(a.value, b.value))
      if (opts.length >= 2 || aF[fk]?.length) {
        out.push({ key: fk, label: an, options: opts, selected: aF[fk] || [] })
      }
    }

    return out
  })

  const hasActiveFilters = computed(() =>
    activeCategory.value !== null ||
    activeSubcategory.value !== null ||
    Object.keys(activeFilters.value).length > 0
  )

  return {
    items,
    variations,
    activeGroup,
    activeCategory,
    activeSubcategory,
    // Init
    loadData,
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
    // Bulk move
    moveCategory, moveSubcategory, moveItem,
    // Bulk delete hierarchy
    deleteGroup, deleteCategory, deleteSubcategory,
    countItemsInGroup, countItemsInCategory, countItemsInSubcategory,
    // Attribute management
    getItemsForSubcategory, renameAttribute, addAttribute, removeAttribute,
    // Navigation
    setActiveGroup, setActiveCategory, setActiveSubcategory,
    // Viewing item
    setViewingItem,
    // Faceted filtering
    groupItems, navigationItems, filteredResults, facets, hasActiveFilters,
    toggleFilter, clearFilters,
    // Reorder
    reorderGroups, reorderCategories, reorderSubcategories, reorderItemAttributes,
    resetAll,
    // Dev / seed
    seedDatabase
  }
}
