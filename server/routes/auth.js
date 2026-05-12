import { Router } from 'express'
import bcryptjs from 'bcryptjs'
import crypto from 'crypto'
import db from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

// POST /api/auth/login — { name, pin }
router.post('/login', (req, res) => {
  const { name, pin } = req.body
  if (!name || !pin) return res.status(400).json({ error: 'Nome e PIN obrigatórios' })

  const user = db.prepare('SELECT * FROM users WHERE name = ? AND active = 1').get(name)
  if (!user) return res.status(401).json({ error: 'Usuário não encontrado' })

  if (!bcryptjs.compareSync(pin, user.pin_hash)) {
    return res.status(401).json({ error: 'PIN incorreto' })
  }

  // Create session token
  const token = crypto.randomBytes(32).toString('hex')
  db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, user.id)

  res.json({ token, user: { id: user.id, name: user.name, role: user.role } })
})

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  const token = req.headers['x-auth-token']
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
  res.json({ ok: true })
})

// GET /api/auth/me
router.get('/me', (req, res) => {
  const token = req.headers['x-auth-token']
  if (!token) return res.status(401).json({ error: 'Não autenticado' })

  const session = db.prepare(`
    SELECT u.id, u.name, u.role FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ? AND u.active = 1
  `).get(token)

  if (!session) return res.status(401).json({ error: 'Sessão inválida' })
  res.json(session)
})

// ===== User management (admin only) =====

// GET /api/auth/users
router.get('/users', requireAuth, requireRole('admin'), (req, res) => {
  const users = db.prepare('SELECT id, name, role, active FROM users ORDER BY name').all()
  res.json(users)
})

// POST /api/auth/users — { name, role, pin }
router.post('/users', requireAuth, requireRole('admin'), (req, res) => {
  const { name, role, pin } = req.body
  if (!name || !role || !pin) return res.status(400).json({ error: 'Nome, papel e PIN obrigatórios' })
  if (!['admin', 'operador', 'visitante'].includes(role)) return res.status(400).json({ error: 'Papel inválido' })

  const existing = db.prepare('SELECT id FROM users WHERE name = ?').get(name)
  if (existing) return res.status(409).json({ error: 'Nome já existe' })

  const id = 'user_' + crypto.randomBytes(6).toString('hex')
  const pin_hash = bcryptjs.hashSync(pin, 10)
  db.prepare('INSERT INTO users (id, name, role, pin_hash) VALUES (?, ?, ?, ?)').run(id, name, role, pin_hash)

  res.json({ id, name, role, active: 1 })
})

// PUT /api/auth/users/:id — { name?, role?, pin?, active? }
router.put('/users/:id', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' })

  const { name, role, pin, active } = req.body
  const isMasterAdmin = req.user?.id === 'user_admin'
  const isSelf = req.user?.id === req.params.id
  const isAdmin = req.user?.role === 'admin'
  const hasProfileChanges = name !== undefined || role !== undefined || active !== undefined

  if (pin !== undefined && (!String(pin).trim())) {
    return res.status(400).json({ error: 'Senha obrigatória.' })
  }
  if (pin !== undefined && !isSelf && !isMasterAdmin) {
    return res.status(403).json({ error: 'Somente o admin mestre pode alterar senha de outro usuário.' })
  }
  if (hasProfileChanges && !isAdmin) {
    return res.status(403).json({ error: 'Somente admin pode alterar dados de operador.' })
  }

  // Protect default admin: only allow pin changes
  if (req.params.id === 'user_admin') {
    if (name !== undefined && name !== user.name) return res.status(403).json({ error: 'Não é possível alterar o nome do admin padrão.' })
    if (role !== undefined && role !== user.role) return res.status(403).json({ error: 'Não é possível alterar o papel do admin padrão.' })
    if (active !== undefined && active !== !!user.active) return res.status(403).json({ error: 'Não é possível desativar o admin padrão.' })
  }

  if (name !== undefined) {
    const dup = db.prepare('SELECT id FROM users WHERE name = ? AND id != ?').get(name, req.params.id)
    if (dup) return res.status(409).json({ error: 'Nome já existe' })
  }
  if (role !== undefined && !['admin', 'operador', 'visitante'].includes(role)) {
    return res.status(400).json({ error: 'Papel inválido' })
  }

  const updates = []
  const params = []
  if (name !== undefined) { updates.push('name = ?'); params.push(name) }
  if (role !== undefined) { updates.push('role = ?'); params.push(role) }
  if (pin !== undefined) { updates.push('pin_hash = ?'); params.push(bcryptjs.hashSync(String(pin).trim(), 10)) }
  if (active !== undefined) { updates.push('active = ?'); params.push(active ? 1 : 0) }

  if (updates.length) {
    params.push(req.params.id)
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params)
  }

  const updated = db.prepare('SELECT id, name, role, active FROM users WHERE id = ?').get(req.params.id)
  res.json(updated)
})

// DELETE /api/auth/users/:id
router.delete('/users/:id', requireAuth, requireRole('admin'), (req, res) => {
  const targetUser = db.prepare('SELECT id, role FROM users WHERE id = ?').get(req.params.id)
  if (!targetUser) return res.status(404).json({ error: 'Usuário não encontrado' })
  // Don't allow deleting yourself
  if (req.user && req.user.id === req.params.id) {
    return res.status(400).json({ error: 'Não pode excluir a si mesmo' })
  }
  // Don't allow deleting the default admin
  if (req.params.id === 'user_admin') {
    return res.status(403).json({ error: 'Não é possível excluir o admin padrão.' })
  }
  if (targetUser.role === 'admin' && req.user?.id !== 'user_admin') {
    return res.status(403).json({ error: 'Somente o admin mestre pode excluir outro admin.' })
  }
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.params.id)
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
