import { ref, computed, watch } from 'vue'
import { loadMovements, saveMovements } from '../services/storageService.js'
import { generateId } from '../utils/id.js'

// ===== Singleton state =====
const movements = ref(loadMovements())

watch(movements, (val) => saveMovements(val), { deep: true })

// ===== Composable =====
export function useMovements() {

  /**
   * Record a new movement and update variation stock.
   * @param {'entrada'|'saida'} type
   * @param {object} variation  — reactive variation object (will be mutated)
   * @param {object} item       — item object (for denormalization)
   * @param {number} qty        — always positive; direction comes from type
   * @param {object} fields     — { supplier?, requestedBy?, destination?, docRef?, note? }
   */
  function addMovement(type, variation, item, qty, fields = {}) {
    const stockBefore = variation.stock
    const stockAfter = type === 'entrada'
      ? stockBefore + qty
      : stockBefore - qty

    variation.stock = stockAfter

    movements.value.unshift({
      id: generateId('mov'),
      type,
      variationId: variation.id,
      itemId: item.id,
      itemName: item.name,
      itemGroup: item.group,
      itemCategory: item.category || '',
      itemSubcategory: item.subcategory || '',
      itemUnit: item.unit,
      variationValues: { ...(variation.values || {}) },
      variationExtras: { ...(variation.extras || {}) },
      qty,
      stockBefore,
      stockAfter,
      date: new Date().toISOString(),
      supplier: fields.supplier || '',
      requestedBy: fields.requestedBy || '',
      destination: fields.destination || '',
      docRef: fields.docRef || '',
      note: fields.note || '',
    })
  }

  function deleteMovement(id) {
    const idx = movements.value.findIndex(m => m.id === id)
    if (idx !== -1) movements.value.splice(idx, 1)
  }

  /**
   * Movements in the last 24 hours — used for the badge in App.vue
   */
  const recentMovements = computed(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    return movements.value.filter(m => new Date(m.date).getTime() > cutoff)
  })

  return {
    movements,
    addMovement,
    deleteMovement,
    recentMovements,
  }
}
