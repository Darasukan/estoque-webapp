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
      BACKUP_ENABLED: 'false',
      CORS_ORIGINS: '',
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

  const variation = await jsonRequest(url, '/api/items/variations', {
    token,
    body: { itemId: item.data.id, values: { medida: '10mm' }, stock: 2 },
  })
  assert.equal(variation.response.status, 200)

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

  const operatorCannotDeleteMovement = await jsonRequest(url, `/api/movements/${movement.data.id}`, {
    method: 'DELETE',
    token: operatorToken,
  })
  assert.equal(operatorCannotDeleteMovement.response.status, 403)

  const variations = await jsonRequest(url, '/api/items/variations')
  assert.equal(variations.data.find(row => row.id === variation.data.id).stock, 5)

  const deletedMovement = await jsonRequest(url, `/api/movements/${movement.data.id}`, {
    method: 'DELETE',
    token,
  })
  assert.equal(deletedMovement.response.status, 200)
  const movementsAfterDelete = await jsonRequest(url, '/api/movements')
  assert.equal(movementsAfterDelete.data.some(row => row.id === movement.data.id), false)
  const inspectionAfterDelete = new Database(dbPath, { readonly: true })
  assert.equal(inspectionAfterDelete.prepare('SELECT id FROM movements WHERE id = ?').get(movement.data.id), undefined)
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
