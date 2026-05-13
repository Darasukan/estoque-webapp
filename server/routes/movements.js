import { Router } from 'express'
import crypto from 'crypto'
import db from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { calculateStockAfter, parsePositiveQty } from '../utils/stockMath.js'

const router = Router()

function movementField(line, fields, key) {
  return line[key] !== undefined ? line[key] : (fields[key] || '')
}

function clean(value) {
  return String(value ?? '').trim()
}

function parseOptionalCostStrict(value) {
  if (value === undefined || value === null || value === '') return { ok: true, value: null }
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return { ok: false, error: 'Custo unitario deve ser zero ou positivo.' }
  return { ok: true, value: n }
}

function destinationFullName(row) {
  if (!row) return ''
  if (!row.parent_id) return row.name
  const parent = db.prepare('SELECT name FROM destinations WHERE id = ?').get(row.parent_id)
  return parent ? `${parent.name} > ${row.name}` : row.name
}

function findActiveDestinationByName(name) {
  const wanted = clean(name).toLowerCase()
  if (!wanted) return null
  const rows = db.prepare('SELECT * FROM destinations WHERE active = 1').all()
  return rows.find(row => destinationFullName(row).toLowerCase() === wanted || row.name.toLowerCase() === wanted) || null
}

function validateMovementDestination(fields) {
  const destination = clean(fields.destination)
  const destinationId = clean(fields.destinationId)
  const destinationOther = fields.destinationOther === true

  if (destinationOther) {
    if (!destination) return { ok: false, error: 'Destino "Outro" precisa de descricao.' }
    return { ok: true, destination }
  }

  if (destinationId) {
    const row = db.prepare('SELECT * FROM destinations WHERE id = ? AND active = 1').get(destinationId)
    if (!row) return { ok: false, error: 'Destino selecionado nao existe ou esta inativo.' }
    return { ok: true, destination: destinationFullName(row) }
  }

  const row = findActiveDestinationByName(destination)
  if (!row) return { ok: false, error: 'Selecione um destino cadastrado ou marque Outro.' }
  return { ok: true, destination: destinationFullName(row) }
}

function validateMovementPerson(fields) {
  const requestedBy = clean(fields.requestedBy)
  const requestedByPersonId = clean(fields.requestedByPersonId)
  const row = requestedByPersonId
    ? db.prepare('SELECT * FROM people WHERE id = ? AND active = 1').get(requestedByPersonId)
    : db.prepare('SELECT * FROM people WHERE lower(name) = lower(?) AND active = 1').get(requestedBy)

  if (!row) return { ok: false, error: 'Selecione uma pessoa cadastrada e ativa em Quem retirou.' }
  if (requestedBy && row.name.toLowerCase() !== requestedBy.toLowerCase()) {
    return { ok: false, error: 'Quem retirou nao confere com a pessoa cadastrada selecionada.' }
  }
  return { ok: true, requestedBy: row.name, requestedByPersonId: row.id }
}

function validateMovementSupplier(fields) {
  const supplier = clean(fields.supplier)
  if (!supplier) return { ok: true, supplier: '' }
  const row = db.prepare('SELECT * FROM suppliers WHERE lower(name) = lower(?)').get(supplier)
  if (!row) return { ok: false, error: 'Fornecedor precisa estar cadastrado antes de registrar a entrada.' }
  if (!row.active) return { ok: false, error: 'Fornecedor selecionado esta inativo.' }
  return { ok: true, supplier: row.name }
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
    unitCost: row.unit_cost ?? null,
    requestedBy: row.requested_by,
    requestedByPersonId: row.requested_by_person_id || '',
    destination: row.destination,
    docRef: row.doc_ref,
    note: row.note,
    operatorId: row.operator_id || '',
    operatorName: row.operator_name || ''
  }
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
  const stockAfter = calculateStockAfter(m.type, stockBefore, qty)
  if (stockAfter < 0) return res.status(400).json({ error: 'Estoque insuficiente para essa saida.' })

  const costValidation = parseOptionalCostStrict(m.unitCost)
  if (m.type === 'entrada' && !costValidation.ok) return res.status(400).json({ error: costValidation.error })
  const supplierValidation = m.type === 'entrada' ? validateMovementSupplier(m) : { ok: true, supplier: '' }
  if (!supplierValidation.ok) return res.status(400).json({ error: supplierValidation.error })
  const personValidation = m.type === 'saida' ? validateMovementPerson(m) : { ok: true, requestedBy: '', requestedByPersonId: '' }
  if (!personValidation.ok) return res.status(400).json({ error: personValidation.error })
  const destinationValidation = m.type === 'saida' ? validateMovementDestination(m) : { ok: true, destination: '' }
  if (!destinationValidation.ok) return res.status(400).json({ error: destinationValidation.error })

  const unitCost = m.type === 'entrada' ? costValidation.value : null

  const id = 'mov_' + crypto.randomBytes(6).toString('hex')
  const date = m.date || new Date().toISOString()

  const createMovement = db.transaction(() => {
    db.prepare('UPDATE variations SET stock = ? WHERE id = ?').run(stockAfter, m.variationId)
    db.prepare(`INSERT INTO movements (id, type, variation_id, item_id, item_name, item_group, item_category, item_subcategory, item_unit, variation_values, variation_extras, qty, stock_before, stock_after, date, supplier, unit_cost, requested_by, requested_by_person_id, destination, doc_ref, note, operator_id, operator_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, m.type, m.variationId, m.itemId,
      m.itemName || '', m.itemGroup || '', m.itemCategory || '', m.itemSubcategory || '', m.itemUnit || '',
      JSON.stringify(m.variationValues || {}), JSON.stringify(m.variationExtras || {}),
      qty, stockBefore, stockAfter,
      date,
      supplierValidation.supplier, unitCost, personValidation.requestedBy, personValidation.requestedByPersonId, destinationValidation.destination, m.docRef || '', m.note || '',
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
    supplier: supplierValidation.supplier,
    unitCost,
    requestedBy: personValidation.requestedBy,
    requestedByPersonId: personValidation.requestedByPersonId,
    destination: destinationValidation.destination,
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

  if (![undefined, null, '', 'mixed', 'entrada', 'saida'].includes(type)) {
    return res.status(400).json({ error: 'Tipo de movimentacao invalido.' })
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Informe ao menos um item.' })
  }

  const liveStockByVariation = new Map()
  const prepared = []

  for (const item of items) {
    const lineType = ['entrada', 'saida'].includes(item.type) ? item.type : type
    if (!['entrada', 'saida'].includes(lineType)) {
      return res.status(400).json({ error: 'Todos os itens do lote precisam de tipo entrada ou saida.' })
    }
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
    const stockAfter = calculateStockAfter(lineType, stockBefore, qty)
    if (stockAfter < 0) return res.status(400).json({ error: `Estoque insuficiente para ${item.itemName || 'item do lote'}.` })

    const rawFields = {
      supplier: movementField(item, fields, 'supplier'),
      requestedBy: movementField(item, fields, 'requestedBy'),
      requestedByPersonId: movementField(item, fields, 'requestedByPersonId'),
      destination: movementField(item, fields, 'destination'),
      destinationId: movementField(item, fields, 'destinationId'),
      destinationOther: item.destinationOther !== undefined ? item.destinationOther : fields.destinationOther,
    }
    const costValidation = parseOptionalCostStrict(item.unitCost !== undefined ? item.unitCost : fields.unitCost)
    if (lineType === 'entrada' && !costValidation.ok) return res.status(400).json({ error: costValidation.error })
    const supplierValidation = lineType === 'entrada' ? validateMovementSupplier(rawFields) : { ok: true, supplier: '' }
    if (!supplierValidation.ok) return res.status(400).json({ error: supplierValidation.error })
    const personValidation = lineType === 'saida' ? validateMovementPerson(rawFields) : { ok: true, requestedBy: '', requestedByPersonId: '' }
    if (!personValidation.ok) return res.status(400).json({ error: personValidation.error })
    const destinationValidation = lineType === 'saida' ? validateMovementDestination(rawFields) : { ok: true, destination: '' }
    if (!destinationValidation.ok) return res.status(400).json({ error: destinationValidation.error })

    liveStockByVariation.set(item.variationId, stockAfter)
    prepared.push({
      item,
      type: lineType,
      qty,
      stockBefore,
      stockAfter,
      supplier: supplierValidation.supplier,
      requestedBy: personValidation.requestedBy,
      requestedByPersonId: personValidation.requestedByPersonId,
      destination: destinationValidation.destination,
      unitCost: lineType === 'entrada' ? costValidation.value : null,
    })
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
      const supplier = line.supplier
      const requestedBy = line.requestedBy
      const requestedByPersonId = line.requestedByPersonId
      const destination = line.destination
      const docRef = movementField(m, fields, 'docRef')
      const note = movementField(m, fields, 'note')
      const unitCost = line.unitCost
      db.prepare(`INSERT INTO movements (id, type, variation_id, item_id, item_name, item_group, item_category, item_subcategory, item_unit, variation_values, variation_extras, qty, stock_before, stock_after, date, supplier, unit_cost, requested_by, requested_by_person_id, destination, doc_ref, note, operator_id, operator_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        id, line.type, m.variationId, m.itemId,
        m.itemName || '', m.itemGroup || '', m.itemCategory || '', m.itemSubcategory || '', m.itemUnit || '',
        JSON.stringify(m.variationValues || {}), JSON.stringify(m.variationExtras || {}),
        line.qty, line.stockBefore, line.stockAfter,
        date,
        supplier, unitCost, requestedBy, requestedByPersonId, destination, docRef, note,
        operatorId, operatorName
      )
      created.push({
        id,
        type: line.type,
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
        unitCost,
        requestedBy,
        requestedByPersonId,
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
  const costValidation = changes.unitCost !== undefined ? parseOptionalCostStrict(changes.unitCost) : { ok: true, value: m.unit_cost }
  if (m.type === 'entrada' && !costValidation.ok) return res.status(400).json({ error: costValidation.error })
  const supplierValidation = m.type === 'entrada' && changes.supplier !== undefined
    ? validateMovementSupplier({ supplier: changes.supplier })
    : { ok: true, supplier: m.supplier }
  if (!supplierValidation.ok) return res.status(400).json({ error: supplierValidation.error })
  const personValidation = m.type === 'saida' && (changes.requestedBy !== undefined || changes.requestedByPersonId !== undefined)
    ? validateMovementPerson({
        requestedBy: changes.requestedBy !== undefined ? changes.requestedBy : m.requested_by,
        requestedByPersonId: changes.requestedByPersonId !== undefined ? changes.requestedByPersonId : m.requested_by_person_id,
      })
    : { ok: true, requestedBy: m.requested_by, requestedByPersonId: m.requested_by_person_id }
  if (!personValidation.ok) return res.status(400).json({ error: personValidation.error })
  const destinationValidation = m.type === 'saida' && (changes.destination !== undefined || changes.destinationId !== undefined || changes.destinationOther !== undefined)
    ? validateMovementDestination({
        destination: changes.destination !== undefined ? changes.destination : m.destination,
        destinationId: changes.destinationId,
        destinationOther: changes.destinationOther,
      })
    : { ok: true, destination: m.destination }
  if (!destinationValidation.ok) return res.status(400).json({ error: destinationValidation.error })
  const unitCost = m.type === 'entrada' ? costValidation.value : null

  const updateMovement = db.transaction(() => {
    if (newStock !== null) {
      db.prepare('UPDATE variations SET stock = ? WHERE id = ?').run(newStock, m.variation_id)
    }
    db.prepare(`UPDATE movements SET qty=?, stock_after=?, date=?, supplier=?, unit_cost=?, requested_by=?, requested_by_person_id=?, destination=?, doc_ref=?, note=? WHERE id=?`).run(
      newQty,
      stockAfter,
      changes.date !== undefined ? changes.date : m.date,
      supplierValidation.supplier,
      unitCost,
      personValidation.requestedBy,
      personValidation.requestedByPersonId,
      destinationValidation.destination,
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
