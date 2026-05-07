import { Router } from 'express'
import crypto from 'crypto'
import db from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

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
      group: String(rule?.group || '').trim(),
      category: String(rule?.category || '').trim(),
      subcategory: String(rule?.subcategory || '').trim(),
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

// GET /api/destinations
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM destinations ORDER BY name').all()
  res.json(rows.map(toDestination))
})

// POST /api/destinations
router.post('/', requireAuth, (req, res) => {
  const { name, description, active, parentId, materialRules } = req.body
  if (!name) return res.status(400).json({ error: 'Nome obrigatório' })

  if (parentId) {
    const parent = db.prepare('SELECT parent_id FROM destinations WHERE id = ?').get(parentId)
    if (!parent) return res.status(400).json({ error: 'Destino pai não encontrado' })
    if (parent.parent_id) return res.status(400).json({ error: 'Máximo 2 níveis' })
  }

  const id = 'dest_' + crypto.randomBytes(6).toString('hex')
  const rules = normalizeRules(materialRules)
  db.prepare('INSERT INTO destinations (id, name, description, active, parent_id, material_rules) VALUES (?, ?, ?, ?, ?, ?)').run(
    id, name, description || '', active !== false ? 1 : 0, parentId || null, JSON.stringify(rules)
  )

  res.json({ id, name, description: description || '', active: active !== false, parentId: parentId || null, materialRules: rules })
})

// PUT /api/destinations/:id
router.put('/:id', requireAuth, (req, res) => {
  const { name, description, active, parentId, materialRules } = req.body
  const rules = normalizeRules(materialRules)
  db.prepare('UPDATE destinations SET name=?, description=?, active=?, parent_id=?, material_rules=? WHERE id=?').run(
    name, description || '', active !== false ? 1 : 0, parentId || null, JSON.stringify(rules), req.params.id
  )
  res.json({ id: req.params.id, name, description: description || '', active: active !== false, parentId: parentId || null, materialRules: rules })
})

// DELETE /api/destinations/:id
router.delete('/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM destinations WHERE parent_id = ?').run(req.params.id)
  db.prepare('DELETE FROM destinations WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
