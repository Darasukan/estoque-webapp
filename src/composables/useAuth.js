import { ref, computed } from 'vue'
import * as api from '../services/api.js'

const user = ref(JSON.parse(sessionStorage.getItem('auth_user') || 'null'))

export function useAuth() {
  const isAdmin = computed(() => user.value?.role === 'admin')
  const isLoggedIn = computed(() => !!user.value)

  async function login(name, pin) {
    try {
      const u = await api.login(name, pin)
      user.value = u
      return true
    } catch {
      return false
    }
  }

  async function logout() {
    await api.logout()
    user.value = null
  }

  async function checkSession() {
    if (!sessionStorage.getItem('auth_token')) return
    try {
      const u = await api.getMe()
      user.value = u
    } catch {
      user.value = null
    }
  }

  return { user, isAdmin, isLoggedIn, login, logout, checkSession }
}
