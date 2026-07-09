import { Router } from 'express'
import crypto from 'crypto'
import db from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// GET /api/roles
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM roles ORDER BY name').all()
  res.json(rows.map(r => ({ id: r.id, name: r.name, description: r.description, active: !!r.active })))
})

// POST /api/roles
router.post('/', requireAuth, (req, res) => {
  const { name, description, active } = req.body
  if (!name) return res.status(400).json({ error: 'Nome obrigatório' })

  const dup = db.prepare('SELECT id FROM roles WHERE name = ?').get(name)
  if (dup) return res.status(409).json({ error: 'Nome já existe' })

  const id = 'role_' + crypto.randomBytes(6).toString('hex')
  db.prepare('INSERT INTO roles (id, name, description, active) VALUES (?, ?, ?, ?)').run(
    id, name, description || '', active !== false ? 1 : 0
  )

  res.json({ id, name, description: description || '', active: active !== false })
})

// PUT /api/roles/:id
router.put('/:id', requireAuth, (req, res) => {
  const current = db.prepare('SELECT * FROM roles WHERE id = ?').get(req.params.id)
  if (!current) return res.status(404).json({ error: 'Cargo nao encontrado' })
  const { name, description, active } = req.body
  const nextName = String(name ?? current.name).trim()
  if (!nextName) return res.status(400).json({ error: 'Nome obrigatorio' })
  const dup = db.prepare('SELECT id FROM roles WHERE lower(name) = lower(?) AND id != ?').get(nextName, req.params.id)
  if (dup) return res.status(409).json({ error: 'Nome já existe' })

  const nextDescription = description !== undefined ? description || '' : current.description || ''
  const nextActive = active !== undefined ? active !== false : !!current.active
  db.transaction(() => {
    db.prepare('UPDATE roles SET name=?, description=?, active=? WHERE id=?').run(
      nextName, nextDescription, nextActive ? 1 : 0, req.params.id
    )
    if (current.name.toLowerCase() !== nextName.toLowerCase()) {
      db.prepare('UPDATE people SET role_text = ? WHERE lower(role_text) = lower(?)').run(nextName, current.name)
      db.prepare('UPDATE epi_role_rules SET role_name = ? WHERE lower(role_name) = lower(?)').run(nextName, current.name)
    }
  })()
  res.json({ id: req.params.id, name: nextName, description: nextDescription, active: nextActive })
})

// DELETE /api/roles/:id
router.delete('/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM roles WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
