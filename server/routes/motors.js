import { Router } from 'express'
import crypto from 'crypto'
import db from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

const MOTOR_STATUSES = new Set(['ativo', 'em_manutencao', 'reserva', 'inativo'])
const EVENT_TYPES = new Set(['rebobinado', 'reformado', 'revisado', 'enrolado', 'enrolar', 'instalado', 'removido', 'movimentado', 'inativado', 'reativado', 'observacao'])

function genId(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`
}

function clean(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function addWorkOrderEvent(workOrderId, eventType, req, fields = {}) {
  if (!workOrderId) return
  const eventDate = fields.eventDate || nowIso()
  db.prepare(`INSERT INTO work_order_events (
    id, work_order_id, event_type, event_date, operator_id, operator_name,
    from_value, to_value, notes, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    genId('woe'),
    workOrderId,
    eventType,
    eventDate,
    req?.user?.id || '',
    req?.user?.name || '',
    fields.fromValue || '',
    fields.toValue || '',
    fields.notes || '',
    nowIso()
  )
}

function nowIso() {
  return new Date().toISOString()
}

function resolveDestinationName(destinationId) {
  if (!destinationId) return ''
  const dest = db.prepare('SELECT * FROM destinations WHERE id = ?').get(destinationId)
  if (!dest) return ''
  if (!dest.parent_id) return dest.name
  const parent = db.prepare('SELECT name FROM destinations WHERE id = ?').get(dest.parent_id)
  return parent ? `${parent.name} > ${dest.name}` : dest.name
}

function mapMotor(row) {
  const counts = db.prepare(`
    SELECT event_type, COUNT(*) as count
    FROM motor_events
    WHERE motor_id = ? AND event_type IN ('rebobinado','reformado','revisado')
    GROUP BY event_type
  `).all(row.id)
  const eventCounts = { rebobinado: 0, reformado: 0, revisado: 0 }
  for (const c of counts) eventCounts[c.event_type] = c.count

  return {
    id: row.id,
    tag: row.tag,
    serial: row.serial || '',
    name: row.name || '',
    manufacturer: row.manufacturer || '',
    power: row.power || '',
    voltage: row.voltage || '',
    rpm: row.rpm || '',
    destinationId: row.destination_id || '',
    destinationName: row.destination_name || '',
    status: row.status || 'ativo',
    notes: row.notes || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    eventCounts,
  }
}

function mapEvent(row) {
  return {
    id: row.id,
    motorId: row.motor_id,
    workOrderId: row.work_order_id || '',
    eventType: row.event_type,
    eventDate: row.event_date,
    fromDestination: row.from_destination || '',
    toDestination: row.to_destination || '',
    performedBy: row.performed_by || '',
    notes: row.notes || '',
    createdAt: row.created_at,
  }
}

function buildMotorPayload(body, existing = null) {
  const tag = clean(body.tag ?? existing?.tag)
  if (!tag) return { error: 'Tag/patrimonio e obrigatorio.' }

  const status = clean(body.status ?? existing?.status ?? 'ativo')
  if (!MOTOR_STATUSES.has(status)) return { error: 'Status de motor invalido.' }

  const destinationId = clean(body.destinationId ?? existing?.destination_id ?? '')
  const destinationName = destinationId ? resolveDestinationName(destinationId) : ''
  if (destinationId && !destinationName) return { error: 'Destino nao encontrado.' }

  return {
    tag,
    serial: clean(body.serial ?? existing?.serial),
    name: clean(body.name ?? existing?.name),
    manufacturer: clean(body.manufacturer ?? existing?.manufacturer),
    power: clean(body.power ?? existing?.power),
    voltage: clean(body.voltage ?? existing?.voltage),
    rpm: clean(body.rpm ?? existing?.rpm),
    destinationId,
    destinationName,
    status,
    notes: clean(body.notes ?? existing?.notes),
  }
}

function buildEventPayload(body, motor) {
  const eventType = clean(body.eventType)
  if (!EVENT_TYPES.has(eventType)) return { error: 'Tipo de evento invalido.' }

  const workOrderId = clean(body.workOrderId)
  if (!workOrderId) return { error: 'Evento de motor precisa estar vinculado a uma OS de motor.' }
  const wo = db.prepare('SELECT id, motor_id FROM work_orders WHERE id = ?').get(workOrderId)
  if (!wo) return { error: 'OS nao encontrada.' }
  if (wo.motor_id !== motor.id) return { error: 'OS nao pertence a este motor.' }

  const toDestinationId = clean(body.toDestinationId)
  const resolvedToDestination = toDestinationId ? resolveDestinationName(toDestinationId) : ''
  if (toDestinationId && !resolvedToDestination) return { error: 'Destino nao encontrado.' }

  return {
    eventType,
    workOrderId,
    eventDate: clean(body.eventDate) || nowIso(),
    fromDestination: clean(body.fromDestination) || motor.destination_name || '',
    toDestinationId,
    toDestination: resolvedToDestination || clean(body.toDestination),
    performedBy: clean(body.performedBy),
    notes: clean(body.notes),
  }
}

function applyEventEffect(motorId, payload, now) {
  if (payload.eventType === 'movimentado' && payload.toDestination) {
    db.prepare('UPDATE motors SET destination_id = ?, destination_name = ?, updated_at = ? WHERE id = ?')
      .run(payload.toDestinationId, payload.toDestination, now, motorId)
  }
  if (payload.eventType === 'inativado') {
    db.prepare("UPDATE motors SET status = 'inativo', updated_at = ? WHERE id = ?").run(now, motorId)
  }
  if (payload.eventType === 'reativado') {
    db.prepare("UPDATE motors SET status = 'ativo', updated_at = ? WHERE id = ?").run(now, motorId)
  }
  if (['rebobinado', 'reformado', 'revisado', 'enrolado', 'enrolar'].includes(payload.eventType)) {
    db.prepare("UPDATE motors SET status = 'ativo', updated_at = ? WHERE id = ?").run(now, motorId)
  }
}

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM motors ORDER BY tag').all()
  res.json(rows.map(mapMotor))
})

router.post('/', requireAuth, (req, res) => {
  const payload = buildMotorPayload(req.body)
  if (payload.error) return res.status(400).json({ error: payload.error })

  const dup = db.prepare('SELECT id FROM motors WHERE tag = ?').get(payload.tag)
  if (dup) return res.status(409).json({ error: 'Tag/patrimonio ja existe.' })

  const id = genId('motor')
  const now = nowIso()
  db.prepare(`INSERT INTO motors (
    id, tag, serial, name, manufacturer, power, voltage, rpm,
    destination_id, destination_name, status, notes, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, payload.tag, payload.serial, payload.name, payload.manufacturer, payload.power, payload.voltage, payload.rpm,
    payload.destinationId, payload.destinationName, payload.status, payload.notes, now, now
  )

  res.json(mapMotor(db.prepare('SELECT * FROM motors WHERE id = ?').get(id)))
})

router.put('/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM motors WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Motor nao encontrado.' })

  const payload = buildMotorPayload(req.body, existing)
  if (payload.error) return res.status(400).json({ error: payload.error })

  const dup = db.prepare('SELECT id FROM motors WHERE tag = ? AND id != ?').get(payload.tag, req.params.id)
  if (dup) return res.status(409).json({ error: 'Tag/patrimonio ja existe.' })

  const now = nowIso()
  const fromDestination = existing.destination_name || ''
  const toDestination = payload.destinationName || ''
  const destinationChanged = fromDestination !== toDestination
  if (destinationChanged) {
    return res.status(400).json({ error: 'Mudanca de local do motor deve ser registrada em uma OS de motor.' })
  }

  const tx = db.transaction(() => {
    db.prepare(`UPDATE motors SET
      tag=?, serial=?, name=?, manufacturer=?, power=?, voltage=?, rpm=?,
      destination_id=?, destination_name=?, status=?, notes=?, updated_at=?
      WHERE id=?`).run(
      payload.tag, payload.serial, payload.name, payload.manufacturer, payload.power, payload.voltage, payload.rpm,
      payload.destinationId, payload.destinationName, payload.status, payload.notes, now, req.params.id
    )

  })
  tx()

  res.json(mapMotor(db.prepare('SELECT * FROM motors WHERE id = ?').get(req.params.id)))
})

router.delete('/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM motors WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Motor nao encontrado.' })

  const eventCount = db.prepare('SELECT COUNT(*) as count FROM motor_events WHERE motor_id = ?').get(req.params.id).count
  if (eventCount > 0) return res.status(409).json({ error: 'Motor possui historico. Inative o motor para preservar rastreabilidade.' })

  const orderCount = db.prepare('SELECT COUNT(*) as count FROM work_orders WHERE motor_id = ?').get(req.params.id).count
  if (orderCount > 0) return res.status(409).json({ error: 'Motor possui OS vinculada. Inative o motor para preservar rastreabilidade.' })

  db.prepare('DELETE FROM motors WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

router.get('/:id/events', (req, res) => {
  const motor = db.prepare('SELECT id FROM motors WHERE id = ?').get(req.params.id)
  if (!motor) return res.status(404).json({ error: 'Motor nao encontrado.' })
  const rows = db.prepare('SELECT * FROM motor_events WHERE motor_id = ? ORDER BY event_date DESC, created_at DESC').all(req.params.id)
  res.json(rows.map(mapEvent))
})

router.post('/:id/events', requireAuth, (req, res) => {
  const motor = db.prepare('SELECT * FROM motors WHERE id = ?').get(req.params.id)
  if (!motor) return res.status(404).json({ error: 'Motor nao encontrado.' })

  const payload = buildEventPayload(req.body, motor)
  if (payload.error) return res.status(400).json({ error: payload.error })
  const now = nowIso()
  const id = genId('mev')

  const tx = db.transaction(() => {
    db.prepare(`INSERT INTO motor_events (
      id, motor_id, work_order_id, event_type, event_date, from_destination,
      to_destination, performed_by, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, req.params.id, payload.workOrderId, payload.eventType, payload.eventDate,
      payload.fromDestination, payload.toDestination, payload.performedBy, payload.notes, now
    )

    applyEventEffect(req.params.id, payload, now)

    if (payload.workOrderId) {
      addWorkOrderEvent(payload.workOrderId, 'evento_motor_registrado', req, {
        eventDate: payload.eventDate,
        toValue: payload.eventType,
        notes: payload.notes || `Evento ${payload.eventType} registrado para o motor ${motor.tag}.`,
      })
    }
  })
  tx()

  res.json(mapEvent(db.prepare('SELECT * FROM motor_events WHERE id = ?').get(id)))
})

router.put('/:id/events/:eventId', requireAuth, (req, res) => {
  const motor = db.prepare('SELECT * FROM motors WHERE id = ?').get(req.params.id)
  if (!motor) return res.status(404).json({ error: 'Motor nao encontrado.' })

  const existing = db.prepare('SELECT * FROM motor_events WHERE id = ? AND motor_id = ?').get(req.params.eventId, req.params.id)
  if (!existing) return res.status(404).json({ error: 'Evento nao encontrado.' })

  const payload = buildEventPayload({
    eventType: req.body.eventType ?? existing.event_type,
    workOrderId: req.body.workOrderId ?? existing.work_order_id,
    eventDate: req.body.eventDate ?? existing.event_date,
    fromDestination: req.body.fromDestination ?? existing.from_destination,
    toDestinationId: req.body.toDestinationId,
    toDestination: req.body.toDestination ?? existing.to_destination,
    performedBy: req.body.performedBy ?? existing.performed_by,
    notes: req.body.notes ?? existing.notes,
  }, motor)
  if (payload.error) return res.status(400).json({ error: payload.error })

  const now = nowIso()
  const tx = db.transaction(() => {
    db.prepare(`UPDATE motor_events SET
      work_order_id=?, event_type=?, event_date=?, from_destination=?,
      to_destination=?, performed_by=?, notes=?
      WHERE id=? AND motor_id=?`).run(
      payload.workOrderId, payload.eventType, payload.eventDate, payload.fromDestination,
      payload.toDestination, payload.performedBy, payload.notes,
      req.params.eventId, req.params.id
    )
    applyEventEffect(req.params.id, payload, now)
  })
  tx()

  res.json(mapEvent(db.prepare('SELECT * FROM motor_events WHERE id = ?').get(req.params.eventId)))
})

router.delete('/:id/events/:eventId', requireAuth, (req, res) => {
  const motor = db.prepare('SELECT id FROM motors WHERE id = ?').get(req.params.id)
  if (!motor) return res.status(404).json({ error: 'Motor nao encontrado.' })

  const existing = db.prepare('SELECT id FROM motor_events WHERE id = ? AND motor_id = ?').get(req.params.eventId, req.params.id)
  if (!existing) return res.status(404).json({ error: 'Evento nao encontrado.' })

  db.prepare('DELETE FROM motor_events WHERE id = ? AND motor_id = ?').run(req.params.eventId, req.params.id)
  res.json({ ok: true })
})

export default router
