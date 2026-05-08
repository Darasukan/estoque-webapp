import { Router } from 'express'
import crypto from 'crypto'
import db from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

function toSupplier(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    active: !!row.active,
  }
}

// GET /api/suppliers
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM suppliers ORDER BY name').all()
  res.json(rows.map(toSupplier))
})

// POST /api/suppliers
router.post('/', requireAuth, (req, res) => {
  const name = String(req.body.name || '').trim()
  const description = String(req.body.description || '').trim()
  const active = req.body.active !== false
  if (!name) return res.status(400).json({ error: 'Nome obrigatorio' })

  const dup = db.prepare('SELECT id FROM suppliers WHERE lower(name) = lower(?)').get(name)
  if (dup) return res.status(409).json({ error: 'Fornecedor ja existe' })

  const id = 'supplier_' + crypto.randomBytes(6).toString('hex')
  db.prepare('INSERT INTO suppliers (id, name, description, active) VALUES (?, ?, ?, ?)').run(
    id, name, description, active ? 1 : 0
  )

  res.json({ id, name, description, active })
})

// PUT /api/suppliers/:id
router.put('/:id', requireAuth, (req, res) => {
  const current = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id)
  if (!current) return res.status(404).json({ error: 'Fornecedor nao encontrado' })

  const name = String(req.body.name ?? current.name).trim()
  const description = String(req.body.description ?? current.description ?? '').trim()
  const active = req.body.active !== false
  if (!name) return res.status(400).json({ error: 'Nome obrigatorio' })

  const dup = db.prepare('SELECT id FROM suppliers WHERE lower(name) = lower(?) AND id != ?').get(name, req.params.id)
  if (dup) return res.status(409).json({ error: 'Fornecedor ja existe' })

  db.prepare('UPDATE suppliers SET name=?, description=?, active=? WHERE id=?').run(
    name, description, active ? 1 : 0, req.params.id
  )

  res.json({ id: req.params.id, name, description, active })
})

// DELETE /api/suppliers/:id
router.delete('/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM suppliers WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
