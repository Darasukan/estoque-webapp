export function workOrderCreationDateError(intent, startDate, endDate) {
  if (intent !== 'register') return ''
  if (!startDate) return 'Data de início da manutenção é obrigatória para registrar uma OS finalizada'
  if (!endDate) return 'Data de término da manutenção é obrigatória para registrar uma OS finalizada'
  return ''
}
