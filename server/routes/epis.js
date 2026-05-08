import { Router } from 'express'
import crypto from 'crypto'
import db from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
const targetTypes = new Set(['grupo', 'categoria', 'subcategoria', 'item', 'variacao'])

function cleanTarget(body) {
  const targetType = String(body.targetType || '').trim()
  const targetKey = String(body.targetKey || '').trim()
  const targetLabel = String(body.targetLabel || '').trim()
  if (!targetTypes.has(targetType)) return { error: 'Tipo de alvo invalido.' }
  if (!targetKey) return { error: 'Alvo obrigatorio.' }
  return { targetType, targetKey, targetLabel }
}

function toRule(row) {
  return {
    id: row.id,
    roleName: row.role_name,
    targetType: row.target_type,
    targetKey: row.target_key,
    targetLabel: row.target_label || '',
    active: !!row.active,
  }
}

function toPeriodicity(row) {
  return {
    id: row.id,
    targetType: row.target_type,
    targetKey: row.target_key,
    targetLabel: row.target_label || '',
    days: row.days,
    active: !!row.active,
  }
}

router.get('/role-rules', (req, res) => {
  const rows = db.prepare('SELECT * FROM epi_role_rules ORDER BY role_name, target_label, target_key').all()
  res.json(rows.map(toRule))
})

router.post('/role-rules', requireAuth, (req, res) => {
  const roleName = String(req.body.roleName || '').trim()
  if (!roleName) return res.status(400).json({ error: 'Cargo obrigatorio.' })
  const target = cleanTarget(req.body)
  if (target.error) return res.status(400).json({ error: target.error })

  const dup = db.prepare(`
    SELECT id FROM epi_role_rules
    WHERE lower(role_name) = lower(?) AND target_type = ? AND target_key = ?
  `).get(roleName, target.targetType, target.targetKey)
  if (dup) return res.status(409).json({ error: 'Este EPI ja esta vinculado ao cargo.' })

  const id = 'epi_rule_' + crypto.randomBytes(6).toString('hex')
  db.prepare(`
    INSERT INTO epi_role_rules (id, role_name, target_type, target_key, target_label, active)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, roleName, target.targetType, target.targetKey, target.targetLabel, req.body.active !== false ? 1 : 0)

  res.json({ id, roleName, ...target, active: req.body.active !== false })
})

router.put('/role-rules/:id', requireAuth, (req, res) => {
  const current = db.prepare('SELECT * FROM epi_role_rules WHERE id = ?').get(req.params.id)
  if (!current) return res.status(404).json({ error: 'Regra de EPI nao encontrada.' })
  const roleName = String(req.body.roleName ?? current.role_name).trim()
  if (!roleName) return res.status(400).json({ error: 'Cargo obrigatorio.' })
  const target = cleanTarget({
    targetType: req.body.targetType ?? current.target_type,
    targetKey: req.body.targetKey ?? current.target_key,
    targetLabel: req.body.targetLabel ?? current.target_label,
  })
  if (target.error) return res.status(400).json({ error: target.error })

  const dup = db.prepare(`
    SELECT id FROM epi_role_rules
    WHERE lower(role_name) = lower(?) AND target_type = ? AND target_key = ? AND id != ?
  `).get(roleName, target.targetType, target.targetKey, req.params.id)
  if (dup) return res.status(409).json({ error: 'Este EPI ja esta vinculado ao cargo.' })

  db.prepare(`
    UPDATE epi_role_rules SET role_name=?, target_type=?, target_key=?, target_label=?, active=? WHERE id=?
  `).run(roleName, target.targetType, target.targetKey, target.targetLabel, req.body.active !== false ? 1 : 0, req.params.id)

  res.json({ id: req.params.id, roleName, ...target, active: req.body.active !== false })
})

router.delete('/role-rules/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM epi_role_rules WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

router.get('/periodicities', (req, res) => {
  const rows = db.prepare('SELECT * FROM epi_periodicities ORDER BY target_label, target_key').all()
  res.json(rows.map(toPeriodicity))
})

router.post('/periodicities', requireAuth, (req, res) => {
  const target = cleanTarget(req.body)
  if (target.error) return res.status(400).json({ error: target.error })
  const days = Number(req.body.days)
  if (!Number.isInteger(days) || days <= 0) return res.status(400).json({ error: 'Periodicidade deve ser maior que zero.' })

  const dup = db.prepare('SELECT id FROM epi_periodicities WHERE target_type = ? AND target_key = ?').get(target.targetType, target.targetKey)
  if (dup) return res.status(409).json({ error: 'Periodicidade ja cadastrada para este EPI.' })

  const id = 'epi_period_' + crypto.randomBytes(6).toString('hex')
  db.prepare(`
    INSERT INTO epi_periodicities (id, target_type, target_key, target_label, days, active)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, target.targetType, target.targetKey, target.targetLabel, days, req.body.active !== false ? 1 : 0)

  res.json({ id, ...target, days, active: req.body.active !== false })
})

router.put('/periodicities/:id', requireAuth, (req, res) => {
  const current = db.prepare('SELECT * FROM epi_periodicities WHERE id = ?').get(req.params.id)
  if (!current) return res.status(404).json({ error: 'Periodicidade nao encontrada.' })
  const target = cleanTarget({
    targetType: req.body.targetType ?? current.target_type,
    targetKey: req.body.targetKey ?? current.target_key,
    targetLabel: req.body.targetLabel ?? current.target_label,
  })
  if (target.error) return res.status(400).json({ error: target.error })
  const days = req.body.days !== undefined ? Number(req.body.days) : current.days
  if (!Number.isInteger(days) || days <= 0) return res.status(400).json({ error: 'Periodicidade deve ser maior que zero.' })

  const dup = db.prepare('SELECT id FROM epi_periodicities WHERE target_type = ? AND target_key = ? AND id != ?').get(target.targetType, target.targetKey, req.params.id)
  if (dup) return res.status(409).json({ error: 'Periodicidade ja cadastrada para este EPI.' })

  db.prepare(`
    UPDATE epi_periodicities SET target_type=?, target_key=?, target_label=?, days=?, active=? WHERE id=?
  `).run(target.targetType, target.targetKey, target.targetLabel, days, req.body.active !== false ? 1 : 0, req.params.id)

  res.json({ id: req.params.id, ...target, days, active: req.body.active !== false })
})

router.delete('/periodicities/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM epi_periodicities WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
