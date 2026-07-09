import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import net from 'node:net'
import os from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

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

test('API sobe, protege escrita e executa o fluxo critico de estoque', { timeout: 20_000 }, async t => {
  const tempDir = await mkdtemp(join(os.tmpdir(), 'estoque-api-'))
  const port = await freePort()
  const url = `http://127.0.0.1:${port}`
  let output = ''
  const child = spawn(process.execPath, ['server/index.js', '--env=.env.test'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      DB_PATH: join(tempDir, 'test.db'),
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
  const token = login.data.token

  const password = await jsonRequest(url, '/api/auth/users/user_admin', {
    method: 'PUT',
    token,
    body: { pin: 'senha-local-123' },
  })
  assert.equal(password.response.status, 200)

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
  const blockedInitialStock = await jsonRequest(url, `/api/items/variations/${variation.data.id}`, {
    method: 'PUT',
    token: secondaryLogin.data.token,
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

  const movement = await jsonRequest(url, '/api/movements', {
    token,
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

  const variations = await jsonRequest(url, '/api/items/variations')
  assert.equal(variations.data.find(row => row.id === variation.data.id).stock, 5)

  const deletedVariation = await jsonRequest(url, `/api/items/variations/${variation.data.id}`, {
    method: 'DELETE',
    token,
  })
  assert.equal(deletedVariation.response.status, 200)
  const deletedMovement = await jsonRequest(url, `/api/movements/${movement.data.id}`, {
    method: 'DELETE',
    token,
  })
  assert.equal(deletedMovement.response.status, 200)

  const childDestination = await jsonRequest(url, '/api/destinations', {
    token,
    body: { name: 'Jigger 3' },
  })
  assert.equal(childDestination.response.status, 200)
  const workOrder = await jsonRequest(url, '/api/work-orders', {
    token,
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
