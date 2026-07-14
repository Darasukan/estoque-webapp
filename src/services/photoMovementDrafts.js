import { reactive, toRaw } from 'vue'
import {
  deleteRemoteBatchPhoto,
  deleteRemotePhotoBatch,
  getPhotoBatchImage,
  getPhotoBatchPhotos,
  getPhotoBatches,
  putPhotoBatch,
  putPhotoBatchImage,
  putPhotoBatchPhoto,
} from './api.js'
import { photoBatchExpired } from '../utils/photoMovement.js'

const DB_NAME = 'estoque-photo-movements'
const DB_VERSION = 1
const BATCHES = 'batches'
const PHOTOS = 'photos'

export const photoSyncState = reactive({ warning: '' })

export function photoSyncWarning(error) {
  if (error?.status === 401) return 'Sua sessão não está válida neste servidor. Entre novamente para sincronizar os lotes.'
  if (error?.status === 403) return 'Esta conta não tem permissão para sincronizar estes lotes.'
  if (error?.status === 404) return 'Este servidor ainda não possui a sincronização por conta. Reinicie ou atualize o servidor.'
  if (error?.status) return `Não foi possível sincronizar os lotes: ${error.message}`
  return 'Sem conexão com o servidor. As alterações continuam salvas neste aparelho.'
}

function syncFailed(error) {
  photoSyncState.warning = photoSyncWarning(error)
}

function syncSucceeded() {
  photoSyncState.warning = ''
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error || new Error('Operação local cancelada.'))
  })
}

export function toPhotoStorageRecord(value) {
  const raw = toRaw(value)
  if (!raw || typeof raw !== 'object') return raw
  if (Array.isArray(raw)) return raw.map(toPhotoStorageRecord)
  const prototype = Object.getPrototypeOf(raw)
  if (prototype !== Object.prototype && prototype !== null) return raw
  return Object.fromEntries(
    Object.entries(raw).map(([key, nested]) => [key, toPhotoStorageRecord(nested)])
  )
}

function openDatabase() {
  if (!globalThis.indexedDB) return Promise.reject(new Error('Este navegador não oferece armazenamento local para fotos.'))
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(BATCHES)) {
        const batches = db.createObjectStore(BATCHES, { keyPath: 'id' })
        batches.createIndex('ownerUserId', 'ownerUserId')
      }
      if (!db.objectStoreNames.contains(PHOTOS)) {
        const photos = db.createObjectStore(PHOTOS, { keyPath: 'id' })
        photos.createIndex('batchId', 'batchId')
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function localPut(storeName, value) {
  const db = await openDatabase()
  try {
    const transaction = db.transaction(storeName, 'readwrite')
    transaction.objectStore(storeName).put(toPhotoStorageRecord(value))
    await transactionDone(transaction)
    return value
  } finally {
    db.close()
  }
}

async function localGet(storeName, id) {
  const db = await openDatabase()
  try {
    const transaction = db.transaction(storeName)
    const value = await requestResult(transaction.objectStore(storeName).get(id))
    await transactionDone(transaction)
    return value
  } finally {
    db.close()
  }
}

async function localPhotoBatches(ownerUserId) {
  const db = await openDatabase()
  try {
    const transaction = db.transaction(BATCHES)
    const rows = await requestResult(transaction.objectStore(BATCHES).index('ownerUserId').getAll(ownerUserId))
    await transactionDone(transaction)
    return rows
  } finally {
    db.close()
  }
}

async function localBatchPhotos(batchId) {
  const db = await openDatabase()
  try {
    const transaction = db.transaction(PHOTOS)
    const rows = await requestResult(transaction.objectStore(PHOTOS).index('batchId').getAll(batchId))
    await transactionDone(transaction)
    return rows
  } finally {
    db.close()
  }
}

async function localDeleteBatch(batchId) {
  const db = await openDatabase()
  try {
    const transaction = db.transaction([BATCHES, PHOTOS], 'readwrite')
    transaction.objectStore(BATCHES).delete(batchId)
    const photoStore = transaction.objectStore(PHOTOS)
    const keys = await requestResult(photoStore.index('batchId').getAllKeys(batchId))
    for (const key of keys) photoStore.delete(key)
    await transactionDone(transaction)
  } finally {
    db.close()
  }
}

async function localDeletePhoto(photoId) {
  const db = await openDatabase()
  try {
    const transaction = db.transaction(PHOTOS, 'readwrite')
    transaction.objectStore(PHOTOS).delete(photoId)
    await transactionDone(transaction)
  } finally {
    db.close()
  }
}

function applyRecord(target, record) {
  if (target && typeof target === 'object') Object.assign(target, record)
  return record
}

function photoMetadata(photo) {
  const { blob, syncPending, hasImage, imageMimeType, ...metadata } = toPhotoStorageRecord(photo)
  return metadata
}

async function syncBatch(batch) {
  try {
    const remote = await putPhotoBatch(toPhotoStorageRecord(batch))
    syncSucceeded()
    const synced = { ...remote, syncPending: false }
    applyRecord(batch, synced)
    await localPut(BATCHES, synced)
    return synced
  } catch (error) {
    syncFailed(error)
    const pending = { ...toPhotoStorageRecord(batch), syncPending: true }
    applyRecord(batch, { syncPending: true })
    await localPut(BATCHES, pending)
    return pending
  }
}

async function syncPhoto(photo) {
  try {
    let remote = await putPhotoBatchPhoto(photoMetadata(photo))
    if (!remote.hasImage) {
      if (!(photo.blob instanceof Blob)) throw new Error('A foto local não está mais disponível.')
      remote = await putPhotoBatchImage(photo.batchId, photo.id, photo.blob)
    }
    syncSucceeded()
    const synced = { ...remote, blob: photo.blob, syncPending: false }
    applyRecord(photo, synced)
    await localPut(PHOTOS, synced)
    return synced
  } catch (error) {
    syncFailed(error)
    const pending = { ...toPhotoStorageRecord(photo), syncPending: true }
    applyRecord(photo, { syncPending: true })
    await localPut(PHOTOS, pending)
    return pending
  }
}

export function newPhotoId(prefix) {
  const value = globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`
  return `${prefix}_${value}`
}

export async function requestPersistentPhotoStorage() {
  if (!navigator.storage?.persist) return false
  return navigator.storage.persist()
}

export function isPhotoStorageQuotaError(error) {
  return error?.name === 'QuotaExceededError' || /quota|espaço|space/i.test(error?.message || '')
}

export async function listPhotoBatches(ownerUserId) {
  let local = await localPhotoBatches(ownerUserId)
  for (const batch of local.filter(batch => batch.syncPending !== false)) await syncBatch(batch)

  try {
    const remote = await getPhotoBatches()
    syncSucceeded()
    const remoteIds = new Set(remote.map(batch => batch.id))
    local = await localPhotoBatches(ownerUserId)
    for (const batch of local.filter(batch => batch.syncPending === false && !remoteIds.has(batch.id))) {
      await localDeleteBatch(batch.id)
    }
    const pendingById = new Map(local.filter(batch => batch.syncPending).map(batch => [batch.id, batch]))
    for (const batch of remote) {
      if (!pendingById.has(batch.id)) await localPut(BATCHES, { ...batch, syncPending: false })
    }
  } catch (error) { syncFailed(error) }

  return (await localPhotoBatches(ownerUserId))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
}

export async function listBatchPhotos(batchId) {
  let local = await localBatchPhotos(batchId)
  for (const photo of local.filter(photo => photo.syncPending !== false)) await syncPhoto(photo)

  try {
    const remote = await getPhotoBatchPhotos(batchId)
    const remoteIds = new Set(remote.map(photo => photo.id))
    local = await localBatchPhotos(batchId)
    for (const photo of local.filter(photo => photo.syncPending === false && !remoteIds.has(photo.id))) {
      await localDeletePhoto(photo.id)
    }

    const localById = new Map(local.map(photo => [photo.id, photo]))
    for (const photo of remote) {
      const cached = localById.get(photo.id)
      if (cached?.syncPending) continue
      if (!photo.hasImage && cached?.blob) {
        await syncPhoto({ ...cached, syncPending: true })
        continue
      }
      if (!photo.hasImage) continue
      const blob = cached?.blob instanceof Blob ? cached.blob : await getPhotoBatchImage(batchId, photo.id)
      await localPut(PHOTOS, { ...photo, blob, syncPending: false })
    }
    syncSucceeded()
  } catch (error) { syncFailed(error) }

  return (await localBatchPhotos(batchId))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
}

export async function savePhotoBatch(batch) {
  const pending = { ...toPhotoStorageRecord(batch), updatedAt: new Date().toISOString(), syncPending: true }
  applyRecord(batch, pending)
  await localPut(BATCHES, pending)
  return syncBatch(batch)
}

export async function saveBatchPhoto(photo) {
  const pending = { ...toPhotoStorageRecord(photo), updatedAt: new Date().toISOString(), syncPending: true }
  applyRecord(photo, pending)
  await localPut(PHOTOS, pending)
  return syncPhoto(photo)
}

export async function deletePhotoBatch(batchId) {
  try {
    await deleteRemotePhotoBatch(batchId)
    syncSucceeded()
    await localDeleteBatch(batchId)
  } catch (error) {
    syncFailed(error)
    throw error
  }
}

export async function deleteBatchPhoto(photoId) {
  const photo = await localGet(PHOTOS, photoId)
  if (!photo) return
  try {
    await deleteRemoteBatchPhoto(photo.batchId, photoId)
    syncSucceeded()
    await localDeletePhoto(photoId)
  } catch (error) {
    syncFailed(error)
    throw error
  }
}

export async function cleanupExpiredPhotoBatches(ownerUserId, now = Date.now()) {
  const batches = await localPhotoBatches(ownerUserId)
  const expired = batches.filter(batch => photoBatchExpired(batch, now))
  for (const batch of expired) await localDeleteBatch(batch.id)
  return expired.length
}

export async function resetInterruptedPhotoAnalyses(ownerUserId) {
  const batches = (await listPhotoBatches(ownerUserId)).filter(batch => batch.status === 'pending')
  let reset = 0
  for (const batch of batches) {
    const photos = await listBatchPhotos(batch.id)
    for (const photo of photos.filter(photo => photo.status === 'analyzing')) {
      await saveBatchPhoto({ ...photo, status: 'queued', error: '' })
      reset += 1
    }
  }
  return reset
}
