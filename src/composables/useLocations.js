import { ref, computed } from 'vue'
import * as api from '../services/api.js'

// Singleton state
const locais = ref([])
const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })

function sortByName(list) {
  return [...list].sort((a, b) =>
    collator.compare(a.name || '', b.name || '') ||
    String(a.id || '').localeCompare(String(b.id || ''))
  )
}

export function useLocations() {
  async function loadData() {
    locais.value = sortByName(await api.getLocations())
  }

  const activeLocais = computed(() =>
    sortByName(locais.value.filter(l => l.active))
  )

  /** Top-level locations (no parent) */
  const topLevelLocais = computed(() =>
    sortByName(locais.value.filter(l => !l.parentId))
  )

  const activeTopLevel = computed(() =>
    sortByName(locais.value.filter(l => !l.parentId && l.active))
  )

  /** Get active children of a parent */
  function getChildren(parentId) {
    return sortByName(locais.value.filter(l => l.parentId === parentId))
  }

  function getActiveChildren(parentId) {
    return sortByName(locais.value.filter(l => l.parentId === parentId && l.active))
  }

  /** Get full display name: "Parent > Child" or just "Name" */
  function getFullName(idOrName) {
    if (!idOrName) return ''
    const loc = locais.value.find(l => l.id === idOrName)
    if (!loc) return idOrName
    if (!loc.parentId) return loc.name
    const parent = locais.value.find(l => l.id === loc.parentId)
    return parent ? `${parent.name} > ${loc.name}` : loc.name
  }

  /** Find a local by exact name (for migration) */
  function findLocalByName(name) {
    if (!name) return null
    const trimmed = name.trim().toLowerCase()
    return locais.value.find(l => l.name.toLowerCase() === trimmed) || null
  }

  /** Grouped structure for dropdowns: [{ parent, children[] }] */
  const groupedLocais = computed(() => {
    const result = []
    for (const p of activeTopLevel.value) {
      const children = getActiveChildren(p.id)
      result.push({ parent: p, children })
    }
    return result
  })

  async function addLocal(name, description = '', parentId = null) {
    const trimmed = name.trim()
    if (!trimmed) return { ok: false, error: 'Nome obrigatório.' }

    if (parentId) {
      const parent = locais.value.find(l => l.id === parentId)
      if (!parent) return { ok: false, error: 'Local pai não encontrado.' }
      if (parent.parentId) return { ok: false, error: 'Não é possível criar sub-local de um sub-local (máximo 2 níveis).' }
    }

    const siblings = locais.value.filter(l => (l.parentId || null) === (parentId || null))
    if (siblings.some(l => l.name.toLowerCase() === trimmed.toLowerCase())) {
      return { ok: false, error: 'Já existe um local com esse nome neste nível.' }
    }

    const created = await api.createLocation({
      name: trimmed,
      description: description.trim(),
      active: true,
      parentId: parentId || null,
    })
    locais.value.push(created)
    locais.value = sortByName(locais.value)
    return { ok: true, local: created }
  }

  async function editLocal(id, changes) {
    const l = locais.value.find(l => l.id === id)
    if (!l) return { ok: false, error: 'Local não encontrado.' }
    if (changes.name !== undefined) {
      const trimmed = changes.name.trim()
      if (!trimmed) return { ok: false, error: 'Nome obrigatório.' }
      const siblings = locais.value.filter(x => (x.parentId || null) === (l.parentId || null))
      if (siblings.some(x => x.id !== id && x.name.toLowerCase() === trimmed.toLowerCase())) {
        return { ok: false, error: 'Já existe um local com esse nome neste nível.' }
      }
    }
    const updated = await api.updateLocation(id, { ...l, ...changes })
    Object.assign(l, updated)
    locais.value = sortByName(locais.value)
    return { ok: true }
  }

  async function toggleLocalActive(id) {
    const l = locais.value.find(l => l.id === id)
    if (!l) return
    const updated = await api.updateLocation(id, { ...l, active: !l.active })
    Object.assign(l, updated)
  }

  async function deleteLocal(id) {
    await api.deleteLocation(id)
    locais.value = locais.value.filter(l => l.id !== id && l.parentId !== id)
  }

  return {
    locais,
    loadData,
    activeLocais,
    topLevelLocais,
    activeTopLevel,
    groupedLocais,
    getChildren,
    getActiveChildren,
    getFullName,
    findLocalByName,
    addLocal,
    editLocal,
    toggleLocalActive,
    deleteLocal,
  }
}
