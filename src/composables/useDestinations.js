import { ref, computed, watch } from 'vue'
import { generateId } from '../utils/id.js'
import { loadDestinations, saveDestinations } from '../services/storageService.js'

// Singleton state
const destinations = ref(loadDestinations())

watch(destinations, (data) => saveDestinations(data), { deep: true })

export function useDestinations() {
  const activeDestinations = computed(() =>
    destinations.value.filter(d => d.active)
  )

  function addDestination(name, description = '') {
    const trimmed = name.trim()
    if (!trimmed) return { ok: false, error: 'Nome obrigatório.' }
    if (destinations.value.some(d => d.name.toLowerCase() === trimmed.toLowerCase())) {
      return { ok: false, error: 'Já existe um destino com esse nome.' }
    }
    const d = {
      id: generateId('dest'),
      name: trimmed,
      description: description.trim(),
      active: true,
    }
    destinations.value.push(d)
    return { ok: true, destination: d }
  }

  function editDestination(id, changes) {
    const d = destinations.value.find(d => d.id === id)
    if (!d) return { ok: false, error: 'Destino não encontrado.' }
    if (changes.name !== undefined) {
      const trimmed = changes.name.trim()
      if (!trimmed) return { ok: false, error: 'Nome obrigatório.' }
      if (destinations.value.some(x => x.id !== id && x.name.toLowerCase() === trimmed.toLowerCase())) {
        return { ok: false, error: 'Já existe um destino com esse nome.' }
      }
      d.name = trimmed
    }
    if (changes.description !== undefined) d.description = changes.description.trim()
    return { ok: true }
  }

  function toggleDestinationActive(id) {
    const d = destinations.value.find(d => d.id === id)
    if (d) d.active = !d.active
  }

  function deleteDestination(id) {
    const idx = destinations.value.findIndex(d => d.id === id)
    if (idx !== -1) destinations.value.splice(idx, 1)
  }

  function getDestinationById(id) {
    return destinations.value.find(d => d.id === id) ?? null
  }

  function getDestinationName(id) {
    return destinations.value.find(d => d.id === id)?.name ?? id
  }

  return {
    destinations,
    activeDestinations,
    addDestination,
    editDestination,
    toggleDestinationActive,
    deleteDestination,
    getDestinationById,
    getDestinationName,
  }
}
