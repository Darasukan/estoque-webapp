import { Router } from 'express'
import crypto from 'crypto'
import db from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

function genId(prefix) {
  return prefix + '_' + crypto.randomBytes(6).toString('hex')
}

function clean(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeServiceType(value) {
  const normalized = clean(value).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  if (normalized === 'eletrica') return 'Elétrica'
  if (normalized === 'mecanica') return 'Mecânica'
  return 'Outros'
}

function parseOrderNumber(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : NaN
}

function validateMaintenanceDates({
  maintenanceStartDate,
  maintenanceStartTime,
  maintenanceEndDate,
  maintenanceEndTime,
}) {
  const hasStartDate = !!clean(maintenanceStartDate)
  const hasStartTime = !!clean(maintenanceStartTime)
  const hasEndDate = !!clean(maintenanceEndDate)
  const hasEndTime = !!clean(maintenanceEndTime)
  if (hasStartDate !== hasStartTime) return 'Informe data e horário de início da manutenção'
  if (hasEndDate !== hasEndTime) return 'Informe data e horário de término da manutenção'
  if ((hasEndDate || hasEndTime) && !(hasStartDate && hasStartTime)) return 'Informe início antes do término da manutenção'
  if (hasStartDate && hasEndDate) {
    const start = new Date(`${clean(maintenanceStartDate)}T${clean(maintenanceStartTime)}`)
    const end = new Date(`${clean(maintenanceEndDate)}T${clean(maintenanceEndTime)}`)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'Datas de manutenção inválidas'
    if (end < start) return 'Término não pode ser antes do início da manutenção'
  }
  return ''
}

function resolveDestinationName(destinationId) {
  if (!destinationId) return ''
  const dest = db.prepare('SELECT * FROM destinations WHERE id = ?').get(destinationId)
  if (!dest) return ''
  if (!dest.parent_id) return dest.name
  const parent = db.prepare('SELECT name FROM destinations WHERE id = ?').get(dest.parent_id)
  return parent ? `${parent.name} > ${dest.name}` : dest.name
}

function buildTitle({ title, serviceType, equipment, destinationName, number }) {
  const typedTitle = clean(title)
  if (typedTitle) return typedTitle
  const subject = equipment || destinationName || `OS #${number}`
  return `${serviceType || 'Outros'} - ${subject}`
}

function mapWorkOrder(r) {
  const motor = r.motor_id ? db.prepare('SELECT id, tag, name, status FROM motors WHERE id = ?').get(r.motor_id) : null
  return {
    id: r.id,
    number: r.number,
    title: r.title,
    motorId: r.motor_id || '',
    motorTag: motor?.tag || '',
    motorName: motor?.name || '',
    motorStatus: motor?.status || '',
    destinationId: r.destination_id,
    destinationName: r.destination_name,
    equipment: r.equipment || r.destination_name || '',
    serviceType: r.service_type || 'Outros',
    requestDate: r.request_date || '',
    requestTime: r.request_time || '',
    requestedBy: r.requested_by,
    note: r.note,
    maintenanceStartDate: r.maintenance_start_date || '',
    maintenanceStartTime: r.maintenance_start_time || '',
    maintenanceEndDate: r.maintenance_end_date || '',
    maintenanceEndTime: r.maintenance_end_time || '',
    maintenanceProfessional: r.maintenance_professional || '',
    maintenanceMaterials: r.maintenance_materials || '',
    maintenanceNote: r.maintenance_note || '',
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
  const {
    title,
    number: rawNumber,
    destinationId,
    motorId,
    requestedBy,
    note,
    equipment,
    serviceType,
    requestDate,
    requestTime,
    maintenanceStartDate,
    maintenanceStartTime,
    maintenanceEndDate,
    maintenanceEndTime,
    maintenanceProfessional,
    maintenanceMaterials,
    maintenanceNote,
  } = req.body

  if (!clean(requestedBy)) return res.status(400).json({ error: 'Solicitante é obrigatório' })
  if (!clean(requestDate)) return res.status(400).json({ error: 'Data é obrigatória' })
  if (!clean(requestTime)) return res.status(400).json({ error: 'Horário é obrigatório' })
  const maintenanceError = validateMaintenanceDates({ maintenanceStartDate, maintenanceStartTime, maintenanceEndDate, maintenanceEndTime })
  if (maintenanceError) return res.status(400).json({ error: maintenanceError })

  const parsedNumber = parseOrderNumber(rawNumber)
  if (Number.isNaN(parsedNumber)) return res.status(400).json({ error: 'Número da ordem inválido' })

  const maxRow = db.prepare('SELECT MAX(number) as maxNum FROM work_orders').get()
  const number = parsedNumber || (maxRow.maxNum || 0) + 1
  const numberExists = db.prepare('SELECT id FROM work_orders WHERE number = ?').get(number)
  if (numberExists) return res.status(409).json({ error: 'Número da ordem já existe' })

  const motor = clean(motorId) ? db.prepare('SELECT * FROM motors WHERE id = ?').get(clean(motorId)) : null
  if (clean(motorId) && !motor) return res.status(400).json({ error: 'Motor nao encontrado' })

  let destinationName = resolveDestinationName(destinationId)
  const equipmentValue = clean(equipment) || motor?.tag || destinationName
  if (!equipmentValue) return res.status(400).json({ error: 'Equipamento é obrigatório' })
  if (!destinationName) destinationName = equipmentValue

  const serviceTypeValue = normalizeServiceType(serviceType)
  const titleValue = buildTitle({ title, serviceType: serviceTypeValue, equipment: equipmentValue, destinationName, number })

  const id = genId('os')
  const createdAt = new Date().toISOString()

  db.prepare(`INSERT INTO work_orders (
    id, number, title, motor_id, destination_id, destination_name, equipment, service_type, request_date, request_time,
    requested_by, note, maintenance_start_date, maintenance_start_time, maintenance_end_date,
    maintenance_end_time, maintenance_professional, maintenance_materials, maintenance_note, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, number, titleValue, clean(motorId), destinationId || '', destinationName, equipmentValue, serviceTypeValue,
    clean(requestDate), clean(requestTime), clean(requestedBy), note || '',
    clean(maintenanceStartDate), clean(maintenanceStartTime), clean(maintenanceEndDate), clean(maintenanceEndTime),
    clean(maintenanceProfessional), maintenanceMaterials || '', maintenanceNote || '', createdAt
  )

  res.json({
    id, number, title: titleValue,
    motorId: clean(motorId), motorTag: motor?.tag || '', motorName: motor?.name || '', motorStatus: motor?.status || '',
    destinationId: destinationId || '', destinationName,
    equipment: equipmentValue, serviceType: serviceTypeValue,
    requestDate: clean(requestDate), requestTime: clean(requestTime),
    requestedBy: clean(requestedBy), note: note || '',
    maintenanceStartDate: clean(maintenanceStartDate),
    maintenanceStartTime: clean(maintenanceStartTime),
    maintenanceEndDate: clean(maintenanceEndDate),
    maintenanceEndTime: clean(maintenanceEndTime),
    maintenanceProfessional: clean(maintenanceProfessional),
    maintenanceMaterials: maintenanceMaterials || '',
    maintenanceNote: maintenanceNote || '',
    createdAt, items: []
  })
})

// PUT /api/work-orders/:id — update
router.put('/:id', requireAuth, (req, res) => {
  const o = db.prepare('SELECT * FROM work_orders WHERE id = ?').get(req.params.id)
  if (!o) return res.status(404).json({ error: 'Ordem de serviço não encontrada' })

  const {
    title,
    number: rawNumber,
    destinationId,
    motorId,
    requestedBy,
    note,
    equipment,
    serviceType,
    requestDate,
    requestTime,
    maintenanceStartDate,
    maintenanceStartTime,
    maintenanceEndDate,
    maintenanceEndTime,
    maintenanceProfessional,
    maintenanceMaterials,
    maintenanceNote,
  } = req.body

  const newDestId = destinationId !== undefined ? destinationId : o.destination_id
  const newMotorId = motorId !== undefined ? clean(motorId) : (o.motor_id || '')
  const motor = newMotorId ? db.prepare('SELECT * FROM motors WHERE id = ?').get(newMotorId) : null
  if (newMotorId && !motor) return res.status(400).json({ error: 'Motor nao encontrado' })
  const parsedNumber = parseOrderNumber(rawNumber)
  if (Number.isNaN(parsedNumber)) return res.status(400).json({ error: 'Número da ordem inválido' })
  const nextNumber = parsedNumber || o.number
  const numberExists = db.prepare('SELECT id FROM work_orders WHERE number = ? AND id != ?').get(nextNumber, req.params.id)
  if (numberExists) return res.status(409).json({ error: 'Número da ordem já existe' })

  let destinationName = resolveDestinationName(newDestId)
  const equipmentValue = equipment !== undefined ? clean(equipment) : (o.equipment || motor?.tag || o.destination_name || '')
  if (!destinationName) destinationName = equipmentValue || o.destination_name

  const serviceTypeValue = serviceType !== undefined ? normalizeServiceType(serviceType) : (o.service_type || 'Outros')
  const requestDateValue = requestDate !== undefined ? clean(requestDate) : (o.request_date || '')
  const requestTimeValue = requestTime !== undefined ? clean(requestTime) : (o.request_time || '')
  const requestedByValue = requestedBy !== undefined ? clean(requestedBy) : o.requested_by

  if (!requestedByValue) return res.status(400).json({ error: 'Solicitante é obrigatório' })
  if (!requestDateValue) return res.status(400).json({ error: 'Data é obrigatória' })
  if (!requestTimeValue) return res.status(400).json({ error: 'Horário é obrigatório' })
  if (!equipmentValue) return res.status(400).json({ error: 'Equipamento é obrigatório' })
  const maintenanceError = validateMaintenanceDates({
    maintenanceStartDate: maintenanceStartDate !== undefined ? maintenanceStartDate : (o.maintenance_start_date || ''),
    maintenanceStartTime: maintenanceStartTime !== undefined ? maintenanceStartTime : (o.maintenance_start_time || ''),
    maintenanceEndDate: maintenanceEndDate !== undefined ? maintenanceEndDate : (o.maintenance_end_date || ''),
    maintenanceEndTime: maintenanceEndTime !== undefined ? maintenanceEndTime : (o.maintenance_end_time || ''),
  })
  if (maintenanceError) return res.status(400).json({ error: maintenanceError })

  const titleValue = buildTitle({
    title: title !== undefined ? title : o.title,
    serviceType: serviceTypeValue,
    equipment: equipmentValue,
    destinationName,
    number: nextNumber,
  })

  db.prepare(`UPDATE work_orders SET
    number=?, title=?, motor_id=?, destination_id=?, destination_name=?, equipment=?, service_type=?,
    request_date=?, request_time=?, requested_by=?, note=?,
    maintenance_start_date=?, maintenance_start_time=?, maintenance_end_date=?,
    maintenance_end_time=?, maintenance_professional=?, maintenance_materials=?, maintenance_note=?
    WHERE id=?`).run(
    nextNumber,
    titleValue,
    newMotorId,
    newDestId,
    destinationName,
    equipmentValue,
    serviceTypeValue,
    requestDateValue,
    requestTimeValue,
    requestedByValue,
    note !== undefined ? note : o.note,
    maintenanceStartDate !== undefined ? clean(maintenanceStartDate) : (o.maintenance_start_date || ''),
    maintenanceStartTime !== undefined ? clean(maintenanceStartTime) : (o.maintenance_start_time || ''),
    maintenanceEndDate !== undefined ? clean(maintenanceEndDate) : (o.maintenance_end_date || ''),
    maintenanceEndTime !== undefined ? clean(maintenanceEndTime) : (o.maintenance_end_time || ''),
    maintenanceProfessional !== undefined ? clean(maintenanceProfessional) : (o.maintenance_professional || ''),
    maintenanceMaterials !== undefined ? maintenanceMaterials : (o.maintenance_materials || ''),
    maintenanceNote !== undefined ? maintenanceNote : (o.maintenance_note || ''),
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

  const workOrderItems = db.prepare('SELECT * FROM work_order_items WHERE work_order_id = ?').all(req.params.id)
  const removedMovementIds = []
  const restoredStockByVariation = new Map()

  const tx = db.transaction(() => {
    for (const item of workOrderItems) {
      if (!item.movement_id) continue
      const movement = db.prepare('SELECT doc_ref FROM movements WHERE id = ?').get(item.movement_id)
      const isImplicit = movement?.doc_ref?.startsWith('OS #')
      if (!isImplicit) continue

      const variation = db.prepare('SELECT stock FROM variations WHERE id = ?').get(item.variation_id)
      if (variation) {
        const newStock = variation.stock + item.qty
        db.prepare('UPDATE variations SET stock = ? WHERE id = ?').run(newStock, item.variation_id)
        restoredStockByVariation.set(item.variation_id, newStock)
      }
      db.prepare('DELETE FROM movements WHERE id = ?').run(item.movement_id)
      removedMovementIds.push(item.movement_id)
    }

    db.prepare('DELETE FROM work_orders WHERE id = ?').run(req.params.id)
  })

  tx()

  res.json({
    ok: true,
    removedMovementIds,
    restoredStock: Array.from(restoredStockByVariation.entries()).map(([variationId, newStock]) => ({ variationId, newStock })),
  })
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
  const withdrawnBy = o.maintenance_professional || o.requested_by || ''

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
      '', withdrawnBy, o.destination_name || '',
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
      supplier: '', requestedBy: withdrawnBy,
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
