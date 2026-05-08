import { ref, computed } from 'vue'
import * as api from '../services/api.js'

const suppliers = ref([])
const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })

function sortByName(list) {
  return [...list].sort((a, b) =>
    collator.compare(a.name || '', b.name || '') ||
    String(a.id || '').localeCompare(String(b.id || ''))
  )
}

function normalizeName(name) {
  return String(name || '').trim()
}

export function useSuppliers() {
  async function loadData() {
    suppliers.value = sortByName(await api.getSuppliers())
  }

  const activeSuppliers = computed(() =>
    sortByName(suppliers.value.filter(s => s.active))
  )

  function findSupplierByName(name) {
    const trimmed = normalizeName(name)
    return suppliers.value.find(s => s.name.toLowerCase() === trimmed.toLowerCase()) || null
  }

  async function addSupplier(name, description = '') {
    const trimmed = normalizeName(name)
    if (!trimmed) return { ok: false, error: 'Nome obrigatorio.' }
    const existing = findSupplierByName(trimmed)
    if (existing) return { ok: true, supplier: existing, existed: true }

    const created = await api.createSupplier({
      name: trimmed,
      description: String(description || '').trim(),
      active: true,
    })
    suppliers.value.push(created)
    suppliers.value = sortByName(suppliers.value)
    return { ok: true, supplier: created, existed: false }
  }

  async function editSupplier(id, changes) {
    const supplier = suppliers.value.find(s => s.id === id)
    if (!supplier) return { ok: false, error: 'Fornecedor nao encontrado.' }
    if (changes.name !== undefined) {
      const trimmed = normalizeName(changes.name)
      if (!trimmed) return { ok: false, error: 'Nome obrigatorio.' }
      if (suppliers.value.some(s => s.id !== id && s.name.toLowerCase() === trimmed.toLowerCase())) {
        return { ok: false, error: 'Ja existe um fornecedor com esse nome.' }
      }
    }

    const updated = await api.updateSupplier(id, { ...supplier, ...changes })
    Object.assign(supplier, updated)
    suppliers.value = sortByName(suppliers.value)
    return { ok: true, supplier: updated }
  }

  async function toggleSupplierActive(id) {
    const supplier = suppliers.value.find(s => s.id === id)
    if (!supplier) return
    const updated = await api.updateSupplier(id, { ...supplier, active: !supplier.active })
    Object.assign(supplier, updated)
  }

  async function deleteSupplier(id) {
    await api.deleteSupplier(id)
    suppliers.value = suppliers.value.filter(s => s.id !== id)
  }

  async function ensureSupplier(name) {
    const trimmed = normalizeName(name)
    if (!trimmed) return { ok: true, supplier: null, skipped: true }
    return addSupplier(trimmed)
  }

  return {
    suppliers,
    activeSuppliers,
    loadData,
    addSupplier,
    editSupplier,
    toggleSupplierActive,
    deleteSupplier,
    ensureSupplier,
    findSupplierByName,
  }
}
