import { ref } from 'vue'

const toasts = ref([])
let toastId = 0
const toastTimers = new Map()
const MAX_TOASTS = 3

export function useToast() {
  function showToast(message, type = 'success', duration = 2500) {
    const duplicate = toasts.value.find(t => t.message === message && t.type === type)
    if (duplicate) return duplicate.id

    const id = ++toastId
    const nextToasts = [...toasts.value, { id, message, type }]
    const overflow = Math.max(0, nextToasts.length - MAX_TOASTS)
    const removed = overflow ? nextToasts.slice(0, overflow) : []

    for (const toast of removed) {
      clearTimeout(toastTimers.get(toast.id))
      toastTimers.delete(toast.id)
    }

    toasts.value = nextToasts.slice(overflow)

    const timer = setTimeout(() => {
      toastTimers.delete(id)
      toasts.value = toasts.value.filter(t => t.id !== id)
    }, duration)
    toastTimers.set(id, timer)
    return id
  }

  function success(message) { showToast(message, 'success') }
  function error(message) { showToast(message, 'error') }

  return { toasts, showToast, success, error }
}
