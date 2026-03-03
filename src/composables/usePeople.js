import { ref, computed, watch } from 'vue'
import { generateId } from '../utils/id.js'
import { loadPeople, savePeople } from '../services/storageService.js'

// Singleton state
const people = ref(loadPeople())

watch(people, (data) => savePeople(data), { deep: true })

export function usePeople() {
  const activePeople = computed(() =>
    people.value.filter(p => p.active)
  )

  function addPerson(name, role = '') {
    const trimmed = name.trim()
    if (!trimmed) return { ok: false, error: 'Nome obrigatório.' }
    if (people.value.some(p => p.name.toLowerCase() === trimmed.toLowerCase())) {
      return { ok: false, error: 'Já existe uma pessoa com esse nome.' }
    }
    const p = {
      id: generateId('person'),
      name: trimmed,
      role: role.trim(),
      active: true,
    }
    people.value.push(p)
    return { ok: true, person: p }
  }

  function editPerson(id, changes) {
    const p = people.value.find(p => p.id === id)
    if (!p) return { ok: false, error: 'Pessoa não encontrada.' }
    if (changes.name !== undefined) {
      const trimmed = changes.name.trim()
      if (!trimmed) return { ok: false, error: 'Nome obrigatório.' }
      if (people.value.some(x => x.id !== id && x.name.toLowerCase() === trimmed.toLowerCase())) {
        return { ok: false, error: 'Já existe uma pessoa com esse nome.' }
      }
      p.name = trimmed
    }
    if (changes.role !== undefined) p.role = changes.role.trim()
    return { ok: true }
  }

  function togglePersonActive(id) {
    const p = people.value.find(p => p.id === id)
    if (p) p.active = !p.active
  }

  function deletePerson(id) {
    const idx = people.value.findIndex(p => p.id === id)
    if (idx !== -1) people.value.splice(idx, 1)
  }

  function getPersonById(id) {
    return people.value.find(p => p.id === id) ?? null
  }

  function getPersonName(id) {
    return people.value.find(p => p.id === id)?.name ?? id
  }

  return {
    people,
    activePeople,
    addPerson,
    editPerson,
    togglePersonActive,
    deletePerson,
    getPersonById,
    getPersonName,
  }
}
