import { Router } from 'express'
import crypto from 'crypto'
import db from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

function clean(value) {
  return String(value ?? '').trim()
}

function parseRules(value) {
  if (Array.isArray(value)) return value
  try { return JSON.parse(value || '[]') } catch { return [] }
}

function normalizeRules(rules) {
  if (!Array.isArray(rules)) return []
  const seen = new Set()
  const result = []
  for (const rule of rules) {
    const normalized = {
      group: clean(rule?.group),
      category: clean(rule?.category),
      subcategory: clean(rule?.subcategory),
    }
    if (!normalized.group) continue
    const key = `${normalized.group}\u0000${normalized.category}\u0000${normalized.subcategory}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(normalized)
  }
  return result
}

function toDestination(r) {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    active: !!r.active,
    parentId: r.parent_id,
    materialRules: parseRules(r.material_rules),
  }
}

function validateParent(parentId) {
  if (!parentId) return { ok: true, parentId: null }
  const parent = db.prepare('SELECT parent_id FROM destinations WHERE id = ?').get(parentId)
  if (!parent) return { ok: false, error: 'Destino pai nao encontrado' }
  if (parent.parent_id) return { ok: false, error: 'Maximo 2 niveis' }
  return { ok: true, parentId }
}

function destinationDuplicate(name, parentId, ignoreId = '') {
  return db.prepare(`
    SELECT id FROM destinations
    WHERE lower(name) = lower(?)
      AND coalesce(parent_id, '') = coalesce(?, '')
      AND id != ?
  `).get(name, parentId || '', ignoreId)
}

// GET /api/destinations
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM destinations ORDER BY name').all()
  res.json(rows.map(toDestination))
})

// POST /api/destinations
router.post('/', requireAuth, (req, res) => {
  const name = clean(req.body.name)
  const description = clean(req.body.description)
  const active = req.body.active !== false
  const parent = validateParent(req.body.parentId || null)
  if (!name) return res.status(400).json({ error: 'Nome obrigatorio' })
  if (!parent.ok) return res.status(400).json({ error: parent.error })
  if (destinationDuplicate(name, parent.parentId)) {
    return res.status(409).json({ error: 'Ja existe um destino com esse nome neste nivel.' })
  }

  const id = 'dest_' + crypto.randomBytes(6).toString('hex')
  const rules = normalizeRules(req.body.materialRules)
  db.prepare('INSERT INTO destinations (id, name, description, active, parent_id, material_rules) VALUES (?, ?, ?, ?, ?, ?)').run(
    id, name, description, active ? 1 : 0, parent.parentId, JSON.stringify(rules)
  )

  res.json({ id, name, description, active, parentId: parent.parentId, materialRules: rules })
})

// PUT /api/destinations/:id
router.put('/:id', requireAuth, (req, res) => {
  const current = db.prepare('SELECT * FROM destinations WHERE id = ?').get(req.params.id)
  if (!current) return res.status(404).json({ error: 'Destino nao encontrado' })

  const name = clean(req.body.name ?? current.name)
  const description = clean(req.body.description ?? current.description)
  const active = req.body.active !== undefined ? req.body.active !== false : !!current.active
  const requestedParentId = req.body.parentId !== undefined ? req.body.parentId || null : current.parent_id
  const parent = validateParent(requestedParentId)
  if (!name) return res.status(400).json({ error: 'Nome obrigatorio' })
  if (!parent.ok) return res.status(400).json({ error: parent.error })
  if (parent.parentId === req.params.id) return res.status(400).json({ error: 'Destino nao pode ser pai dele mesmo.' })
  if (destinationDuplicate(name, parent.parentId, req.params.id)) {
    return res.status(409).json({ error: 'Ja existe um destino com esse nome neste nivel.' })
  }

  const rules = normalizeRules(req.body.materialRules !== undefined ? req.body.materialRules : current.material_rules)
  db.prepare('UPDATE destinations SET name=?, description=?, active=?, parent_id=?, material_rules=? WHERE id=?').run(
    name, description, active ? 1 : 0, parent.parentId, JSON.stringify(rules), req.params.id
  )
  res.json({ id: req.params.id, name, description, active, parentId: parent.parentId, materialRules: rules })
})

// DELETE /api/destinations/:id
router.delete('/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM destinations WHERE parent_id = ?').run(req.params.id)
  db.prepare('DELETE FROM destinations WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
