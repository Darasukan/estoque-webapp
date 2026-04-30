import { computed, ref } from 'vue'
import * as api from '../services/api.js'

const motors = ref([])
const motorEvents = ref({})

export const MOTOR_STATUSES = [
  { id: 'ativo', label: 'Ativo' },
  { id: 'em_manutencao', label: 'Em manutencao' },
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
  { id: 'observacao', label: 'Observacao' },
]

export function motorStatusLabel(status) {
  return MOTOR_STATUSES.find(s => s.id === status)?.label || status || ''
}

export function motorEventLabel(type) {
  if (type === 'enrolar') return 'Enrolado'
  return MOTOR_EVENT_TYPES.find(t => t.id === type)?.label || type || ''
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
    return result
  }

  async function loadEvents(motorId) {
    motorEvents.value = { ...motorEvents.value, [motorId]: await api.getMotorEvents(motorId) }
    return motorEvents.value[motorId]
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
    activeMotors,
    loadData,
    addMotor,
    editMotor,
    removeMotor,
    loadEvents,
    addMotorEvent,
    editMotorEvent,
    removeMotorEvent,
    getMotor,
  }
}
