import { ref, computed } from 'vue'
import * as api from '../services/api.js'

// Singleton state
const destinations = ref([])

export function useDestinations() {
  async function loadData() {
    destinations.value = await api.getDestinations()
  }

  const activeDestinations = computed(() =>
    destinations.value.filter(d => d.active)
  )

  const topLevelDestinations = computed(() =>
    destinations.value.filter(d => !d.parentId)
  )

  const activeTopLevelDest = computed(() =>
    destinations.value.filter(d => !d.parentId && d.active)
  )

  function getDestChildren(parentId) {
    return destinations.value.filter(d => d.parentId === parentId)
  }

  function getActiveDestChildren(parentId) {
    return destinations.value.filter(d => d.parentId === parentId && d.active)
  }

  function getDestFullName(idOrName) {
    if (!idOrName) return ''
    const dest = destinations.value.find(d => d.id === idOrName)
    if (!dest) return idOrName
    if (!dest.parentId) return dest.name
    const parent = destinations.value.find(d => d.id === dest.parentId)
    return parent ? `${parent.name} > ${dest.name}` : dest.name
  }

  const groupedDestinations = computed(() => {
    const result = []
    for (const p of activeTopLevelDest.value) {
      const children = getActiveDestChildren(p.id)
      result.push({ parent: p, children })
    }
    return result
  })

  async function addDestination(name, description = '', parentId = null) {
    const trimmed = name.trim()
    if (!trimmed) return { ok: false, error: 'Nome obrigatório.' }

    if (parentId) {
      const parent = destinations.value.find(d => d.id === parentId)
      if (!parent) return { ok: false, error: 'Destino pai não encontrado.' }
      if (parent.parentId) return { ok: false, error: 'Não é possível criar sub-destino de um sub-destino (máximo 2 níveis).' }
    }

    const siblings = destinations.value.filter(d => (d.parentId || null) === (parentId || null))
    if (siblings.some(d => d.name.toLowerCase() === trimmed.toLowerCase())) {
      return { ok: false, error: 'Já existe um destino com esse nome neste nível.' }
    }

    const created = await api.createDestination({
      name: trimmed,
      description: description.trim(),
      active: true,
      parentId: parentId || null,
    })
    destinations.value.push(created)
    return { ok: true, destination: created }
  }

  async function editDestination(id, changes) {
    const d = destinations.value.find(d => d.id === id)
    if (!d) return { ok: false, error: 'Destino não encontrado.' }
    if (changes.name !== undefined) {
      const trimmed = changes.name.trim()
      if (!trimmed) return { ok: false, error: 'Nome obrigatório.' }
      const siblings = destinations.value.filter(x => (x.parentId || null) === (d.parentId || null))
      if (siblings.some(x => x.id !== id && x.name.toLowerCase() === trimmed.toLowerCase())) {
        return { ok: false, error: 'Já existe um destino com esse nome neste nível.' }
      }
    }
    const updated = await api.updateDestination(id, { ...d, ...changes })
    Object.assign(d, updated)
    return { ok: true }
  }

  async function toggleDestinationActive(id) {
    const d = destinations.value.find(d => d.id === id)
    if (!d) return
    const updated = await api.updateDestination(id, { ...d, active: !d.active })
    Object.assign(d, updated)
  }

  async function deleteDestination(id) {
    await api.deleteDestination(id)
    destinations.value = destinations.value.filter(d => d.id !== id && d.parentId !== id)
  }

  function getDestinationById(id) {
    return destinations.value.find(d => d.id === id) ?? null
  }

  function getDestinationName(id) {
    return destinations.value.find(d => d.id === id)?.name ?? id
  }

  return {
    destinations,
    loadData,
    activeDestinations,
    topLevelDestinations,
    activeTopLevelDest,
    groupedDestinations,
    getDestChildren,
    getActiveDestChildren,
    getDestFullName,
    addDestination,
    editDestination,
    toggleDestinationActive,
    deleteDestination,
    getDestinationById,
    getDestinationName,
  }
}
