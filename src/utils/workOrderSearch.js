export function workOrderMaintenanceKindLabel(order) {
  const type = String(order?.maintenanceLocationType || '').toLowerCase()
  if (type === 'externa') return 'Oficina Externa'
  if (type === 'interna') return 'Oficina Interna'
  return ''
}

export function workOrderMaintenanceSearchParts(order) {
  return [
    workOrderMaintenanceKindLabel(order),
    order?.maintenanceLocationType,
    order?.maintenanceLocationName,
    order?.maintenanceDestinationName,
    order?.maintenanceExternalLocation,
    order?.maintenanceExternalOrderNumber,
    order?.destinationName,
    order?.motorOriginDestinationName,
    order?.motorEventLabel,
    order?.motorEventType,
    order?.motorEventDate,
    order?.motorEventPerformedBy,
    order?.motorEventToDestination,
    order?.motorEventNotes,
    order?.serviceType,
  ].filter(Boolean)
}
