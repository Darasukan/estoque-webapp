import { Router } from 'express'
import crypto from 'crypto'
import db from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// GET /api/movements
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM movements ORDER BY date DESC').all()
  res.json(rows.map(r => ({
    id: r.id,
    type: r.type,
    variationId: r.variation_id,
    itemId: r.item_id,
    itemName: r.item_name,
    itemGroup: r.item_group,
    itemCategory: r.item_category,
    itemSubcategory: r.item_subcategory,
    itemUnit: r.item_unit,
    variationValues: JSON.parse(r.variation_values || '{}'),
    variationExtras: JSON.parse(r.variation_extras || '{}'),
    qty: r.qty,
    stockBefore: r.stock_before,
    stockAfter: r.stock_after,
    date: r.date,
    supplier: r.supplier,
    requestedBy: r.requested_by,
    destination: r.destination,
    docRef: r.doc_ref,
    note: r.note,
    operatorId: r.operator_id || '',
    operatorName: r.operator_name || ''
  })))
})

// POST /api/movements
router.post('/', requireAuth, (req, res) => {
  const m = req.body
  const operatorId = req.user?.id || ''
  const operatorName = req.user?.name || ''
  if (!m.type || !m.variationId || !m.itemId || !m.qty) {
    return res.status(400).json({ error: 'Campos obrigatórios: type, variationId, itemId, qty' })
  }

  // Get current variation stock
  const variation = db.prepare('SELECT stock FROM variations WHERE id = ?').get(m.variationId)
  if (!variation) return res.status(404).json({ error: 'Variação não encontrada' })

  const stockBefore = variation.stock
  const stockAfter = m.type === 'entrada' ? stockBefore + m.qty : stockBefore - m.qty

  // Update variation stock
  db.prepare('UPDATE variations SET stock = ? WHERE id = ?').run(stockAfter, m.variationId)

  const id = 'mov_' + crypto.randomBytes(6).toString('hex')
  db.prepare(`INSERT INTO movements (id, type, variation_id, item_id, item_name, item_group, item_category, item_subcategory, item_unit, variation_values, variation_extras, qty, stock_before, stock_after, date, supplier, requested_by, destination, doc_ref, note, operator_id, operator_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, m.type, m.variationId, m.itemId,
    m.itemName || '', m.itemGroup || '', m.itemCategory || '', m.itemSubcategory || '', m.itemUnit || '',
    JSON.stringify(m.variationValues || {}), JSON.stringify(m.variationExtras || {}),
    m.qty, stockBefore, stockAfter,
    m.date || new Date().toISOString(),
    m.supplier || '', m.requestedBy || '', m.destination || '', m.docRef || '', m.note || '',
    operatorId, operatorName
  )

  res.json({
    id, type: m.type, variationId: m.variationId, itemId: m.itemId,
    itemName: m.itemName, itemGroup: m.itemGroup, itemCategory: m.itemCategory,
    itemSubcategory: m.itemSubcategory, itemUnit: m.itemUnit,
    variationValues: m.variationValues || {}, variationExtras: m.variationExtras || {},
    qty: m.qty, stockBefore, stockAfter,
    date: m.date || new Date().toISOString(),
    supplier: m.supplier || '', requestedBy: m.requestedBy || '',
    destination: m.destination || '', docRef: m.docRef || '', note: m.note || '',
    operatorId: operatorId, operatorName: operatorName
  })
})

// PUT /api/movements/:id
router.put('/:id', (req, res) => {
  const m = db.prepare('SELECT * FROM movements WHERE id = ?').get(req.params.id)
  if (!m) return res.status(404).json({ error: 'Movimentação não encontrada' })

  const changes = req.body
  const oldQty = m.qty
  const newQty = changes.qty !== undefined ? Number(changes.qty) : oldQty
  if (!isFinite(newQty) || newQty <= 0) return res.status(400).json({ error: 'Quantidade deve ser positiva.' })

  // Adjust variation stock when qty changed
  if (newQty !== oldQty) {
    const variation = db.prepare('SELECT stock FROM variations WHERE id = ?').get(m.variation_id)
    if (variation) {
      const diff = newQty - oldQty
      const newStock = m.type === 'entrada' ? variation.stock + diff : variation.stock - diff
      if (newStock < 0) return res.status(400).json({ error: 'Estoque ficaria negativo com essa quantidade.' })
      db.prepare('UPDATE variations SET stock = ? WHERE id = ?').run(newStock, m.variation_id)
    }
  }

  const stockAfter = m.stock_before + (m.type === 'entrada' ? newQty : -newQty)

  db.prepare(`UPDATE movements SET qty=?, stock_after=?, date=?, supplier=?, requested_by=?, destination=?, doc_ref=?, note=? WHERE id=?`).run(
    newQty, stockAfter,
    changes.date !== undefined ? changes.date : m.date,
    changes.supplier !== undefined ? changes.supplier : m.supplier,
    changes.requestedBy !== undefined ? changes.requestedBy : m.requested_by,
    changes.destination !== undefined ? changes.destination : m.destination,
    changes.docRef !== undefined ? changes.docRef : m.doc_ref,
    changes.note !== undefined ? changes.note : m.note,
    req.params.id
  )

  const updated = db.prepare('SELECT * FROM movements WHERE id = ?').get(req.params.id)
  res.json({
    id: updated.id, type: updated.type, variationId: updated.variation_id,
    itemId: updated.item_id, itemName: updated.item_name, itemGroup: updated.item_group,
    itemCategory: updated.item_category, itemSubcategory: updated.item_subcategory,
    itemUnit: updated.item_unit,
    variationValues: JSON.parse(updated.variation_values || '{}'),
    variationExtras: JSON.parse(updated.variation_extras || '{}'),
    qty: updated.qty, stockBefore: updated.stock_before, stockAfter: updated.stock_after,
    date: updated.date, supplier: updated.supplier, requestedBy: updated.requested_by,
    destination: updated.destination, docRef: updated.doc_ref, note: updated.note,
    operatorId: updated.operator_id || '', operatorName: updated.operator_name || ''
  })
})

// DELETE /api/movements/:id
router.delete('/:id', (req, res) => {
  const m = db.prepare('SELECT * FROM movements WHERE id = ?').get(req.params.id)
  if (!m) return res.status(404).json({ error: 'Movimentação não encontrada' })
  db.prepare('DELETE FROM movements WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
