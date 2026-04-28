import { mkdir, readdir, rename, rm } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_BACKUP_DIR = join(__dirname, 'backups')
const BACKUP_PREFIX = 'estoque-'
const BACKUP_EXT = '.db'

function envInt(name, fallback) {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

async function cleanupOldBackups(dir, keep) {
  const files = await readdir(dir, { withFileTypes: true }).catch(() => [])
  const backups = files
    .filter(file => file.isFile() && file.name.startsWith(BACKUP_PREFIX) && file.name.endsWith(BACKUP_EXT))
    .map(file => file.name)
    .sort()

  const extra = backups.slice(0, Math.max(0, backups.length - keep))
  await Promise.all(extra.map(file => rm(join(dir, file), { force: true })))
}

export async function createBackup(db, options = {}) {
  const dir = options.dir || process.env.BACKUP_DIR || DEFAULT_BACKUP_DIR
  const keep = options.keep || envInt('BACKUP_KEEP', 14)
  await mkdir(dir, { recursive: true })

  const finalPath = join(dir, `${BACKUP_PREFIX}${timestamp()}${BACKUP_EXT}`)
  const tmpPath = `${finalPath}.tmp`

  await db.backup(tmpPath)
  await rename(tmpPath, finalPath)
  await cleanupOldBackups(dir, keep)

  return finalPath
}

export function startBackupScheduler(db) {
  if (process.env.BACKUP_ENABLED === 'false') {
    console.log('Backups automaticos desativados por BACKUP_ENABLED=false')
    return null
  }

  const intervalHours = envInt('BACKUP_INTERVAL_HOURS', 24)
  const intervalMs = intervalHours * 60 * 60 * 1000

  const run = () => {
    createBackup(db)
      .then(path => console.log(`Backup SQLite criado: ${path}`))
      .catch(err => console.error('Falha ao criar backup SQLite:', err.message))
  }

  const startupTimer = setTimeout(run, 5000)
  const interval = setInterval(run, intervalMs)
  startupTimer.unref?.()
  interval.unref?.()

  return {
    runNow: run,
    stop() {
      clearTimeout(startupTimer)
      clearInterval(interval)
    }
  }
}
