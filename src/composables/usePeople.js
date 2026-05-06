import { ref, computed } from 'vue'
import * as api from '../services/api.js'

// Singleton state
const people = ref([])
const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })

function sortByName(list) {
  return [...list].sort((a, b) =>
    collator.compare(a.name || '', b.name || '') ||
    String(a.id || '').localeCompare(String(b.id || ''))
  )
}

export function usePeople() {
  async function loadData() {
    people.value = sortByName(await api.getPeople())
  }

  const activePeople = computed(() =>
    sortByName(people.value.filter(p => p.active))
  )

  async function addPerson(name, role = '') {
    const trimmed = name.trim()
    if (!trimmed) return { ok: false, error: 'Nome obrigatório.' }
    if (people.value.some(p => p.name.toLowerCase() === trimmed.toLowerCase())) {
      return { ok: false, error: 'Já existe uma pessoa com esse nome.' }
    }
    const created = await api.createPerson({
      name: trimmed,
      role: role.trim(),
      active: true,
    })
    people.value.push(created)
    people.value = sortByName(people.value)
    return { ok: true, person: created }
  }

  async function editPerson(id, changes) {
    const p = people.value.find(p => p.id === id)
    if (!p) return { ok: false, error: 'Pessoa não encontrada.' }
    if (changes.name !== undefined) {
      const trimmed = changes.name.trim()
      if (!trimmed) return { ok: false, error: 'Nome obrigatório.' }
      if (people.value.some(x => x.id !== id && x.name.toLowerCase() === trimmed.toLowerCase())) {
        return { ok: false, error: 'Já existe uma pessoa com esse nome.' }
      }
    }
    const updated = await api.updatePerson(id, { ...p, ...changes })
    Object.assign(p, updated)
    people.value = sortByName(people.value)
    return { ok: true }
  }

  async function togglePersonActive(id) {
    const p = people.value.find(p => p.id === id)
    if (!p) return
    const updated = await api.updatePerson(id, { ...p, active: !p.active })
    Object.assign(p, updated)
  }

  async function deletePerson(id) {
    await api.deletePerson(id)
    people.value = people.value.filter(p => p.id !== id)
  }

  function getPersonById(id) {
    return people.value.find(p => p.id === id) ?? null
  }

  function getPersonName(id) {
    return people.value.find(p => p.id === id)?.name ?? id
  }

  return {
    people,
    loadData,
    activePeople,
    addPerson,
    editPerson,
    togglePersonActive,
    deletePerson,
    getPersonById,
    getPersonName,
  }
}
