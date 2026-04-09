import { Router } from 'express'
import crypto from 'crypto'
import db from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

function genId(prefix) {
  return prefix + '_' + crypto.randomBytes(6).toString('hex')
}

function mapWorkOrder(r) {
  return {
    id: r.id,
    number: r.number,
    title: r.title,
    destinationId: r.destination_id,
    destinationName: r.destination_name,
    requestedBy: r.requested_by,
    note: r.note,
    createdAt: r.created_at,
  }
}

function mapWorkOrderItem(r) {
  return {
    id: r.id,
    workOrderId: r.work_order_id,
    variationId: r.variation_id,
    itemId: r.item_id,
    itemName: r.item_name,
    itemGroup: r.item_group,
    itemCategory: r.item_category,
    itemUnit: r.item_unit,
    variationValues: JSON.parse(r.variation_values || '{}'),
    qty: r.qty,
    movementId: r.movement_id,
    addedAt: r.added_at,
  }
}

// GET /api/work-orders — list all with items
router.get('/', (req, res) => {
  const orders = db.prepare('SELECT * FROM work_orders ORDER BY created_at DESC').all()
  const allItems = db.prepare('SELECT * FROM work_order_items ORDER BY added_at ASC').all()

  const itemsByOrder = {}
  for (const it of allItems) {
    if (!itemsByOrder[it.work_order_id]) itemsByOrder[it.work_order_id] = []
    itemsByOrder[it.work_order_id].push(mapWorkOrderItem(it))
  }

  res.json(orders.map(o => ({
    ...mapWorkOrder(o),
    items: itemsByOrder[o.id] || []
  })))
})

// GET /api/work-orders/report/by-destination — report grouped by destination
router.get('/report/by-destination', (req, res) => {
  // All work orders grouped by destination
  const orders = db.prepare('SELECT * FROM work_orders ORDER BY created_at DESC').all()
  const allWoItems = db.prepare('SELECT * FROM work_order_items ORDER BY added_at ASC').all()

  // All saida movements
  const allSaidas = db.prepare("SELECT * FROM movements WHERE type = 'saida' ORDER BY date DESC").all()

  // Build set of movement_ids that are linked to work orders
  const linkedMovementIds = new Set()
  for (const it of allWoItems) {
    if (it.movement_id) linkedMovementIds.add(it.movement_id)
  }

  // Group orders by destination_name
  const destMap = {} // { destinationName: { destinationId, orders: [...], looseSaidas: [...] } }

  for (const o of orders) {
    const key = o.destination_name || 'Sem destino'
    if (!destMap[key]) destMap[key] = { destinationId: o.destination_id, destinationName: key, orders: [], looseSaidas: [] }
    const woItems = allWoItems.filter(it => it.work_order_id === o.id).map(mapWorkOrderItem)
    destMap[key].orders.push({ ...mapWorkOrder(o), items: woItems })
  }

  // Add loose saidas (not linked to any work order)
  for (const m of allSaidas) {
    if (linkedMovementIds.has(m.id)) continue // skip linked ones
    const dest = m.destination || 'Sem destino'
    if (!destMap[dest]) destMap[dest] = { destinationId: '', destinationName: dest, orders: [], looseSaidas: [] }
    destMap[dest].looseSaidas.push({
      id: m.id,
      variationId: m.variation_id,
      itemId: m.item_id,
      itemName: m.item_name,
      itemGroup: m.item_group,
      itemCategory: m.item_category,
      itemUnit: m.item_unit,
      variationValues: JSON.parse(m.variation_values || '{}'),
      qty: m.qty,
      date: m.date,
      requestedBy: m.requested_by,
      docRef: m.doc_ref,
    })
  }

  // Build material totals per destination
  const result = Object.values(destMap).map(d => {
    const totals = {}
    // From work order items
    for (const o of d.orders) {
      for (const it of o.items) {
        const key = `${it.itemId}||${JSON.stringify(it.variationValues)}`
        if (!totals[key]) totals[key] = { itemId: it.itemId, itemName: it.itemName, itemUnit: it.itemUnit, variationValues: it.variationValues, qty: 0 }
        totals[key].qty += it.qty
      }
    }
    // From loose saidas
    for (const s of d.looseSaidas) {
      const key = `${s.itemId}||${JSON.stringify(s.variationValues)}`
      if (!totals[key]) totals[key] = { itemId: s.itemId, itemName: s.itemName, itemUnit: s.itemUnit, variationValues: s.variationValues, qty: 0 }
      totals[key].qty += s.qty
    }

    return {
      ...d,
      materialTotals: Object.values(totals),
    }
  })

  result.sort((a, b) => a.destinationName.localeCompare(b.destinationName))
  res.json(result)
})

// GET /api/work-orders/:id — single with items
router.get('/:id', (req, res) => {
  const o = db.prepare('SELECT * FROM work_orders WHERE id = ?').get(req.params.id)
  if (!o) return res.status(404).json({ error: 'Ordem de serviço não encontrada' })

  const items = db.prepare('SELECT * FROM work_order_items WHERE work_order_id = ? ORDER BY added_at ASC').all(o.id)
  res.json({ ...mapWorkOrder(o), items: items.map(mapWorkOrderItem) })
})

// POST /api/work-orders — create
router.post('/', requireAuth, (req, res) => {
  const { title, destinationId, requestedBy, note } = req.body
  if (!title || !title.trim()) return res.status(400).json({ error: 'Título é obrigatório' })

  // Auto-generate sequential number
  const maxRow = db.prepare('SELECT MAX(number) as maxNum FROM work_orders').get()
  const number = (maxRow.maxNum || 0) + 1

  // Denormalize destination name
  let destinationName = ''
  if (destinationId) {
    const dest = db.prepare('SELECT * FROM destinations WHERE id = ?').get(destinationId)
    if (dest) {
      if (dest.parent_id) {
        const parent = db.prepare('SELECT name FROM destinations WHERE id = ?').get(dest.parent_id)
        destinationName = parent ? `${parent.name} › ${dest.name}` : dest.name
      } else {
        destinationName = dest.name
      }
    }
  }

  const id = genId('os')
  const createdAt = new Date().toISOString()

  db.prepare(`INSERT INTO work_orders (id, number, title, destination_id, destination_name, requested_by, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, number, title.trim(), destinationId || '', destinationName, requestedBy || '', note || '', createdAt
  )

  res.json({
    id, number, title: title.trim(),
    destinationId: destinationId || '', destinationName,
    requestedBy: requestedBy || '', note: note || '',
    createdAt, items: []
  })
})

// PUT /api/work-orders/:id — update
router.put('/:id', requireAuth, (req, res) => {
  const o = db.prepare('SELECT * FROM work_orders WHERE id = ?').get(req.params.id)
  if (!o) return res.status(404).json({ error: 'Ordem de serviço não encontrada' })

  const { title, destinationId, requestedBy, note } = req.body

  let destinationName = o.destination_name
  const newDestId = destinationId !== undefined ? destinationId : o.destination_id
  if (destinationId !== undefined && destinationId !== o.destination_id) {
    destinationName = ''
    if (destinationId) {
      const dest = db.prepare('SELECT * FROM destinations WHERE id = ?').get(destinationId)
      if (dest) {
        if (dest.parent_id) {
          const parent = db.prepare('SELECT name FROM destinations WHERE id = ?').get(dest.parent_id)
          destinationName = parent ? `${parent.name} › ${dest.name}` : dest.name
        } else {
          destinationName = dest.name
        }
      }
    }
  }

  db.prepare(`UPDATE work_orders SET title=?, destination_id=?, destination_name=?, requested_by=?, note=? WHERE id=?`).run(
    title !== undefined ? title.trim() : o.title,
    newDestId,
    destinationName,
    requestedBy !== undefined ? requestedBy : o.requested_by,
    note !== undefined ? note : o.note,
    req.params.id
  )

  const updated = db.prepare('SELECT * FROM work_orders WHERE id = ?').get(req.params.id)
  const items = db.prepare('SELECT * FROM work_order_items WHERE work_order_id = ? ORDER BY added_at ASC').all(req.params.id)
  res.json({ ...mapWorkOrder(updated), items: items.map(mapWorkOrderItem) })
})

// DELETE /api/work-orders/:id — delete (cascade removes items)
router.delete('/:id', requireAuth, (req, res) => {
  const o = db.prepare('SELECT * FROM work_orders WHERE id = ?').get(req.params.id)
  if (!o) return res.status(404).json({ error: 'Ordem de serviço não encontrada' })

  db.prepare('DELETE FROM work_orders WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// POST /api/work-orders/:id/items — add material to work order
router.post('/:id/items', requireAuth, (req, res) => {
  const o = db.prepare('SELECT * FROM work_orders WHERE id = ?').get(req.params.id)
  if (!o) return res.status(404).json({ error: 'Ordem de serviço não encontrada' })

  const { variationId, qty } = req.body
  if (!variationId || !qty || qty <= 0) return res.status(400).json({ error: 'variationId e qty (>0) são obrigatórios' })

  const variation = db.prepare('SELECT * FROM variations WHERE id = ?').get(variationId)
  if (!variation) return res.status(404).json({ error: 'Variação não encontrada' })

  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(variation.item_id)
  if (!item) return res.status(404).json({ error: 'Item não encontrado' })

  // Check stock
  if (variation.stock < qty) return res.status(400).json({ error: `Estoque insuficiente. Disponível: ${variation.stock}` })

  const operatorId = req.user?.id || ''
  const operatorName = req.user?.name || ''

  // Deduct stock + create implicit movement in a transaction
  const stockBefore = variation.stock
  const stockAfter = stockBefore - qty

  const movId = genId('mov')
  const woiId = genId('osi')
  const now = new Date().toISOString()

  const tx = db.transaction(() => {
    // Update variation stock
    db.prepare('UPDATE variations SET stock = ? WHERE id = ?').run(stockAfter, variationId)

    // Create implicit saida movement
    db.prepare(`INSERT INTO movements (id, type, variation_id, item_id, item_name, item_group, item_category, item_subcategory, item_unit, variation_values, variation_extras, qty, stock_before, stock_after, date, supplier, requested_by, destination, doc_ref, note, operator_id, operator_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      movId, 'saida', variationId, item.id,
      item.name, item.group_name, item.category || '', item.subcategory || '', item.unit,
      variation.vals, variation.extras || '{}',
      qty, stockBefore, stockAfter, now,
      '', o.requested_by || '', o.destination_name || '',
      `OS #${o.number}`, `Material adicionado via OS #${o.number}`,
      operatorId, operatorName
    )

    // Create work_order_items record
    db.prepare(`INSERT INTO work_order_items (id, work_order_id, variation_id, item_id, item_name, item_group, item_category, item_unit, variation_values, qty, movement_id, added_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      woiId, o.id, variationId, item.id,
      item.name, item.group_name, item.category || '', item.unit,
      variation.vals, qty, movId, now
    )
  })

  tx()

  res.json({
    workOrderItem: {
      id: woiId,
      workOrderId: o.id,
      variationId, itemId: item.id,
      itemName: item.name, itemGroup: item.group_name,
      itemCategory: item.category || '', itemUnit: item.unit,
      variationValues: JSON.parse(variation.vals || '{}'),
      qty, movementId: movId, addedAt: now,
    },
    movement: {
      id: movId, type: 'saida', variationId, itemId: item.id,
      itemName: item.name, itemGroup: item.group_name,
      itemCategory: item.category || '', itemSubcategory: item.subcategory || '',
      itemUnit: item.unit,
      variationValues: JSON.parse(variation.vals || '{}'),
      variationExtras: JSON.parse(variation.extras || '{}'),
      qty, stockBefore, stockAfter, date: now,
      supplier: '', requestedBy: o.requested_by || '',
      destination: o.destination_name || '',
      docRef: `OS #${o.number}`,
      note: `Material adicionado via OS #${o.number}`,
      operatorId, operatorName
    },
    newStock: stockAfter
  })
})

// DELETE /api/work-orders/:id/items/:itemId — remove material, revert stock
router.delete('/:id/items/:itemId', requireAuth, (req, res) => {
  const woi = db.prepare('SELECT * FROM work_order_items WHERE id = ? AND work_order_id = ?').get(req.params.itemId, req.params.id)
  if (!woi) return res.status(404).json({ error: 'Item da OS não encontrado' })

  const tx = db.transaction(() => {
    // Only revert stock and remove movement if it was an implicit movement (added directly via OS)
    // For linked movements (from saída flow), stock was already handled by the movement itself
    const isImplicit = woi.movement_id && db.prepare("SELECT doc_ref FROM movements WHERE id = ?").get(woi.movement_id)?.doc_ref?.startsWith('OS #')

    if (isImplicit) {
      // Revert stock
      const variation = db.prepare('SELECT stock FROM variations WHERE id = ?').get(woi.variation_id)
      if (variation) {
        db.prepare('UPDATE variations SET stock = ? WHERE id = ?').run(variation.stock + woi.qty, woi.variation_id)
      }
      // Remove the implicit movement
      db.prepare('DELETE FROM movements WHERE id = ?').run(woi.movement_id)
    }

    // Remove the work order item
    db.prepare('DELETE FROM work_order_items WHERE id = ?').run(woi.id)
  })

  tx()

  const newStock = db.prepare('SELECT stock FROM variations WHERE id = ?').get(woi.variation_id)
  res.json({
    ok: true,
    removedMovementId: woi.movement_id || null,
    variationId: woi.variation_id,
    newStock: newStock ? newStock.stock : null,
    implicit: !!woi.movement_id
  })
})

// POST /api/work-orders/:id/items/link — link an existing movement to a work order (no stock deduction)
router.post('/:id/items/link', requireAuth, (req, res) => {
  const o = db.prepare('SELECT * FROM work_orders WHERE id = ?').get(req.params.id)
  if (!o) return res.status(404).json({ error: 'Ordem de serviço não encontrada' })

  const { movementId } = req.body
  if (!movementId) return res.status(400).json({ error: 'movementId é obrigatório' })

  const mov = db.prepare('SELECT * FROM movements WHERE id = ?').get(movementId)
  if (!mov) return res.status(404).json({ error: 'Movimentação não encontrada' })

  const woiId = genId('osi')
  const now = new Date().toISOString()

  db.prepare(`INSERT INTO work_order_items (id, work_order_id, variation_id, item_id, item_name, item_group, item_category, item_unit, variation_values, qty, movement_id, added_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    woiId, o.id, mov.variation_id, mov.item_id,
    mov.item_name || '', mov.item_group || '', mov.item_category || '', mov.item_unit || '',
    mov.variation_values || '{}', mov.qty, mov.id, now
  )

  res.json({
    id: woiId,
    workOrderId: o.id,
    variationId: mov.variation_id,
    itemId: mov.item_id,
    itemName: mov.item_name || '',
    itemGroup: mov.item_group || '',
    itemCategory: mov.item_category || '',
    itemUnit: mov.item_unit || '',
    variationValues: JSON.parse(mov.variation_values || '{}'),
    qty: mov.qty,
    movementId: mov.id,
    addedAt: now,
  })
})

export default router
