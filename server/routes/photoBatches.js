import crypto from 'node:crypto'
import { existsSync, mkdirSync } from 'node:fs'
import { readFile, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Router, raw } from 'express'
import db, { ENV_FILE } from '../db.js'
import { resolveEnvPath } from '../env.js'
import { requireAuth, requireOperator } from '../middleware/auth.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_UPLOAD_DIR = ENV_FILE.endsWith('.prod') ? 'photo-uploads-prod' : 'photo-uploads-dev'
const PHOTO_UPLOAD_DIR = resolveEnvPath(process.env.PHOTO_UPLOAD_DIR, join(__dirname, '..', DEFAULT_UPLOAD_DIR))
const ID_PATTERN = /^[A-Za-z0-9_-]{1,140}$/
const BATCH_STATUSES = new Set(['pending', 'completed'])
const PHOTO_STATUSES = new Set(['queued', 'analyzing', 'matched', 'review', 'error'])
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000
const router = Router()

mkdirSync(PHOTO_UPLOAD_DIR, { recursive: true })

function parseJson(value, fallback = {}) {
  try { return JSON.parse(value) } catch { return fallback }
}

function text(value, max = 500) {
  return String(value || '').trim().slice(0, max)
}

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function timestamp(value, fallback = '') {
  const time = Date.parse(value)
  return Number.isFinite(time) ? new Date(time).toISOString() : fallback
}

function validId(value) {
  return ID_PATTERN.test(String(value || ''))
}

function canAccess(batch, user) {
  return batch && (batch.owner_user_id === user.id || user.role === 'admin')
}

function batchRecord(row) {
  const data = parseJson(row.data_json)
  return {
    ...data,
    id: row.id,
    ownerUserId: row.owner_user_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at || '',
    expiresAt: row.expires_at || '',
  }
}

function photoRecord(row) {
  const data = parseJson(row.data_json)
  return {
    ...data,
    id: row.id,
    batchId: row.batch_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    hasImage: Boolean(row.image_path),
    imageMimeType: row.mime_type || '',
  }
}

function batchPayload(body, ownerUserId, operatorName) {
  const now = new Date().toISOString()
  const type = body?.type === 'saida' ? 'saida' : 'entrada'
  const status = BATCH_STATUSES.has(body?.status) ? body.status : 'pending'
  const completedAt = status === 'completed' ? timestamp(body.completedAt, now) : ''
  return {
    id: body.id,
    ownerUserId,
    operatorName: text(body.operatorName || operatorName, 160),
    type,
    status,
    createdAt: timestamp(body.createdAt, now),
    updatedAt: timestamp(body.updatedAt, now),
    completedAt,
    expiresAt: completedAt ? new Date(Date.parse(completedAt) + THIRTY_DAYS).toISOString() : '',
    defaults: object(body.defaults),
  }
}

function photoPayload(body, batchId) {
  const now = new Date().toISOString()
  const qty = Number(body?.qty)
  const unitCost = body?.unitCost === '' || body?.unitCost == null ? '' : Number(body.unitCost)
  return {
    id: body.id,
    batchId,
    fileName: text(body.fileName, 240),
    createdAt: timestamp(body.createdAt, now),
    updatedAt: timestamp(body.updatedAt, now),
    status: PHOTO_STATUSES.has(body?.status) ? body.status : 'queued',
    error: text(body.error, 1000),
    suggestion: object(body.suggestion),
    itemId: text(body.itemId, 160),
    variationId: text(body.variationId, 160),
    qty: Number.isFinite(qty) ? qty : 1,
    unitCost: Number.isFinite(unitCost) ? unitCost : '',
    useOverrides: body?.useOverrides === true,
    overrides: object(body.overrides),
    manualSearch: text(body.manualSearch, 1000),
    movementId: text(body.movementId, 160),
  }
}

function batchById(id) {
  return db.prepare('SELECT * FROM photo_batches WHERE id = ?').get(id)
}

function photoById(id) {
  return db.prepare('SELECT * FROM photo_batch_photos WHERE id = ?').get(id)
}

function imageFileName(photoId, mimeType) {
  const extension = mimeType === 'image/png' ? '.png' : mimeType === 'image/webp' ? '.webp' : '.jpg'
  return `${crypto.createHash('sha256').update(photoId).digest('hex')}${extension}`
}

async function removeImage(path) {
  if (path) await unlink(join(PHOTO_UPLOAD_DIR, path)).catch(() => {})
}

async function cleanupExpired() {
  const expired = db.prepare(`
    SELECT p.image_path
    FROM photo_batches b
    LEFT JOIN photo_batch_photos p ON p.batch_id = b.id
    WHERE b.status = 'completed' AND b.expires_at <> '' AND b.expires_at <= ?
  `).all(new Date().toISOString())
  db.prepare(`
    DELETE FROM photo_batches
    WHERE status = 'completed' AND expires_at <> '' AND expires_at <= ?
  `).run(new Date().toISOString())
  await Promise.all(expired.map(row => removeImage(row.image_path)))
}

async function persistVariationPhotos(batchId, completedAt) {
  const photos = db.prepare(`
    SELECT id, image_path, mime_type, data_json
    FROM photo_batch_photos
    WHERE batch_id = ? AND image_path <> ''
    ORDER BY created_at
  `).all(batchId)
  const save = db.prepare(`
    INSERT INTO variation_photos (
      variation_id, mime_type, image_data, updated_at, source_batch_id, source_photo_id
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(variation_id) DO UPDATE SET
      mime_type = excluded.mime_type,
      image_data = excluded.image_data,
      updated_at = excluded.updated_at,
      source_batch_id = excluded.source_batch_id,
      source_photo_id = excluded.source_photo_id
    WHERE excluded.updated_at >= variation_photos.updated_at
  `)

  for (const photo of photos) {
    const data = parseJson(photo.data_json)
    const variationId = text(data.variationId, 160)
    if (!validId(variationId)) continue
    const image = await readFile(join(PHOTO_UPLOAD_DIR, photo.image_path)).catch(() => null)
    if (!image?.length) continue
    const mimeType = ['image/jpeg', 'image/png', 'image/webp'].includes(photo.mime_type) ? photo.mime_type : 'image/jpeg'
    save.run(variationId, mimeType, image, completedAt, batchId, photo.id)
  }
}

router.get('/variation/:variationId/image', requireAuth, async (req, res) => {
  if (!validId(req.params.variationId)) return res.status(400).json({ error: 'Variação inválida.' })
  const findPermanent = db.prepare('SELECT mime_type, image_data FROM variation_photos WHERE variation_id = ?')
  let photo = findPermanent.get(req.params.variationId)
  if (!photo) {
    const legacy = db.prepare(`
      SELECT p.batch_id, b.completed_at
      FROM photo_batch_photos p
      JOIN photo_batches b ON b.id = p.batch_id
      WHERE b.status = 'completed'
        AND p.image_path <> ''
        AND json_extract(p.data_json, '$.variationId') = ?
      ORDER BY b.completed_at DESC, p.created_at DESC
      LIMIT 1
    `).get(req.params.variationId)
    if (legacy) {
      await persistVariationPhotos(legacy.batch_id, legacy.completed_at)
      photo = findPermanent.get(req.params.variationId)
    }
  }
  if (!photo?.image_data) return res.status(404).json({ error: 'Foto não encontrada.' })
  res.type(photo.mime_type || 'image/jpeg').set('Cache-Control', 'private, no-store').send(photo.image_data)
})

router.use(requireAuth, requireOperator)

router.get('/', async (req, res) => {
  await cleanupExpired()
  const requestedOwner = text(req.query.ownerUserId, 160)
  const ownerUserId = req.user.role === 'admin' && requestedOwner ? requestedOwner : req.user.id
  const rows = req.user.role === 'admin' && req.query.all === '1'
    ? db.prepare('SELECT * FROM photo_batches ORDER BY updated_at DESC').all()
    : db.prepare('SELECT * FROM photo_batches WHERE owner_user_id = ? ORDER BY updated_at DESC').all(ownerUserId)
  res.json(rows.map(batchRecord))
})

router.put('/:batchId', async (req, res) => {
  const id = req.params.batchId
  if (!validId(id) || req.body?.id !== id) return res.status(400).json({ error: 'Lote inválido.' })
  const existing = batchById(id)
  if (existing && !canAccess(existing, req.user)) return res.status(403).json({ error: 'Sem permissão.' })

  const payload = batchPayload(req.body, existing?.owner_user_id || req.user.id, req.user.name)
  if (existing && existing.updated_at > payload.updatedAt) return res.json(batchRecord(existing))

  db.prepare(`
    INSERT INTO photo_batches (
      id, owner_user_id, status, created_at, updated_at, completed_at, expires_at, data_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      updated_at = excluded.updated_at,
      completed_at = excluded.completed_at,
      expires_at = excluded.expires_at,
      data_json = excluded.data_json
  `).run(
    id, payload.ownerUserId, payload.status, payload.createdAt, payload.updatedAt,
    payload.completedAt, payload.expiresAt, JSON.stringify(payload)
  )
  if (payload.status === 'completed') await persistVariationPhotos(id, payload.completedAt)
  res.json(batchRecord(batchById(id)))
})

router.get('/:batchId/photos', (req, res) => {
  const batch = batchById(req.params.batchId)
  if (!batch) return res.status(404).json({ error: 'Lote não encontrado.' })
  if (!canAccess(batch, req.user)) return res.status(403).json({ error: 'Sem permissão.' })
  const rows = db.prepare('SELECT * FROM photo_batch_photos WHERE batch_id = ? ORDER BY created_at').all(batch.id)
  res.json(rows.map(photoRecord))
})

router.put('/:batchId/photos/:photoId', async (req, res) => {
  const { batchId, photoId } = req.params
  if (!validId(photoId) || req.body?.id !== photoId || req.body?.batchId !== batchId) {
    return res.status(400).json({ error: 'Foto inválida.' })
  }
  const batch = batchById(batchId)
  if (!batch) return res.status(404).json({ error: 'Lote não encontrado.' })
  if (!canAccess(batch, req.user)) return res.status(403).json({ error: 'Sem permissão.' })
  const existing = photoById(photoId)
  if (existing && existing.batch_id !== batchId) return res.status(409).json({ error: 'Foto já pertence a outro lote.' })

  const payload = photoPayload(req.body, batchId)
  if (existing && existing.updated_at > payload.updatedAt) return res.json(photoRecord(existing))

  db.prepare(`
    INSERT INTO photo_batch_photos (id, batch_id, created_at, updated_at, data_json)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      updated_at = excluded.updated_at,
      data_json = excluded.data_json
  `).run(photoId, batchId, payload.createdAt, payload.updatedAt, JSON.stringify(payload))
  if (batch.status === 'completed') await persistVariationPhotos(batch.id, batch.completed_at)
  res.json(photoRecord(photoById(photoId)))
})

router.put(
  '/:batchId/photos/:photoId/image',
  raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '2mb' }),
  async (req, res) => {
    const batch = batchById(req.params.batchId)
    const photo = photoById(req.params.photoId)
    if (!batch || !photo || photo.batch_id !== batch.id) return res.status(404).json({ error: 'Foto não encontrada.' })
    if (!canAccess(batch, req.user)) return res.status(403).json({ error: 'Sem permissão.' })
    if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(415).json({ error: 'Envie uma imagem JPG, PNG ou WEBP.' })

    const mimeType = String(req.get('content-type') || '').split(';')[0]
    const fileName = imageFileName(photo.id, mimeType)
    await writeFile(join(PHOTO_UPLOAD_DIR, fileName), req.body)
    if (photo.image_path && photo.image_path !== fileName) await removeImage(photo.image_path)
    db.prepare('UPDATE photo_batch_photos SET image_path = ?, mime_type = ? WHERE id = ?').run(fileName, mimeType, photo.id)
    if (batch.status === 'completed') await persistVariationPhotos(batch.id, batch.completed_at)
    res.json(photoRecord(photoById(photo.id)))
  }
)

router.get('/:batchId/photos/:photoId/image', (req, res) => {
  const batch = batchById(req.params.batchId)
  const photo = photoById(req.params.photoId)
  if (!batch || !photo || photo.batch_id !== batch.id || !photo.image_path) return res.status(404).json({ error: 'Foto não encontrada.' })
  if (!canAccess(batch, req.user)) return res.status(403).json({ error: 'Sem permissão.' })
  const path = join(PHOTO_UPLOAD_DIR, photo.image_path)
  if (!existsSync(path)) return res.status(404).json({ error: 'Arquivo da foto não encontrado.' })
  res.type(photo.mime_type || 'image/jpeg').set('Cache-Control', 'private, no-store').sendFile(path)
})

router.delete('/:batchId/photos/:photoId', async (req, res) => {
  const batch = batchById(req.params.batchId)
  const photo = photoById(req.params.photoId)
  if (!batch || !photo || photo.batch_id !== batch.id) return res.json({ ok: true })
  if (!canAccess(batch, req.user)) return res.status(403).json({ error: 'Sem permissão.' })
  db.prepare('DELETE FROM photo_batch_photos WHERE id = ?').run(photo.id)
  await removeImage(photo.image_path)
  res.json({ ok: true })
})

router.delete('/:batchId', async (req, res) => {
  const batch = batchById(req.params.batchId)
  if (!batch) return res.json({ ok: true })
  if (!canAccess(batch, req.user)) return res.status(403).json({ error: 'Sem permissão.' })
  const photos = db.prepare('SELECT image_path FROM photo_batch_photos WHERE batch_id = ?').all(batch.id)
  db.prepare('DELETE FROM photo_batches WHERE id = ?').run(batch.id)
  await Promise.all(photos.map(photo => removeImage(photo.image_path)))
  res.json({ ok: true })
})

export default router
