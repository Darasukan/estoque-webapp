import { ref, computed, watch } from 'vue'
import { generateId } from '../utils/id.js'
import { loadRoles, saveRoles } from '../services/storageService.js'

// Singleton state
const roles = ref(loadRoles())

watch(roles, (data) => saveRoles(data), { deep: true })

export function useRoles() {
  const activeRoles = computed(() =>
    roles.value.filter(r => r.active)
  )

  function addRole(name, description = '') {
    const trimmed = name.trim()
    if (!trimmed) return { ok: false, error: 'Nome obrigatório.' }
    if (roles.value.some(r => r.name.toLowerCase() === trimmed.toLowerCase())) {
      return { ok: false, error: 'Já existe um cargo com esse nome.' }
    }
    const r = {
      id: generateId('role'),
      name: trimmed,
      description: description.trim(),
      active: true,
    }
    roles.value.push(r)
    return { ok: true, role: r }
  }

  function editRole(id, changes) {
    const r = roles.value.find(r => r.id === id)
    if (!r) return { ok: false, error: 'Cargo não encontrado.' }
    if (changes.name !== undefined) {
      const trimmed = changes.name.trim()
      if (!trimmed) return { ok: false, error: 'Nome obrigatório.' }
      if (roles.value.some(x => x.id !== id && x.name.toLowerCase() === trimmed.toLowerCase())) {
        return { ok: false, error: 'Já existe um cargo com esse nome.' }
      }
      r.name = trimmed
    }
    if (changes.description !== undefined) r.description = changes.description.trim()
    return { ok: true }
  }

  function toggleRoleActive(id) {
    const r = roles.value.find(r => r.id === id)
    if (r) r.active = !r.active
  }

  function deleteRole(id) {
    const idx = roles.value.findIndex(r => r.id === id)
    if (idx !== -1) roles.value.splice(idx, 1)
  }

  return {
    roles,
    activeRoles,
    addRole,
    editRole,
    toggleRoleActive,
    deleteRole,
  }
}
