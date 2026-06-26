export function nextMotorMaintenanceStatus(currentStatus, openWorkOrders, statusAfterMaintenance = '') {
  if (openWorkOrders > 0) return 'em_manutencao'
  if (statusAfterMaintenance) return statusAfterMaintenance
  return currentStatus === 'em_manutencao' ? 'ativo' : currentStatus
}
