export function backupCountdownLabel(backup, now = Date.now()) {
  if (!backup || backup.status === 'starting') return 'Carregando agendamento...'
  if (backup.status === 'disabled') return 'Backups desativados'
  if (backup.status === 'running') return 'Backup em andamento'

  const target = Date.parse(backup.nextRunAt)
  if (!Number.isFinite(target)) return 'Agendando próximo backup...'

  const total = Math.max(0, Math.ceil((target - now) / 1000))
  if (total === 0) return 'Aguardando execução'

  const days = Math.floor(total / 86400)
  const hours = String(Math.floor((total % 86400) / 3600)).padStart(2, '0')
  const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, '0')
  const seconds = String(total % 60).padStart(2, '0')
  return days ? `${days}d ${hours}:${minutes}:${seconds}` : `${hours}:${minutes}:${seconds}`
}
