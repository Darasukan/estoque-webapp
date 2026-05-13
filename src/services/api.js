const BASE = '/api'

function setAuthData(user) {
  localStorage.setItem('auth_user', JSON.stringify(user))
  localStorage.removeItem('auth_token')
  sessionStorage.removeItem('auth_token')
  sessionStorage.removeItem('auth_user')
}

function clearAuthData() {
  localStorage.removeItem('auth_token')
  localStorage.removeItem('auth_user')
  sessionStorage.removeItem('auth_token')
  sessionStorage.removeItem('auth_user')
}

async function request(path, options = {}) {
  const url = BASE + path
  const headers = {
    ...options.headers
  }

  // Only set Content-Type for requests with a body (POST, PUT, etc.)
  if (options.body) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(url, { ...options, headers, credentials: 'include' })

  if (res.status === 401) {
    clearAuthData()
  }

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error(data.error || `Erro ${res.status}`)
  }

  return data
}

// ===== Auth =====
export async function login(name, pin) {
  const data = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ name, pin })
  })
  setAuthData(data.user)
  return data.user
}

export async function logout() {
  try { await request('/auth/logout', { method: 'POST' }) } catch {}
  clearAuthData()
}

export async function getMe() {
  return request('/auth/me')
}

export async function getUsers() {
  return request('/auth/users')
}

export async function createUser(data) {
  return request('/auth/users', { method: 'POST', body: JSON.stringify(data) })
}

export async function updateUser(id, data) {
  return request(`/auth/users/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export async function deleteUser(id) {
  return request(`/auth/users/${id}`, { method: 'DELETE' })
}

// ===== Items =====
export async function getItems() {
  return request('/items')
}

export async function createItem(data) {
  return request('/items', { method: 'POST', body: JSON.stringify(data) })
}

export async function updateItem(id, data) {
  return request(`/items/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export async function deleteItem(id) {
  return request(`/items/${id}`, { method: 'DELETE' })
}

// ===== Variations =====
export async function getVariations() {
  return request('/items/variations')
}

export async function createVariation(data) {
  return request('/items/variations', { method: 'POST', body: JSON.stringify(data) })
}

export async function updateVariation(id, data) {
  return request(`/items/variations/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export async function deleteVariation(id) {
  return request(`/items/variations/${id}`, { method: 'DELETE' })
}

// ===== Movements =====
export async function getMovements() {
  return request('/movements')
}

export async function createMovement(data) {
  return request('/movements', { method: 'POST', body: JSON.stringify(data) })
}

export async function createMovementBatch(data) {
  return request('/movements/batch', { method: 'POST', body: JSON.stringify(data) })
}

export async function updateMovement(id, data) {
  return request(`/movements/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export async function deleteMovement(id) {
  return request(`/movements/${id}`, { method: 'DELETE' })
}

// ===== Locations =====
export async function getLocations() {
  return request('/locations')
}

export async function createLocation(data) {
  return request('/locations', { method: 'POST', body: JSON.stringify(data) })
}

export async function updateLocation(id, data) {
  return request(`/locations/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export async function deleteLocation(id) {
  return request(`/locations/${id}`, { method: 'DELETE' })
}

// ===== Destinations =====
export async function getDestinations() {
  return request('/destinations')
}

export async function createDestination(data) {
  return request('/destinations', { method: 'POST', body: JSON.stringify(data) })
}

export async function updateDestination(id, data) {
  return request(`/destinations/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export async function deleteDestination(id) {
  return request(`/destinations/${id}`, { method: 'DELETE' })
}

// ===== People =====
export async function getPeople() {
  return request('/people')
}

export async function createPerson(data) {
  return request('/people', { method: 'POST', body: JSON.stringify(data) })
}

export async function updatePerson(id, data) {
  return request(`/people/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export async function deletePerson(id) {
  return request(`/people/${id}`, { method: 'DELETE' })
}

// ===== Suppliers =====
export async function getSuppliers() {
  return request('/suppliers')
}

export async function createSupplier(data) {
  return request('/suppliers', { method: 'POST', body: JSON.stringify(data) })
}

export async function updateSupplier(id, data) {
  return request(`/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export async function deleteSupplier(id) {
  return request(`/suppliers/${id}`, { method: 'DELETE' })
}

// ===== Roles =====
export async function getRoles() {
  return request('/roles')
}

export async function createRole(data) {
  return request('/roles', { method: 'POST', body: JSON.stringify(data) })
}

export async function updateRole(id, data) {
  return request(`/roles/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export async function deleteRole(id) {
  return request(`/roles/${id}`, { method: 'DELETE' })
}

// ===== EPIs =====
export async function getEpiRoleRules() {
  return request('/epis/role-rules')
}

export async function createEpiRoleRule(data) {
  return request('/epis/role-rules', { method: 'POST', body: JSON.stringify(data) })
}

export async function updateEpiRoleRule(id, data) {
  return request(`/epis/role-rules/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export async function deleteEpiRoleRule(id) {
  return request(`/epis/role-rules/${id}`, { method: 'DELETE' })
}

export async function getEpiPeriodicities() {
  return request('/epis/periodicities')
}

export async function createEpiPeriodicity(data) {
  return request('/epis/periodicities', { method: 'POST', body: JSON.stringify(data) })
}

export async function updateEpiPeriodicity(id, data) {
  return request(`/epis/periodicities/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export async function deleteEpiPeriodicity(id) {
  return request(`/epis/periodicities/${id}`, { method: 'DELETE' })
}

// ===== Seed / Order =====
export async function getDisplayOrder() {
  return request('/seed/order')
}

export async function saveDisplayOrder(data) {
  return request('/seed/order', { method: 'PUT', body: JSON.stringify(data) })
}

export async function seedPopulate(items, variations, extras = {}) {
  return request('/seed/populate', { method: 'POST', body: JSON.stringify({ items, variations, ...extras }) })
}

export async function seedReset() {
  return request('/seed/reset', { method: 'POST' })
}

// ===== Work Orders =====
export async function getWorkOrders() {
  return request('/work-orders')
}

export async function getWorkOrder(id) {
  return request(`/work-orders/${id}`)
}

export async function getWorkOrderEvents(id) {
  return request(`/work-orders/${id}/events`)
}

export async function createWorkOrder(data) {
  return request('/work-orders', { method: 'POST', body: JSON.stringify(data) })
}

export async function updateWorkOrder(id, data) {
  return request(`/work-orders/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export async function deleteWorkOrder(id) {
  return request(`/work-orders/${id}`, { method: 'DELETE' })
}

export async function addWorkOrderItem(workOrderId, data) {
  return request(`/work-orders/${workOrderId}/items`, { method: 'POST', body: JSON.stringify(data) })
}

export async function removeWorkOrderItem(workOrderId, itemId) {
  return request(`/work-orders/${workOrderId}/items/${itemId}`, { method: 'DELETE' })
}

export async function linkMovementToWorkOrder(workOrderId, movementId) {
  return request(`/work-orders/${workOrderId}/items/link`, { method: 'POST', body: JSON.stringify({ movementId }) })
}

export async function getWorkOrderReport() {
  return request('/work-orders/report/by-destination')
}

// ===== Monthly Closings =====
export async function getClosings() {
  return request('/closings')
}

export async function getClosing(id) {
  return request(`/closings/${id}`)
}

export async function createClosing(data) {
  return request('/closings', { method: 'POST', body: JSON.stringify(data) })
}

export async function deleteClosing(id) {
  return request(`/closings/${id}`, { method: 'DELETE' })
}

// ===== Motors =====
export async function getMotors() {
  return request('/motors')
}

export async function createMotor(data) {
  return request('/motors', { method: 'POST', body: JSON.stringify(data) })
}

export async function updateMotor(id, data) {
  return request(`/motors/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export async function deleteMotor(id) {
  return request(`/motors/${id}`, { method: 'DELETE' })
}

export async function getMotorEvents(id) {
  return request(`/motors/${id}/events`)
}

export async function createMotorEvent(id, data) {
  return request(`/motors/${id}/events`, { method: 'POST', body: JSON.stringify(data) })
}

export async function updateMotorEvent(motorId, eventId, data) {
  return request(`/motors/${motorId}/events/${eventId}`, { method: 'PUT', body: JSON.stringify(data) })
}

export async function deleteMotorEvent(motorId, eventId) {
  return request(`/motors/${motorId}/events/${eventId}`, { method: 'DELETE' })
}

export async function getMotorMaterials(motorId) {
  return request(`/motors/${motorId}/materials`)
}

export async function createMotorMaterial(motorId, data) {
  return request(`/motors/${motorId}/materials`, { method: 'POST', body: JSON.stringify(data) })
}

export async function deleteMotorMaterial(motorId, materialId) {
  return request(`/motors/${motorId}/materials/${materialId}`, { method: 'DELETE' })
}
