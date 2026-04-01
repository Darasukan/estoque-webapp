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
   * Edit a movement's editable fields and adjust stock if qty changed.
   * @param {string} id
   * @param {object} changes — partial fields to update
   * @param {object|null} variation — live reactive variation (needed when qty changes)
   * @returns {{ ok: boolean, error?: string }}
   */
  function editMovement(id, changes, variation) {
    const m = movements.value.find(mv => mv.id === id)
    if (!m) return { ok: false, error: 'Movimentação não encontrada.' }

    const oldQty = m.qty
    const newQty = changes.qty !== undefined ? Number(changes.qty) : oldQty
    if (!isFinite(newQty) || newQty <= 0) return { ok: false, error: 'Quantidade deve ser positiva.' }

    // Adjust variation stock when qty changed
    if (newQty !== oldQty && variation) {
      const diff = newQty - oldQty
      if (m.type === 'entrada') variation.stock += diff
      else variation.stock -= diff

      if (variation.stock < 0) {
        if (m.type === 'entrada') variation.stock -= diff
        else variation.stock += diff
        return { ok: false, error: 'Estoque ficaria negativo com essa quantidade.' }
      }
      m.stockAfter = m.stockBefore + (m.type === 'entrada' ? newQty : -newQty)
    }

    if (changes.qty !== undefined) m.qty = newQty
    if (changes.date !== undefined) m.date = changes.date
    if (changes.supplier !== undefined) m.supplier = changes.supplier
    if (changes.requestedBy !== undefined) m.requestedBy = changes.requestedBy
    if (changes.destination !== undefined) m.destination = changes.destination
    if (changes.docRef !== undefined) m.docRef = changes.docRef
    if (changes.note !== undefined) m.note = changes.note

    // Re-sort by date descending after date change
    if (changes.date !== undefined) {
      movements.value.sort((a, b) => new Date(b.date) - new Date(a.date))
    }

    return { ok: true }
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
    editMovement,
    deleteMovement,
    recentMovements,
  }
}
