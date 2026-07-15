import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import net from 'node:net'
import os from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import Database from 'better-sqlite3'

async function freePort() {
  const server = net.createServer()
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject))
  const { port } = server.address()
  await new Promise(resolve => server.close(resolve))
  return port
}

async function waitForServer(url, child, logs) {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Servidor encerrou antes do teste:\n${logs()}`)
    try {
      const response = await fetch(`${url}/api/health`)
      if (response.ok) return
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(`Servidor nao iniciou em 10 segundos:\n${logs()}`)
}

async function jsonRequest(url, path, { token, body, headers, method = body ? 'POST' : 'GET' } = {}) {
  const response = await fetch(`${url}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { 'x-auth-token': token } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { response, data: await response.json() }
}

function sessionToken(response) {
  const cookie = response.headers.get('set-cookie') || ''
  assert.match(cookie, /auth_token=/)
  assert.match(cookie, /HttpOnly/i)
  const match = cookie.match(/auth_token=([^;]+)/)
  assert.ok(match)
  return decodeURIComponent(match[1])
}

test('API sobe, protege escrita e executa o fluxo critico de estoque', { timeout: 20_000 }, async t => {
  const tempDir = await mkdtemp(join(os.tmpdir(), 'estoque-api-'))
  const dbPath = join(tempDir, 'test.db')
  const port = await freePort()
  const url = `http://127.0.0.1:${port}`
  let output = ''
  const child = spawn(process.execPath, ['server/index.js', '--env=.env.test'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      DB_PATH: dbPath,
      PHOTO_UPLOAD_DIR: join(tempDir, 'photo-uploads'),
      BACKUP_ENABLED: 'false',
      CORS_ORIGINS: '',
      GEMINI_API_KEY: '',
      GOOGLE_API_KEY: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout.on('data', chunk => { output += chunk })
  child.stderr.on('data', chunk => { output += chunk })

  t.after(async () => {
    if (child.exitCode === null) child.kill()
    await Promise.race([
      new Promise(resolve => child.once('exit', resolve)),
      new Promise(resolve => setTimeout(resolve, 3000)),
    ])
    await rm(tempDir, { recursive: true, force: true })
  })

  await waitForServer(url, child, () => output)

  const health = await fetch(`${url}/api/health`, { headers: { origin: 'http://localhost:5173' } })
  assert.equal(health.status, 200)
  const healthData = await health.json()
  assert.equal(healthData.backup.status, 'disabled')
  assert.equal(health.headers.get('access-control-allow-origin'), 'http://localhost:5173')
  assert.equal(health.headers.get('x-content-type-options'), 'nosniff')
  assert.equal(health.headers.has('x-powered-by'), false)

  const blockedCors = await fetch(`${url}/api/health`, { headers: { origin: 'https://example.com' } })
  assert.equal(blockedCors.headers.has('access-control-allow-origin'), false)

  const unauthorized = await jsonRequest(url, '/api/items', {
    body: { name: 'Teste', group: 'Teste' },
  })
  assert.equal(unauthorized.response.status, 401)

  const malformed = await fetch(`${url}/api/items`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{',
  })
  assert.equal(malformed.status, 400)
  assert.match(malformed.headers.get('content-type'), /application\/json/)

  const login = await jsonRequest(url, '/api/auth/login', {
    body: { login: 'admin', pin: 'admin123' },
  })
  assert.equal(login.response.status, 200)
  assert.equal('token' in login.data, false)
  const token = sessionToken(login.response)

  const password = await jsonRequest(url, '/api/auth/users/user_admin', {
    method: 'PUT',
    token,
    body: { pin: 'senha-local-123' },
  })
  assert.equal(password.response.status, 200)

  const operator = await jsonRequest(url, '/api/auth/users', {
    token,
    body: { name: 'Operador API', username: 'operador-api', role: 'operador', pin: 'operador-inicial-123' },
  })
  assert.equal(operator.response.status, 200)
  const operatorLogin = await jsonRequest(url, '/api/auth/login', {
    body: { login: 'operador-api', pin: 'operador-inicial-123' },
  })
  const operatorToken = sessionToken(operatorLogin.response)
  const operatorPassword = await jsonRequest(url, `/api/auth/users/${operator.data.id}`, {
    method: 'PUT',
    token: operatorToken,
    body: { pin: 'operador-seguro-456' },
  })
  assert.equal(operatorPassword.response.status, 200)

  const visitor = await jsonRequest(url, '/api/auth/users', {
    token,
    body: { name: 'Visitante API', username: 'visitante-api', role: 'visitante', pin: 'visitante-inicial-123' },
  })
  assert.equal(visitor.response.status, 200)
  const visitorLogin = await jsonRequest(url, '/api/auth/login', {
    body: { login: 'visitante-api', pin: 'visitante-inicial-123' },
  })
  const visitorToken = sessionToken(visitorLogin.response)
  const visitorPassword = await jsonRequest(url, `/api/auth/users/${visitor.data.id}`, {
    method: 'PUT',
    token: visitorToken,
    body: { pin: 'visitante-seguro-456' },
  })
  assert.equal(visitorPassword.response.status, 200)

  const visitorCannotCreateSupplier = await jsonRequest(url, '/api/suppliers', {
    token: visitorToken,
    body: { name: 'Fornecedor visitante' },
  })
  assert.equal(visitorCannotCreateSupplier.response.status, 403)
  const operatorSupplier = await jsonRequest(url, '/api/suppliers', {
    token: operatorToken,
    body: { name: 'Fornecedor digitado' },
  })
  assert.equal(operatorSupplier.response.status, 200)
  assert.equal(operatorSupplier.data.name, 'Fornecedor digitado')

  const operatorCannotCreateItem = await jsonRequest(url, '/api/items', {
    token: operatorToken,
    body: { name: 'Item proibido', group: 'Teste' },
  })
  assert.equal(operatorCannotCreateItem.response.status, 403)
  const visitorCannotCreateItem = await jsonRequest(url, '/api/items', {
    token: visitorToken,
    body: { name: 'Item proibido', group: 'Teste' },
  })
  assert.equal(visitorCannotCreateItem.response.status, 403)

  const operatorCanRequestSuggestion = await jsonRequest(url, '/api/items/suggest', {
    token: operatorToken,
    body: { image: 'data:image/jpeg;base64,AAAA' },
  })
  assert.equal(operatorCanRequestSuggestion.response.status, 503)
  const visitorCannotRequestSuggestion = await jsonRequest(url, '/api/items/suggest', {
    token: visitorToken,
    body: { image: 'data:image/jpeg;base64,AAAA' },
  })
  assert.equal(visitorCannotRequestSuggestion.response.status, 403)

  const visitorCannotListPhotoBatches = await jsonRequest(url, '/api/photo-batches', {
    token: visitorToken,
  })
  assert.equal(visitorCannotListPhotoBatches.response.status, 403)

  const photoBatchId = 'photo_batch_api'
  const photoId = 'photo_api'
  const photoCreatedAt = new Date().toISOString()
  const photoBatch = await jsonRequest(url, `/api/photo-batches/${photoBatchId}`, {
    method: 'PUT',
    token: operatorToken,
    body: {
      id: photoBatchId,
      ownerUserId: operator.data.id,
      operatorName: 'Operador API',
      type: 'entrada',
      status: 'pending',
      createdAt: photoCreatedAt,
      updatedAt: photoCreatedAt,
      completedAt: '',
      expiresAt: '',
      defaults: { supplier: 'Fornecedor API', note: '' },
    },
  })
  assert.equal(photoBatch.response.status, 200)
  assert.equal(photoBatch.data.ownerUserId, operator.data.id)

  const photoMetadata = await jsonRequest(url, `/api/photo-batches/${photoBatchId}/photos/${photoId}`, {
    method: 'PUT',
    token: operatorToken,
    body: {
      id: photoId,
      batchId: photoBatchId,
      fileName: 'produto.jpg',
      createdAt: photoCreatedAt,
      updatedAt: photoCreatedAt,
      status: 'queued',
      qty: 1,
      variationId: 'var_photo_api',
      movementId: 'mov_photo_api',
      suggestion: { identified: true, name: 'Item novo' },
      createCatalog: true,
      catalog: { group: 'Teste', name: 'Item novo', unit: 'UN', attributes: [], initialStock: 0 },
      overrides: {},
    },
  })
  assert.equal(photoMetadata.response.status, 200)
  assert.equal(photoMetadata.data.hasImage, false)

  const imageBytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9])
  const photoUpload = await fetch(`${url}/api/photo-batches/${photoBatchId}/photos/${photoId}/image`, {
    method: 'PUT',
    headers: { 'x-auth-token': operatorToken, 'content-type': 'image/jpeg' },
    body: imageBytes,
  })
  assert.equal(photoUpload.status, 200)
  assert.equal((await photoUpload.json()).hasImage, true)

  const latestPhotoId = 'photo_api_latest'
  const latestPhotoCreatedAt = new Date(Date.parse(photoCreatedAt) + 500).toISOString()
  await jsonRequest(url, `/api/photo-batches/${photoBatchId}/photos/${latestPhotoId}`, {
    method: 'PUT',
    token: operatorToken,
    body: {
      id: latestPhotoId,
      batchId: photoBatchId,
      fileName: 'produto-recente.jpg',
      createdAt: latestPhotoCreatedAt,
      updatedAt: latestPhotoCreatedAt,
      status: 'matched',
      qty: 1,
      variationId: 'var_photo_api',
      movementId: 'mov_photo_api_latest',
      suggestion: null,
      overrides: {},
    },
  })
  const latestImageBytes = Buffer.from([0xff, 0xd8, 0x01, 0xff, 0xd9])
  const latestPhotoUpload = await fetch(`${url}/api/photo-batches/${photoBatchId}/photos/${latestPhotoId}/image`, {
    method: 'PUT',
    headers: { 'x-auth-token': operatorToken, 'content-type': 'image/jpeg' },
    body: latestImageBytes,
  })
  assert.equal(latestPhotoUpload.status, 200)

  const accountBatches = await jsonRequest(url, '/api/photo-batches', { token: operatorToken })
  assert.equal(accountBatches.response.status, 200)
  assert.ok(accountBatches.data.some(batch => batch.id === photoBatchId))
  const accountPhotos = await jsonRequest(url, `/api/photo-batches/${photoBatchId}/photos`, { token: operatorToken })
  assert.equal(accountPhotos.data[0].id, photoId)
  assert.equal(accountPhotos.data[0].hasImage, true)
  assert.equal(accountPhotos.data[0].createCatalog, true)
  assert.equal(accountPhotos.data[0].catalog.name, 'Item novo')

  const downloadedPhoto = await fetch(`${url}/api/photo-batches/${photoBatchId}/photos/${photoId}/image`, {
    headers: { 'x-auth-token': operatorToken },
  })
  assert.equal(downloadedPhoto.status, 200)
  assert.deepEqual(Buffer.from(await downloadedPhoto.arrayBuffer()), imageBytes)

  const adminPhotoBatches = await jsonRequest(url, '/api/photo-batches?all=1', { token })
  assert.ok(adminPhotoBatches.data.some(batch => batch.id === photoBatchId))

  const adminEditedPhotoBatch = await jsonRequest(url, `/api/photo-batches/${photoBatchId}`, {
    method: 'PUT',
    token,
    body: {
      ...photoBatch.data,
      updatedAt: new Date(Date.parse(photoCreatedAt) + 1000).toISOString(),
      status: 'completed',
      completedAt: new Date(Date.parse(photoCreatedAt) + 1000).toISOString(),
      defaults: { supplier: 'Fornecedor alterado pelo administrador', note: '' },
    },
  })
  assert.equal(adminEditedPhotoBatch.response.status, 200)
  assert.equal(adminEditedPhotoBatch.data.ownerUserId, operator.data.id)
  assert.equal(adminEditedPhotoBatch.data.defaults.supplier, 'Fornecedor alterado pelo administrador')

  const expiredBatchId = 'photo_batch_expired_api'
  await jsonRequest(url, `/api/photo-batches/${expiredBatchId}`, {
    method: 'PUT',
    token: operatorToken,
    body: {
      id: expiredBatchId,
      type: 'saida',
      status: 'completed',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      completedAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-01-31T00:00:00.000Z',
      defaults: {},
    },
  })
  const batchesAfterCleanup = await jsonRequest(url, '/api/photo-batches', { token: operatorToken })
  assert.equal(batchesAfterCleanup.data.some(batch => batch.id === expiredBatchId), false)

  const otherOperator = await jsonRequest(url, '/api/auth/users', {
    token,
    body: { name: 'Operador Foto 2', username: 'operador-foto-2', role: 'operador', pin: 'operador-foto-inicial-123' },
  })
  const otherOperatorLogin = await jsonRequest(url, '/api/auth/login', {
    body: { login: 'operador-foto-2', pin: 'operador-foto-inicial-123' },
  })
  const otherOperatorToken = sessionToken(otherOperatorLogin.response)
  await jsonRequest(url, `/api/auth/users/${otherOperator.data.id}`, {
    method: 'PUT',
    token: otherOperatorToken,
    body: { pin: 'operador-foto-seguro-456' },
  })
  const latestCatalogPhoto = await fetch(`${url}/api/photo-batches/variation/var_photo_api/image`, {
    headers: { 'x-auth-token': visitorToken },
  })
  assert.equal(latestCatalogPhoto.status, 200)
  assert.deepEqual(Buffer.from(await latestCatalogPhoto.arrayBuffer()), latestImageBytes)
  const otherAccountBatches = await jsonRequest(url, '/api/photo-batches', { token: otherOperatorToken })
  assert.equal(otherAccountBatches.data.some(batch => batch.id === photoBatchId), false)
  const otherAccountCannotOpenBatch = await jsonRequest(url, `/api/photo-batches/${photoBatchId}/photos`, { token: otherOperatorToken })
  assert.equal(otherAccountCannotOpenBatch.response.status, 403)

  const removedPhotoBatch = await jsonRequest(url, `/api/photo-batches/${photoBatchId}`, {
    method: 'DELETE',
    token,
  })
  assert.equal(removedPhotoBatch.response.status, 200)
  const removedPhotoImage = await fetch(`${url}/api/photo-batches/${photoBatchId}/photos/${photoId}/image`, {
    headers: { 'x-auth-token': operatorToken },
  })
  assert.equal(removedPhotoImage.status, 404)
  const permanentCatalogPhoto = await fetch(`${url}/api/photo-batches/variation/var_photo_api/image`, {
    headers: { 'x-auth-token': visitorToken },
  })
  assert.equal(permanentCatalogPhoto.status, 200)
  assert.deepEqual(Buffer.from(await permanentCatalogPhoto.arrayBuffer()), latestImageBytes)

  const role = await jsonRequest(url, '/api/roles', {
    token,
    body: { name: 'Operador Teste' },
  })
  assert.equal(role.response.status, 200)

  const person = await jsonRequest(url, '/api/people', {
    token,
    body: { name: 'Pessoa Teste', role: 'Operador Teste' },
  })
  assert.equal(person.response.status, 200)

  const renamedRole = await jsonRequest(url, `/api/roles/${role.data.id}`, {
    method: 'PUT',
    token,
    body: { name: 'Operador Atualizado', description: '', active: true },
  })
  assert.equal(renamedRole.response.status, 200)
  const peopleAfterRole = await jsonRequest(url, '/api/people')
  assert.equal(peopleAfterRole.data.find(row => row.id === person.data.id).role, 'Operador Atualizado')

  const item = await jsonRequest(url, '/api/items', {
    token,
    body: { name: 'Rolamento de teste', group: 'Mecanica', unit: 'UN' },
  })
  assert.equal(item.response.status, 200)

  const duplicateItem = await jsonRequest(url, '/api/items', {
    token,
    body: { name: 'ROLAMENTO DE TESTE', group: 'Outro grupo', category: 'Reposição', unit: 'UN' },
  })
  assert.equal(duplicateItem.response.status, 409)
  assert.match(duplicateItem.data.error, /já existe este item no catálogo/i)

  const variation = await jsonRequest(url, '/api/items/variations', {
    token,
    body: { itemId: item.data.id, values: { medida: '10mm' }, stock: 2 },
  })
  assert.equal(variation.response.status, 200)

  const directPhotoBytes = Buffer.from([0xff, 0xd8, 0x02, 0xff, 0xd9])
  const visitorCannotUploadVariationPhoto = await fetch(`${url}/api/photo-batches/variation/${variation.data.id}/image`, {
    method: 'PUT',
    headers: { 'x-auth-token': visitorToken, 'content-type': 'image/jpeg' },
    body: directPhotoBytes,
  })
  assert.equal(visitorCannotUploadVariationPhoto.status, 403)
  const directVariationPhoto = await fetch(`${url}/api/photo-batches/variation/${variation.data.id}/image`, {
    method: 'PUT',
    headers: { 'x-auth-token': operatorToken, 'content-type': 'image/jpeg' },
    body: directPhotoBytes,
  })
  assert.equal(directVariationPhoto.status, 200)
  const downloadedVariationPhoto = await fetch(`${url}/api/photo-batches/variation/${variation.data.id}/image`, {
    headers: { 'x-auth-token': visitorToken },
  })
  assert.equal(downloadedVariationPhoto.status, 200)
  assert.deepEqual(Buffer.from(await downloadedVariationPhoto.arrayBuffer()), directPhotoBytes)
  const visitorCannotDeleteVariationPhoto = await fetch(`${url}/api/photo-batches/variation/${variation.data.id}/image`, {
    method: 'DELETE',
    headers: { 'x-auth-token': visitorToken },
  })
  assert.equal(visitorCannotDeleteVariationPhoto.status, 403)
  const removedVariationPhoto = await fetch(`${url}/api/photo-batches/variation/${variation.data.id}/image`, {
    method: 'DELETE',
    headers: { 'x-auth-token': operatorToken },
  })
  assert.equal(removedVariationPhoto.status, 200)
  const missingVariationPhoto = await fetch(`${url}/api/photo-batches/variation/${variation.data.id}/image`, {
    headers: { 'x-auth-token': visitorToken },
  })
  assert.equal(missingVariationPhoto.status, 404)
  const restoredVariationPhoto = await fetch(`${url}/api/photo-batches/variation/${variation.data.id}/image`, {
    method: 'PUT',
    headers: { 'x-auth-token': operatorToken, 'content-type': 'image/jpeg' },
    body: directPhotoBytes,
  })
  assert.equal(restoredVariationPhoto.status, 200)

  const secondaryAdmin = await jsonRequest(url, '/api/auth/users', {
    token,
    body: { name: 'Admin Estoque', username: 'admin-estoque', role: 'admin', pin: 'admin-estoque-123' },
  })
  assert.equal(secondaryAdmin.response.status, 200)
  const secondaryLogin = await jsonRequest(url, '/api/auth/login', {
    body: { login: 'admin-estoque', pin: 'admin-estoque-123' },
  })
  assert.equal(secondaryLogin.response.status, 200)
  const secondaryToken = sessionToken(secondaryLogin.response)
  const secondaryPassword = await jsonRequest(url, `/api/auth/users/${secondaryAdmin.data.id}`, {
    method: 'PUT',
    token: secondaryToken,
    body: { pin: 'admin-estoque-seguro-456' },
  })
  assert.equal(secondaryPassword.response.status, 200)
  const blockedInitialStock = await jsonRequest(url, `/api/items/variations/${variation.data.id}`, {
    method: 'PUT',
    token: secondaryToken,
    body: { ...variation.data, initialStock: 9 },
  })
  assert.equal(blockedInitialStock.response.status, 403)
  const changedInitialStock = await jsonRequest(url, `/api/items/variations/${variation.data.id}`, {
    method: 'PUT',
    token,
    body: { ...variation.data, initialStock: 7 },
  })
  assert.equal(changedInitialStock.response.status, 200)
  assert.equal(changedInitialStock.data.initialStock, 7)

  const visitorCannotMoveStock = await jsonRequest(url, '/api/movements', {
    token: visitorToken,
    body: {
      type: 'entrada',
      itemId: item.data.id,
      variationId: variation.data.id,
      itemName: item.data.name,
      qty: 1,
    },
  })
  assert.equal(visitorCannotMoveStock.response.status, 403)

  const movement = await jsonRequest(url, '/api/movements', {
    token: operatorToken,
    body: {
      type: 'entrada',
      itemId: item.data.id,
      variationId: variation.data.id,
      itemName: item.data.name,
      qty: 3,
    },
  })
  assert.equal(movement.response.status, 200)
  assert.equal(movement.data.stockAfter, 5)

  const staleVariationEdit = await jsonRequest(url, `/api/items/variations/${variation.data.id}`, {
    method: 'PUT',
    token,
    body: { ...changedInitialStock.data, stock: 0 },
  })
  assert.equal(staleVariationEdit.response.status, 200)
  assert.equal(staleVariationEdit.data.stock, 5)
  const variationsAfterStaleEdit = await jsonRequest(url, '/api/items/variations')
  assert.equal(variationsAfterStaleEdit.data.find(row => row.id === variation.data.id).stock, 5)

  const batchBody = {
    requestId: 'photo_batch_test_001',
    type: 'entrada',
    items: [{
      itemId: item.data.id,
      variationId: variation.data.id,
      itemName: item.data.name,
      itemGroup: item.data.group,
      itemUnit: item.data.unit,
      variationValues: variation.data.values,
      qty: 2,
    }],
  }
  const firstBatch = await jsonRequest(url, '/api/movements/batch', { token: operatorToken, body: batchBody })
  assert.equal(firstBatch.response.status, 200)
  assert.equal(firstBatch.data.movements[0].stockAfter, 7)
  const repeatedBatch = await jsonRequest(url, '/api/movements/batch', { token: operatorToken, body: batchBody })
  assert.equal(repeatedBatch.response.status, 200)
  assert.deepEqual(repeatedBatch.data, firstBatch.data)
  const variationsAfterRepeatedBatch = await jsonRequest(url, '/api/items/variations')
  assert.equal(variationsAfterRepeatedBatch.data.find(row => row.id === variation.data.id).stock, 7)

  const newCatalogLine = {
    newCatalog: {
      group: 'Materiais de Consumo',
      category: 'Adesivos',
      subcategory: '',
      name: 'Adesivo por foto',
      unit: 'UN',
      attributes: [
        { name: 'Modelo', value: '120' },
        { name: 'Marca', value: 'Tekbond' },
      ],
      initialStock: 4,
    },
    qty: 2,
    unitCost: 12.5,
  }
  const operatorCannotCatalogByMovement = await jsonRequest(url, '/api/movements/batch', {
    token: operatorToken,
    body: { requestId: 'photo_catalog_operator_001', type: 'entrada', items: [newCatalogLine] },
  })
  assert.equal(operatorCannotCatalogByMovement.response.status, 403)

  const catalogBatchBody = {
    requestId: 'photo_catalog_admin_001',
    type: 'entrada',
    fields: { docRef: 'NF FOTO 1', note: 'Cadastro na implantação' },
    items: [newCatalogLine],
  }
  const catalogBatch = await jsonRequest(url, '/api/movements/batch', { token, body: catalogBatchBody })
  assert.equal(catalogBatch.response.status, 200)
  assert.equal(catalogBatch.data.initialMovements.length, 1)
  assert.equal(catalogBatch.data.initialMovements[0].stockBefore, 0)
  assert.equal(catalogBatch.data.initialMovements[0].stockAfter, 4)
  assert.equal(catalogBatch.data.initialMovements[0].docRef, 'AJUSTE')
  assert.equal(catalogBatch.data.movements[0].stockBefore, 4)
  assert.equal(catalogBatch.data.movements[0].stockAfter, 6)

  const repeatedCatalogBatch = await jsonRequest(url, '/api/movements/batch', { token, body: catalogBatchBody })
  assert.deepEqual(repeatedCatalogBatch.data, catalogBatch.data)
  const catalogItems = await jsonRequest(url, '/api/items')
  const catalogedItem = catalogItems.data.find(row => row.name === 'Adesivo por foto')
  assert.ok(catalogedItem)
  const catalogVariations = await jsonRequest(url, '/api/items/variations')
  const catalogedVariation = catalogVariations.data.find(row => row.itemId === catalogedItem.id)
  assert.equal(catalogedVariation.stock, 6)
  assert.equal(catalogedVariation.initialStock, 4)
  assert.deepEqual(catalogedVariation.values, { Modelo: '120', Marca: 'Tekbond' })

  const duplicateCatalogBatch = await jsonRequest(url, '/api/movements/batch', {
    token,
    body: { requestId: 'photo_catalog_admin_002', type: 'entrada', items: [newCatalogLine] },
  })
  assert.equal(duplicateCatalogBatch.response.status, 409)
  assert.equal(duplicateCatalogBatch.data.code, 'ITEM_DUPLICATE')

  const operatorCannotDeleteMovement = await jsonRequest(url, `/api/movements/${movement.data.id}`, {
    method: 'DELETE',
    token: operatorToken,
  })
  assert.equal(operatorCannotDeleteMovement.response.status, 403)

  const variations = await jsonRequest(url, '/api/items/variations')
  assert.equal(variations.data.find(row => row.id === variation.data.id).stock, 7)

  const deletedMovement = await jsonRequest(url, `/api/movements/${movement.data.id}`, {
    method: 'DELETE',
    token,
  })
  assert.equal(deletedMovement.response.status, 200)
  const movementsAfterDelete = await jsonRequest(url, '/api/movements')
  assert.equal(movementsAfterDelete.data.some(row => row.id === movement.data.id), false)
  const inspectionAfterDelete = new Database(dbPath, { readonly: true })
  assert.equal(inspectionAfterDelete.prepare('SELECT id FROM movements WHERE id = ?').get(movement.data.id), undefined)
  assert.equal(inspectionAfterDelete.prepare('SELECT COUNT(*) AS count FROM movement_batch_requests WHERE request_id = ?').get(batchBody.requestId).count, 1)
  assert.equal(inspectionAfterDelete.prepare('SELECT source_photo_id FROM variation_photos WHERE variation_id = ?').pluck().get('var_photo_api'), latestPhotoId)
  assert.equal(inspectionAfterDelete.pragma('user_version', { simple: true }), 4)
  inspectionAfterDelete.close()

  const deletedVariation = await jsonRequest(url, `/api/items/variations/${variation.data.id}`, {
    method: 'DELETE',
    token,
  })
  assert.equal(deletedVariation.response.status, 200)
  const variationsAfterDelete = await jsonRequest(url, '/api/items/variations')
  assert.equal(variationsAfterDelete.data.some(row => row.id === variation.data.id), false)

  const childDestination = await jsonRequest(url, '/api/destinations', {
    token,
    body: { name: 'Jigger 3' },
  })
  assert.equal(childDestination.response.status, 200)
  const workOrder = await jsonRequest(url, '/api/work-orders', {
    token: operatorToken,
    body: {
      destinationId: childDestination.data.id,
      requestedBy: 'Pessoa Teste',
      requestDate: '2026-07-07',
      serviceType: 'Mecânica',
    },
  })
  assert.equal(workOrder.response.status, 200)
  assert.equal(workOrder.data.destinationName, 'Jigger 3')

  const parentDestination = await jsonRequest(url, '/api/destinations', {
    token,
    body: { name: 'Jiggers' },
  })
  assert.equal(parentDestination.response.status, 200)
  const movedDestination = await jsonRequest(url, `/api/destinations/${childDestination.data.id}`, {
    method: 'PUT',
    token,
    body: { name: 'Jigger 3', parentId: parentDestination.data.id, active: true },
  })
  assert.equal(movedDestination.response.status, 200)
  const refreshedOrder = await jsonRequest(url, `/api/work-orders/${workOrder.data.id}`)
  assert.equal(refreshedOrder.data.destinationName, 'Jigger 3')
  assert.equal(refreshedOrder.data.equipment, 'Jigger 3')

  const inspectionDb = new Database(dbPath)
  inspectionDb.prepare("UPDATE sessions SET expires_at = datetime('now', '-1 minute') WHERE token = ?").run(visitorToken)
  inspectionDb.close()
  const expiredSession = await jsonRequest(url, '/api/auth/me', { token: visitorToken })
  assert.equal(expiredSession.response.status, 401)

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const failed = await jsonRequest(url, '/api/auth/login', {
      body: { login: 'admin', pin: 'errada' },
    })
    assert.equal(failed.response.status, 401)
  }
  const limited = await jsonRequest(url, '/api/auth/login', {
    body: { login: 'admin', pin: 'errada' },
  })
  assert.equal(limited.response.status, 429)
  assert.ok(limited.response.headers.get('retry-after'))
})
