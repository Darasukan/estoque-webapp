export function formatPartialOrderDate(value) {
  const text = String(value || '')
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`

  const digits = text.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

export function workOrderCreationDateError(intent, startDate, endDate) {
  if (intent !== 'register') return ''
  if (!startDate) return 'Data de início da manutenção é obrigatória para registrar uma OS finalizada'
  if (!endDate) return 'Data de término da manutenção é obrigatória para registrar uma OS finalizada'
  return ''
}
