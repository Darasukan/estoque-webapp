import { computed, ref } from 'vue'
import * as api from '../services/api.js'
import { normalizeSearchText } from '../utils/globalSearch.js'

const motors = ref([])
const motorEvents = ref({})
const motorMaterials = ref({})

export const MOTOR_STATUSES = [
  { id: 'ativo', label: 'Ativo' },
  { id: 'em_manutencao', label: 'Em manutenção' },
  { id: 'reserva', label: 'Reserva' },
  { id: 'inativo', label: 'Inativo' },
]

export const MOTOR_EVENT_TYPES = [
  { id: 'rebobinado', label: 'Rebobinado' },
  { id: 'reformado', label: 'Reformado' },
  { id: 'revisado', label: 'Revisado' },
  { id: 'enrolado', label: 'Enrolado' },
  { id: 'instalado', label: 'Instalado' },
  { id: 'removido', label: 'Removido' },
  { id: 'movimentado', label: 'Movimentado' },
  { id: 'inativado', label: 'Inativado' },
  { id: 'reativado', label: 'Reativado' },
  { id: 'observacao', label: 'Observação' },
]

export function motorStatusLabel(status) {
  return MOTOR_STATUSES.find(s => s.id === status)?.label || status || ''
}

export function motorEventLabel(type) {
  if (type === 'enrolar') return 'Enrolado'
  return MOTOR_EVENT_TYPES.find(t => t.id === type)?.label || type || ''
}

export function motorMatchesSearch(motor, query, destinationName = '') {
  const terms = normalizeSearchText(query).split(/\s+/).filter(Boolean)
  if (!terms.length) return true
  const haystack = normalizeSearchText([
    motor.tag,
    motor.serial,
    motor.name,
    motor.manufacturer,
    motor.power,
    motor.voltage,
    motor.rpm,
    motor.destinationName,
    destinationName,
    motorStatusLabel(motor.status),
    motor.notes,
  ].filter(Boolean).join(' '))
  return terms.every(term => haystack.includes(term))
}

export function buildMotorDestinationTree(motors, destinations) {
  const nodes = new Map(destinations.map(destination => [destination.id, {
    id: destination.id,
    name: destination.name,
    parentId: destination.parentId || null,
    motors: [],
    children: [],
  }]))
  const roots = []
  const unassigned = []

  for (const node of nodes.values()) {
    const parent = nodes.get(node.parentId)
    if (parent && parent !== node) parent.children.push(node)
    else roots.push(node)
  }

  for (const motor of motors) {
    const node = nodes.get(motor.destinationId)
    if (node) node.motors.push(motor)
    else unassigned.push(motor)
  }

  function finish(node) {
    node.children = node.children.map(finish).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base', numeric: true }))
    node.motorCount = node.motors.length + node.children.reduce((total, child) => total + child.motorCount, 0)
    return node.motorCount ? node : null
  }

  const tree = roots.map(finish).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base', numeric: true }))
  if (unassigned.length) tree.push({ id: '__unassigned__', name: 'Sem destino', parentId: null, motors: unassigned, children: [], motorCount: unassigned.length })
  return tree
}

export function useMotors() {
  async function loadData() {
    motors.value = await api.getMotors()
  }

  async function addMotor(data) {
    const created = await api.createMotor(data)
    motors.value.push(created)
    motors.value.sort((a, b) => a.tag.localeCompare(b.tag))
    return created
  }

  async function editMotor(id, data) {
    const updated = await api.updateMotor(id, data)
    const idx = motors.value.findIndex(m => m.id === id)
    if (idx !== -1) motors.value.splice(idx, 1, updated)
    return updated
  }

  async function removeMotor(id) {
    const result = await api.deleteMotor(id)
    const idx = motors.value.findIndex(m => m.id === id)
    if (idx !== -1) motors.value.splice(idx, 1)
    const { [id]: removed, ...rest } = motorEvents.value
    motorEvents.value = rest
    const { [id]: removedMaterials, ...materialRest } = motorMaterials.value
    motorMaterials.value = materialRest
    return result
  }

  async function loadEvents(motorId) {
    motorEvents.value = { ...motorEvents.value, [motorId]: await api.getMotorEvents(motorId) }
    return motorEvents.value[motorId]
  }

  async function loadMaterials(motorId) {
    motorMaterials.value = { ...motorMaterials.value, [motorId]: await api.getMotorMaterials(motorId) }
    return motorMaterials.value[motorId]
  }

  async function addMotorMaterial(motorId, data) {
    const saved = await api.createMotorMaterial(motorId, data)
    const current = motorMaterials.value[motorId] || []
    const next = current.some(material => material.id === saved.id || material.variationId === saved.variationId)
      ? current.map(material => (material.id === saved.id || material.variationId === saved.variationId) ? saved : material)
      : [saved, ...current]
    motorMaterials.value = { ...motorMaterials.value, [motorId]: next }
    return saved
  }

  async function removeMotorMaterial(motorId, materialId) {
    const result = await api.deleteMotorMaterial(motorId, materialId)
    const current = motorMaterials.value[motorId] || []
    motorMaterials.value = { ...motorMaterials.value, [motorId]: current.filter(material => material.id !== materialId) }
    return result
  }

  async function addMotorEvent(motorId, data) {
    const created = await api.createMotorEvent(motorId, data)
    const current = motorEvents.value[motorId] || []
    motorEvents.value = { ...motorEvents.value, [motorId]: [created, ...current] }
    await loadData()
    return created
  }

  async function editMotorEvent(motorId, eventId, data) {
    const updated = await api.updateMotorEvent(motorId, eventId, data)
    const current = motorEvents.value[motorId] || []
    motorEvents.value = {
      ...motorEvents.value,
      [motorId]: current.map(ev => ev.id === eventId ? updated : ev),
    }
    await loadData()
    return updated
  }

  async function removeMotorEvent(motorId, eventId) {
    const result = await api.deleteMotorEvent(motorId, eventId)
    const current = motorEvents.value[motorId] || []
    motorEvents.value = {
      ...motorEvents.value,
      [motorId]: current.filter(ev => ev.id !== eventId),
    }
    await loadData()
    return result
  }

  function getMotor(id) {
    return motors.value.find(m => m.id === id) || null
  }

  const activeMotors = computed(() => motors.value.filter(m => m.status !== 'inativo'))

  return {
    motors,
    motorEvents,
    motorMaterials,
    activeMotors,
    loadData,
    addMotor,
    editMotor,
    removeMotor,
    loadEvents,
    loadMaterials,
    addMotorMaterial,
    removeMotorMaterial,
    addMotorEvent,
    editMotorEvent,
    removeMotorEvent,
    getMotor,
  }
}
