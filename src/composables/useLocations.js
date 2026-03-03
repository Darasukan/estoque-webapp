import { ref, computed, watch } from 'vue'
import { generateId } from '../utils/id.js'
import { loadLocais, saveLocais } from '../services/storageService.js'

// Singleton state
const locais = ref(loadLocais())

watch(locais, (data) => saveLocais(data), { deep: true })

export function useLocations() {
  const activeLocais = computed(() =>
    locais.value.filter(l => l.active)
  )

  function addLocal(name, description = '') {
    const trimmed = name.trim()
    if (!trimmed) return { ok: false, error: 'Nome obrigatório.' }
    if (locais.value.some(l => l.name.toLowerCase() === trimmed.toLowerCase())) {
      return { ok: false, error: 'Já existe um local com esse nome.' }
    }
    const l = {
      id: generateId('loc'),
      name: trimmed,
      description: description.trim(),
      active: true,
    }
    locais.value.push(l)
    return { ok: true, local: l }
  }

  function editLocal(id, changes) {
    const l = locais.value.find(l => l.id === id)
    if (!l) return { ok: false, error: 'Local não encontrado.' }
    if (changes.name !== undefined) {
      const trimmed = changes.name.trim()
      if (!trimmed) return { ok: false, error: 'Nome obrigatório.' }
      if (locais.value.some(x => x.id !== id && x.name.toLowerCase() === trimmed.toLowerCase())) {
        return { ok: false, error: 'Já existe um local com esse nome.' }
      }
      l.name = trimmed
    }
    if (changes.description !== undefined) l.description = changes.description.trim()
    return { ok: true }
  }

  function toggleLocalActive(id) {
    const l = locais.value.find(l => l.id === id)
    if (l) l.active = !l.active
  }

  function deleteLocal(id) {
    const idx = locais.value.findIndex(l => l.id === id)
    if (idx !== -1) locais.value.splice(idx, 1)
  }

  return {
    locais,
    activeLocais,
    addLocal,
    editLocal,
    toggleLocalActive,
    deleteLocal,
  }
}
