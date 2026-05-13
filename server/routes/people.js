import { Router } from 'express'
import crypto from 'crypto'
import db from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

function clean(value) {
  return String(value ?? '').trim()
}

// GET /api/people
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM people ORDER BY name').all()
  res.json(rows.map(r => ({ id: r.id, name: r.name, role: r.role_text, active: !!r.active })))
})

// POST /api/people
router.post('/', requireAuth, (req, res) => {
  const name = clean(req.body.name)
  const role = clean(req.body.role)
  const active = req.body.active !== false
  if (!name) return res.status(400).json({ error: 'Nome obrigatorio' })

  const dup = db.prepare('SELECT id FROM people WHERE lower(name) = lower(?)').get(name)
  if (dup) return res.status(409).json({ error: 'Nome ja existe' })

  const id = 'person_' + crypto.randomBytes(6).toString('hex')
  db.prepare('INSERT INTO people (id, name, role_text, active) VALUES (?, ?, ?, ?)').run(
    id, name, role, active ? 1 : 0
  )

  res.json({ id, name, role, active })
})

// PUT /api/people/:id
router.put('/:id', requireAuth, (req, res) => {
  const current = db.prepare('SELECT * FROM people WHERE id = ?').get(req.params.id)
  if (!current) return res.status(404).json({ error: 'Pessoa nao encontrada' })

  const name = clean(req.body.name ?? current.name)
  const role = clean(req.body.role ?? current.role_text)
  const active = req.body.active !== undefined ? req.body.active !== false : !!current.active
  if (!name) return res.status(400).json({ error: 'Nome obrigatorio' })

  const dup = db.prepare('SELECT id FROM people WHERE lower(name) = lower(?) AND id != ?').get(name, req.params.id)
  if (dup) return res.status(409).json({ error: 'Nome ja existe' })

  db.prepare('UPDATE people SET name=?, role_text=?, active=? WHERE id=?').run(
    name, role, active ? 1 : 0, req.params.id
  )
  res.json({ id: req.params.id, name, role, active })
})

// DELETE /api/people/:id
router.delete('/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM people WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
