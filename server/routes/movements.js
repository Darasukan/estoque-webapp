import { Router } from 'express'
import crypto from 'crypto'
import db from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

function movementField(line, fields, key) {
  return line[key] !== undefined ? line[key] : (fields[key] || '')
}

function toMovement(row) {
  return {
    id: row.id,
    type: row.type,
    variationId: row.variation_id,
    itemId: row.item_id,
    itemName: row.item_name,
    itemGroup: row.item_group,
    itemCategory: row.item_category,
    itemSubcategory: row.item_subcategory,
    itemUnit: row.item_unit,
    variationValues: JSON.parse(row.variation_values || '{}'),
    variationExtras: JSON.parse(row.variation_extras || '{}'),
    qty: row.qty,
    stockBefore: row.stock_before,
    stockAfter: row.stock_after,
    date: row.date,
    supplier: row.supplier,
    requestedBy: row.requested_by,
    destination: row.destination,
    docRef: row.doc_ref,
    note: row.note,
    operatorId: row.operator_id || '',
    operatorName: row.operator_name || ''
  }
}

function parsePositiveQty(qty) {
  const n = Number(qty)
  return Number.isFinite(n) && n > 0 ? n : null
}

// GET /api/movements
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM movements ORDER BY date DESC').all()
  res.json(rows.map(toMovement))
})

// POST /api/movements
router.post('/', requireAuth, (req, res) => {
  const m = req.body
  const operatorId = req.user?.id || ''
  const operatorName = req.user?.name || ''
  const qty = parsePositiveQty(m.qty)

  if (!m.type || !m.variationId || !m.itemId || !m.qty) {
    return res.status(400).json({ error: 'Campos obrigatorios: type, variationId, itemId, qty' })
  }
  if (!['entrada', 'saida'].includes(m.type)) {
    return res.status(400).json({ error: 'Tipo de movimentacao invalido.' })
  }
  if (!qty) {
    return res.status(400).json({ error: 'Quantidade deve ser positiva.' })
  }

  const variation = db.prepare('SELECT stock, item_id FROM variations WHERE id = ?').get(m.variationId)
  if (!variation) return res.status(404).json({ error: 'Variacao nao encontrada' })
  if (variation.item_id !== m.itemId) {
    return res.status(400).json({ error: 'Variacao nao pertence ao item informado.' })
  }

  const stockBefore = variation.stock
  const stockAfter = m.type === 'entrada' ? stockBefore + qty : stockBefore - qty
  if (stockAfter < 0) return res.status(400).json({ error: 'Estoque insuficiente para essa saida.' })

  const id = 'mov_' + crypto.randomBytes(6).toString('hex')
  const date = m.date || new Date().toISOString()

  const createMovement = db.transaction(() => {
    db.prepare('UPDATE variations SET stock = ? WHERE id = ?').run(stockAfter, m.variationId)
    db.prepare(`INSERT INTO movements (id, type, variation_id, item_id, item_name, item_group, item_category, item_subcategory, item_unit, variation_values, variation_extras, qty, stock_before, stock_after, date, supplier, requested_by, destination, doc_ref, note, operator_id, operator_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, m.type, m.variationId, m.itemId,
      m.itemName || '', m.itemGroup || '', m.itemCategory || '', m.itemSubcategory || '', m.itemUnit || '',
      JSON.stringify(m.variationValues || {}), JSON.stringify(m.variationExtras || {}),
      qty, stockBefore, stockAfter,
      date,
      m.supplier || '', m.requestedBy || '', m.destination || '', m.docRef || '', m.note || '',
      operatorId, operatorName
    )
  })
  createMovement()

  res.json({
    id,
    type: m.type,
    variationId: m.variationId,
    itemId: m.itemId,
    itemName: m.itemName,
    itemGroup: m.itemGroup,
    itemCategory: m.itemCategory,
    itemSubcategory: m.itemSubcategory,
    itemUnit: m.itemUnit,
    variationValues: m.variationValues || {},
    variationExtras: m.variationExtras || {},
    qty,
    stockBefore,
    stockAfter,
    date,
    supplier: m.supplier || '',
    requestedBy: m.requestedBy || '',
    destination: m.destination || '',
    docRef: m.docRef || '',
    note: m.note || '',
    operatorId,
    operatorName
  })
})

// POST /api/movements/batch
router.post('/batch', requireAuth, (req, res) => {
  const { type, items = [], fields = {} } = req.body
  const operatorId = req.user?.id || ''
  const operatorName = req.user?.name || ''

  if (!['entrada', 'saida'].includes(type)) {
    return res.status(400).json({ error: 'Tipo de movimentacao invalido.' })
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Informe ao menos um item.' })
  }

  const liveStockByVariation = new Map()
  const prepared = []

  for (const item of items) {
    const qty = parsePositiveQty(item.qty)
    if (!item.variationId || !item.itemId || !qty) {
      return res.status(400).json({ error: 'Itens do lote precisam de variationId, itemId e qty positiva.' })
    }

    const variation = db.prepare('SELECT stock, item_id FROM variations WHERE id = ?').get(item.variationId)
    if (!variation) return res.status(404).json({ error: `Variacao nao encontrada: ${item.variationId}` })
    if (variation.item_id !== item.itemId) {
      return res.status(400).json({ error: 'Variacao nao pertence ao item informado.' })
    }

    const stockBefore = liveStockByVariation.has(item.variationId)
      ? liveStockByVariation.get(item.variationId)
      : variation.stock
    const stockAfter = type === 'entrada' ? stockBefore + qty : stockBefore - qty
    if (stockAfter < 0) return res.status(400).json({ error: `Estoque insuficiente para ${item.itemName || 'item do lote'}.` })

    liveStockByVariation.set(item.variationId, stockAfter)
    prepared.push({ item, qty, stockBefore, stockAfter })
  }

  const date = fields.date || new Date().toISOString()
  const created = []

  const createBatch = db.transaction(() => {
    for (const [variationId, stock] of liveStockByVariation.entries()) {
      db.prepare('UPDATE variations SET stock = ? WHERE id = ?').run(stock, variationId)
    }

    for (const line of prepared) {
      const m = line.item
      const id = 'mov_' + crypto.randomBytes(6).toString('hex')
      const supplier = movementField(m, fields, 'supplier')
      const requestedBy = movementField(m, fields, 'requestedBy')
      const destination = movementField(m, fields, 'destination')
      const docRef = movementField(m, fields, 'docRef')
      const note = movementField(m, fields, 'note')
      db.prepare(`INSERT INTO movements (id, type, variation_id, item_id, item_name, item_group, item_category, item_subcategory, item_unit, variation_values, variation_extras, qty, stock_before, stock_after, date, supplier, requested_by, destination, doc_ref, note, operator_id, operator_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        id, type, m.variationId, m.itemId,
        m.itemName || '', m.itemGroup || '', m.itemCategory || '', m.itemSubcategory || '', m.itemUnit || '',
        JSON.stringify(m.variationValues || {}), JSON.stringify(m.variationExtras || {}),
        line.qty, line.stockBefore, line.stockAfter,
        date,
        supplier, requestedBy, destination, docRef, note,
        operatorId, operatorName
      )
      created.push({
        id,
        type,
        variationId: m.variationId,
        itemId: m.itemId,
        itemName: m.itemName || '',
        itemGroup: m.itemGroup || '',
        itemCategory: m.itemCategory || '',
        itemSubcategory: m.itemSubcategory || '',
        itemUnit: m.itemUnit || '',
        variationValues: m.variationValues || {},
        variationExtras: m.variationExtras || {},
        qty: line.qty,
        stockBefore: line.stockBefore,
        stockAfter: line.stockAfter,
        date,
        supplier,
        requestedBy,
        destination,
        docRef,
        note,
        operatorId,
        operatorName,
      })
    }
  })

  createBatch()
  res.json({ movements: created })
})

// PUT /api/movements/:id
router.put('/:id', requireAuth, requireRole('admin'), (req, res) => {
  const m = db.prepare('SELECT * FROM movements WHERE id = ?').get(req.params.id)
  if (!m) return res.status(404).json({ error: 'Movimentacao nao encontrada' })

  const changes = req.body
  const oldQty = m.qty
  const newQty = changes.qty !== undefined ? parsePositiveQty(changes.qty) : oldQty
  if (!newQty) return res.status(400).json({ error: 'Quantidade deve ser positiva.' })

  let newStock = null
  if (newQty !== oldQty) {
    const variation = db.prepare('SELECT stock FROM variations WHERE id = ?').get(m.variation_id)
    if (variation) {
      const diff = newQty - oldQty
      newStock = m.type === 'entrada' ? variation.stock + diff : variation.stock - diff
      if (newStock < 0) return res.status(400).json({ error: 'Estoque ficaria negativo com essa quantidade.' })
    }
  }

  const stockAfter = m.stock_before + (m.type === 'entrada' ? newQty : -newQty)

  const updateMovement = db.transaction(() => {
    if (newStock !== null) {
      db.prepare('UPDATE variations SET stock = ? WHERE id = ?').run(newStock, m.variation_id)
    }
    db.prepare(`UPDATE movements SET qty=?, stock_after=?, date=?, supplier=?, requested_by=?, destination=?, doc_ref=?, note=? WHERE id=?`).run(
      newQty,
      stockAfter,
      changes.date !== undefined ? changes.date : m.date,
      changes.supplier !== undefined ? changes.supplier : m.supplier,
      changes.requestedBy !== undefined ? changes.requestedBy : m.requested_by,
      changes.destination !== undefined ? changes.destination : m.destination,
      changes.docRef !== undefined ? changes.docRef : m.doc_ref,
      changes.note !== undefined ? changes.note : m.note,
      req.params.id
    )
  })
  updateMovement()

  const updated = db.prepare('SELECT * FROM movements WHERE id = ?').get(req.params.id)
  res.json(toMovement(updated))
})

// DELETE /api/movements/:id
router.delete('/:id', requireAuth, (req, res) => {
  const m = db.prepare('SELECT * FROM movements WHERE id = ?').get(req.params.id)
  if (!m) return res.status(404).json({ error: 'Movimentacao nao encontrada' })

  const variation = db.prepare('SELECT stock FROM variations WHERE id = ?').get(m.variation_id)
  if (!variation) return res.status(404).json({ error: 'Variacao nao encontrada' })

  const newStock = m.type === 'entrada'
    ? variation.stock - m.qty
    : variation.stock + m.qty
  if (newStock < 0) {
    return res.status(400).json({ error: 'Nao e possivel excluir esta entrada porque o estoque ficaria negativo.' })
  }

  const linkedItems = db.prepare('SELECT id FROM work_order_items WHERE movement_id = ?').all(req.params.id)
  const removedWorkOrderItemIds = linkedItems.map(i => i.id)

  const removeMovement = db.transaction(() => {
    db.prepare('UPDATE variations SET stock = ? WHERE id = ?').run(newStock, m.variation_id)
    db.prepare('DELETE FROM work_order_items WHERE movement_id = ?').run(req.params.id)
    db.prepare('DELETE FROM movements WHERE id = ?').run(req.params.id)
  })
  removeMovement()

  res.json({
    ok: true,
    variationId: m.variation_id,
    newStock,
    removedWorkOrderItemIds,
  })
})

export default router
