import { ref, computed } from 'vue'
import * as api from '../services/api.js'

// ===== Singleton state =====
const workOrders = ref([])
const report = ref([])

// ===== Composable =====
export function useWorkOrders() {

  async function loadData() {
    workOrders.value = await api.getWorkOrders()
  }

  async function loadReport() {
    report.value = await api.getWorkOrderReport()
  }

  async function addWorkOrder(data) {
    const created = await api.createWorkOrder(data)
    workOrders.value.unshift(created)
    return created
  }

  async function editWorkOrder(id, changes) {
    const updated = await api.updateWorkOrder(id, changes)
    const idx = workOrders.value.findIndex(o => o.id === id)
    if (idx !== -1) workOrders.value.splice(idx, 1, updated)
    return updated
  }

  async function deleteWorkOrder(id) {
    const result = await api.deleteWorkOrder(id)
    const idx = workOrders.value.findIndex(o => o.id === id)
    if (idx !== -1) workOrders.value.splice(idx, 1)
    return result
  }

  /**
   * Add material to a work order.
   * Returns { workOrderItem, movement, newStock } from server.
   * Caller should update local variation stock and movements list.
   */
  async function addMaterial(workOrderId, variationId, qty) {
    const result = await api.addWorkOrderItem(workOrderId, { variationId, qty })
    // Update local work order items
    const wo = workOrders.value.find(o => o.id === workOrderId)
    if (wo) {
      if (!wo.items) wo.items = []
      wo.items.push(result.workOrderItem)
    }
    return result
  }

  /**
   * Remove material from a work order.
   * Returns { ok, removedMovementId, variationId, newStock } from server.
   * Caller should update local variation stock and movements list.
   */
  async function removeMaterial(workOrderId, workOrderItemId) {
    const result = await api.removeWorkOrderItem(workOrderId, workOrderItemId)
    // Update local work order items
    const wo = workOrders.value.find(o => o.id === workOrderId)
    if (wo && wo.items) {
      const idx = wo.items.findIndex(i => i.id === workOrderItemId)
      if (idx !== -1) wo.items.splice(idx, 1)
    }
    return result
  }

  /** Work orders grouped by destination for quick lookup */
  const workOrdersByDestination = computed(() => {
    const map = {}
    for (const wo of workOrders.value) {
      const key = wo.destinationName || 'Sem destino'
      if (!map[key]) map[key] = []
      map[key].push(wo)
    }
    return map
  })

  /** Get work orders for a specific destination id */
  function getWorkOrdersForDestination(destinationId) {
    return workOrders.value.filter(wo => wo.destinationId === destinationId)
  }

  /**
   * Link an existing movement (from saída flow) to a work order.
   * No stock deduction — the movement already handled that.
   */
  async function linkMovement(workOrderId, movementId) {
    const woItem = await api.linkMovementToWorkOrder(workOrderId, movementId)
    const wo = workOrders.value.find(o => o.id === workOrderId)
    if (wo) {
      if (!wo.items) wo.items = []
      wo.items.push(woItem)
    }
    return woItem
  }

  return {
    workOrders,
    report,
    loadData,
    loadReport,
    addWorkOrder,
    editWorkOrder,
    deleteWorkOrder,
    addMaterial,
    removeMaterial,
    linkMovement,
    workOrdersByDestination,
    getWorkOrdersForDestination,
  }
}
