import { ref, computed } from 'vue'
import * as api from '../services/api.js'

const users = ref([])

export function useUsers() {
  async function loadData() {
    users.value = await api.getUsers()
  }

  const activeUsers = computed(() => users.value.filter(u => u.active))

  async function addUser(name, pin, role = 'operador') {
    const trimmed = name.trim()
    if (!trimmed) return { ok: false, error: 'Nome obrigatório.' }
    if (!pin || pin.length < 4) return { ok: false, error: 'Senha deve ter ao menos 4 caracteres.' }
    try {
      const created = await api.createUser({ name: trimmed, pin, role })
      users.value.push(created)
      return { ok: true, user: created }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  }

  async function editUser(id, changes) {
    try {
      const updated = await api.updateUser(id, changes)
      const u = users.value.find(u => u.id === id)
      if (u) Object.assign(u, updated)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  }

  async function toggleUserActive(id) {
    const u = users.value.find(u => u.id === id)
    if (!u) return { ok: false, error: 'Usuário não encontrado.' }
    try {
      const updated = await api.updateUser(id, { active: !u.active })
      Object.assign(u, updated)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  }

  async function removeUser(id) {
    try {
      await api.deleteUser(id)
      users.value = users.value.filter(u => u.id !== id)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  }

  return {
    users,
    activeUsers,
    loadData,
    addUser,
    editUser,
    toggleUserActive,
    removeUser,
  }
}
