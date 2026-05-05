import { Router } from 'express'
import db from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

function nowIso() {
  return new Date().toISOString()
}

// GET /api/seed/order - display order
router.get('/order', (req, res) => {
  const row = db.prepare('SELECT data FROM display_order WHERE id = 1').get()
  res.json(JSON.parse(row?.data || '{}'))
})

// PUT /api/seed/order - save display order
router.put('/order', requireAuth, (req, res) => {
  db.prepare('UPDATE display_order SET data = ? WHERE id = 1').run(JSON.stringify(req.body || {}))
  res.json({ ok: true })
})

// POST /api/seed/populate - load seed data (admin only)
router.post('/populate', requireAuth, requireRole('admin'), (req, res) => {
  const {
    items: seedItems,
    variations: seedVars,
    movements = [],
    destinations = [],
    locations = [],
    people = [],
    roles = [],
    workOrders = [],
    workOrderItems = [],
    workOrderEvents = [],
    motors = [],
    motorEvents = [],
  } = req.body
  if (!seedItems || !seedVars) return res.status(400).json({ error: 'items e variations obrigatorios' })

  const insertItem = db.prepare('INSERT OR REPLACE INTO items (id, name, group_name, category, subcategory, unit, min_stock, attributes, location) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
  const insertVar = db.prepare('INSERT OR REPLACE INTO variations (id, item_id, vals, stock, min_stock, initial_stock, extras, location, destinations) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
  const insertMovement = db.prepare(`INSERT OR REPLACE INTO movements (
    id, type, variation_id, item_id, item_name, item_group, item_category, item_subcategory,
    item_unit, variation_values, variation_extras, qty, stock_before, stock_after, date,
    supplier, requested_by, destination, doc_ref, note, operator_id, operator_name
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  const insertDestination = db.prepare('INSERT OR REPLACE INTO destinations (id, name, description, active, parent_id) VALUES (?, ?, ?, ?, ?)')
  const insertLocation = db.prepare('INSERT OR REPLACE INTO locations (id, name, description, active, parent_id) VALUES (?, ?, ?, ?, ?)')
  const insertPerson = db.prepare('INSERT OR REPLACE INTO people (id, name, role_text, active) VALUES (?, ?, ?, ?)')
  const insertRole = db.prepare('INSERT OR REPLACE INTO roles (id, name, description, active) VALUES (?, ?, ?, ?)')
  const insertMotor = db.prepare(`INSERT OR REPLACE INTO motors (
    id, tag, serial, name, manufacturer, power, voltage, rpm,
    destination_id, destination_name, status, notes, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  const insertWorkOrder = db.prepare(`INSERT OR REPLACE INTO work_orders (
    id, number, title, motor_id, destination_id, destination_name, equipment,
    motor_origin_destination_id, motor_origin_destination_name,
    maintenance_location_type, maintenance_destination_id, maintenance_destination_name,
    maintenance_external_location, service_type, request_date, request_time,
    requested_by, note, maintenance_start_date, maintenance_start_time,
    maintenance_end_date, maintenance_end_time, maintenance_professional,
    maintenance_materials, maintenance_note, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  const insertWorkOrderItem = db.prepare(`INSERT OR REPLACE INTO work_order_items (
    id, work_order_id, variation_id, item_id, item_name, item_group, item_category,
    item_unit, variation_values, qty, movement_id, added_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  const insertWorkOrderEvent = db.prepare(`INSERT OR REPLACE INTO work_order_events (
    id, work_order_id, event_type, event_date, operator_id, operator_name,
    from_value, to_value, notes, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  const insertMotorEvent = db.prepare(`INSERT OR REPLACE INTO motor_events (
    id, motor_id, work_order_id, event_type, event_date, from_destination,
    to_destination, performed_by, notes, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)

  const tx = db.transaction(() => {
    db.exec(`
      DELETE FROM work_order_events;
      DELETE FROM work_order_items;
      DELETE FROM motor_events;
      DELETE FROM work_orders;
      DELETE FROM motors;
      DELETE FROM monthly_closings;
      DELETE FROM movements;
      DELETE FROM variations;
      DELETE FROM items;
      DELETE FROM locations;
      DELETE FROM destinations;
      DELETE FROM people;
      DELETE FROM roles;
      UPDATE display_order SET data = '{}' WHERE id = 1;
    `)

    for (const r of roles) {
      insertRole.run(r.id, r.name, r.description || '', r.active !== false ? 1 : 0)
    }
    for (const p of people) {
      insertPerson.run(p.id, p.name, p.role || '', p.active !== false ? 1 : 0)
    }
    for (const l of locations) {
      insertLocation.run(l.id, l.name, l.description || '', l.active !== false ? 1 : 0, l.parentId || null)
    }
    for (const d of destinations) {
      insertDestination.run(d.id, d.name, d.description || '', d.active !== false ? 1 : 0, d.parentId || null)
    }
    for (const i of seedItems) {
      insertItem.run(i.id, i.name, i.group, i.category || null, i.subcategory || null, i.unit || 'UN', i.minStock || 0, JSON.stringify(i.attributes || []), i.location || '')
    }
    for (const v of seedVars) {
      const s = v.stock || 0
      insertVar.run(v.id, v.itemId, JSON.stringify(v.values || {}), s, v.minStock || 0, v.initialStock !== undefined ? v.initialStock : s, JSON.stringify(v.extras || {}), v.location || '', JSON.stringify(v.destinations || []))
    }
    for (const m of movements) {
      insertMovement.run(
        m.id, m.type, m.variationId, m.itemId,
        m.itemName || '', m.itemGroup || '', m.itemCategory || '', m.itemSubcategory || '',
        m.itemUnit || '', JSON.stringify(m.variationValues || {}), JSON.stringify(m.variationExtras || {}),
        m.qty || 0, m.stockBefore || 0, m.stockAfter || 0, m.date || nowIso(),
        m.supplier || '', m.requestedBy || '', m.destination || '', m.docRef || '', m.note || '',
        m.operatorId || '', m.operatorName || ''
      )
    }
    for (const m of motors) {
      insertMotor.run(
        m.id, m.tag, m.serial || '', m.name || '', m.manufacturer || '', m.power || '', m.voltage || '', m.rpm || '',
        m.destinationId || '', m.destinationName || '', m.status || 'ativo', m.notes || '',
        m.createdAt || nowIso(), m.updatedAt || m.createdAt || nowIso()
      )
    }
    for (const o of workOrders) {
      insertWorkOrder.run(
        o.id, o.number, o.title || `OS #${o.number}`, o.motorId || '', o.destinationId || '',
        o.destinationName || '', o.equipment || '',
        o.motorOriginDestinationId || '', o.motorOriginDestinationName || '',
        o.maintenanceLocationType || '', o.maintenanceDestinationId || '',
        o.maintenanceDestinationName || '', o.maintenanceExternalLocation || '',
        o.serviceType || 'Outros', o.requestDate || '', o.requestTime || '',
        o.requestedBy || '', o.note || '', o.maintenanceStartDate || '',
        o.maintenanceStartTime || '', o.maintenanceEndDate || '',
        o.maintenanceEndTime || '', o.maintenanceProfessional || '',
        o.maintenanceMaterials || '', o.maintenanceNote || '',
        o.createdAt || nowIso()
      )
    }
    for (const item of workOrderItems) {
      insertWorkOrderItem.run(
        item.id, item.workOrderId, item.variationId, item.itemId,
        item.itemName || '', item.itemGroup || '', item.itemCategory || '',
        item.itemUnit || '', JSON.stringify(item.variationValues || {}),
        item.qty || 0, item.movementId || '', item.addedAt || nowIso()
      )
    }
    for (const event of workOrderEvents) {
      insertWorkOrderEvent.run(
        event.id, event.workOrderId, event.eventType, event.eventDate || nowIso(),
        event.operatorId || '', event.operatorName || '', event.fromValue || '',
        event.toValue || '', event.notes || '', event.createdAt || event.eventDate || nowIso()
      )
    }
    for (const event of motorEvents) {
      insertMotorEvent.run(
        event.id, event.motorId, event.workOrderId || '', event.eventType,
        event.eventDate || nowIso(), event.fromDestination || '',
        event.toDestination || '', event.performedBy || '', event.notes || '',
        event.createdAt || event.eventDate || nowIso()
      )
    }
  })

  tx()
  res.json({
    ok: true,
    items: seedItems.length,
    variations: seedVars.length,
    movements: movements.length,
    destinations: destinations.length,
    locations: locations.length,
    people: people.length,
    roles: roles.length,
    workOrders: workOrders.length,
    workOrderItems: workOrderItems.length,
    workOrderEvents: workOrderEvents.length,
    motors: motors.length,
    motorEvents: motorEvents.length,
  })
})

// POST /api/seed/reset - clear all data (admin only)
router.post('/reset', requireAuth, requireRole('admin'), (req, res) => {
  db.exec(`
    DELETE FROM work_order_events;
    DELETE FROM work_order_items;
    DELETE FROM motor_events;
    DELETE FROM work_orders;
    DELETE FROM motors;
    DELETE FROM monthly_closings;
    DELETE FROM movements;
    DELETE FROM variations;
    DELETE FROM items;
    DELETE FROM locations;
    DELETE FROM destinations;
    DELETE FROM people;
    DELETE FROM roles;
    UPDATE display_order SET data = '{}' WHERE id = 1;
  `)
  res.json({ ok: true })
})

export default router
