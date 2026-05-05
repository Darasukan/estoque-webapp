import { ref } from 'vue'
import * as api from '../services/api.js'

const closings = ref([])
const closingDetails = ref({})

export function useClosings() {
  async function loadData() {
    closings.value = await api.getClosings()
  }

  async function loadClosing(id) {
    const detail = await api.getClosing(id)
    closingDetails.value = { ...closingDetails.value, [id]: detail }
    return detail
  }

  async function createClosing(data) {
    const created = await api.createClosing(data)
    const idx = closings.value.findIndex(c => c.id === created.id)
    if (idx === -1) closings.value.unshift(created)
    else closings.value.splice(idx, 1, created)
    closingDetails.value = { ...closingDetails.value, [created.id]: created }
    return created
  }

  async function deleteClosing(id) {
    await api.deleteClosing(id)
    closings.value = closings.value.filter(c => c.id !== id)
    const next = { ...closingDetails.value }
    delete next[id]
    closingDetails.value = next
  }

  return {
    closings,
    closingDetails,
    loadData,
    loadClosing,
    createClosing,
    deleteClosing,
  }
}
