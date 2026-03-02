const STORAGE_KEY = 'catalogData'
const VARIATIONS_KEY = 'variationsData'
const STORAGE_VERSION = 7

/*
  Data model (item-centric with variations):

  Item = template that defines hierarchy + attribute columns
  item: {
    id,
    name,                   // string — also a hierarchy level (e.g., "Luva de Latex")
    group,                  // string (required)
    category,               // string (optional)
    subcategory,            // string (optional)
    unit,                   // string: UN, PAR, CX, etc.
    minStock,               // number
    attributes: []          // string[] — column names for variations
  }

  Variation = actual inventory entry with attribute values filled in
  variation: {
    id,
    itemId,                 // references item.id
    values: {},             // { [attrName]: string } — e.g. { Marca: "Volk", Tamanho: "G" }
    stock: 0                // current stock quantity
  }
*/

function getDefaultItems() {
  return []
}

function getDefaultVariations() {
  return []
}

// ===== Items =====

export function loadItems() {
  const version = localStorage.getItem(STORAGE_KEY + '_version')
  if (version !== String(STORAGE_VERSION)) {
    return resetItems()
  }
  const saved = localStorage.getItem(STORAGE_KEY)
  return saved ? JSON.parse(saved) : getDefaultItems()
}

export function saveItems(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  localStorage.setItem(STORAGE_KEY + '_version', String(STORAGE_VERSION))
}

export function resetItems() {
  const data = getDefaultItems()
  saveItems(data)
  return data
}

// ===== Variations =====

export function loadVariations() {
  const version = localStorage.getItem(STORAGE_KEY + '_version')
  if (version !== String(STORAGE_VERSION)) {
    return resetVariations()
  }
  const saved = localStorage.getItem(VARIATIONS_KEY)
  return saved ? JSON.parse(saved) : getDefaultVariations()
}

export function saveVariations(data) {
  localStorage.setItem(VARIATIONS_KEY, JSON.stringify(data))
}

export function resetVariations() {
  const data = getDefaultVariations()
  saveVariations(data)
  return data
}
