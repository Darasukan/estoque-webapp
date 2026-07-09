import Database from 'better-sqlite3'
import { existsSync } from 'node:fs'
import { copyFile, mkdir, rename, rm } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getBackupSettings } from '../backup.js'
import { argValue, loadEnvFile, resolveEnvPath } from '../env.js'

export const RESTORE_CONFIRMATION = 'RESTAURAR_BACKUP'

export function assertRestoreAllowed(confirmation) {
  if (confirmation !== RESTORE_CONFIRMATION) {
    throw new Error(`Restauracao bloqueada. Confirme com --confirm=${RESTORE_CONFIRMATION}`)
  }
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function assertHealthyDatabase(path) {
  const db = new Database(path, { readonly: true, fileMustExist: true })
  try {
    const result = db.prepare('PRAGMA integrity_check').pluck().get()
    if (result !== 'ok') throw new Error(`Banco invalido: ${result}`)
  } finally {
    db.close()
  }
}

export async function restoreBackup({ source, target, backupDir }) {
  const sourcePath = resolve(source)
  const targetPath = resolve(target)
  if (!existsSync(sourcePath)) throw new Error(`Backup nao encontrado: ${sourcePath}`)
  if (sourcePath === targetPath) throw new Error('O backup e o banco atual nao podem ser o mesmo arquivo.')

  assertHealthyDatabase(sourcePath)
  await mkdir(dirname(targetPath), { recursive: true })
  await mkdir(backupDir, { recursive: true })

  let safetyBackup = ''
  if (existsSync(targetPath)) {
    const current = new Database(targetPath, { fileMustExist: true })
    try {
      current.pragma('busy_timeout = 1000')
      current.exec('BEGIN EXCLUSIVE')
      current.exec('COMMIT')
      current.pragma('wal_checkpoint(TRUNCATE)')
      safetyBackup = join(backupDir, `antes-restauracao-${timestamp()}.db`)
      await current.backup(safetyBackup)
    } finally {
      current.close()
    }
  }

  const tempPath = `${targetPath}.restore.tmp`
  const oldPath = `${targetPath}.restore.old`
  await rm(tempPath, { force: true })
  await rm(oldPath, { force: true })
  await copyFile(sourcePath, tempPath)
  assertHealthyDatabase(tempPath)

  let movedCurrent = false
  try {
    await rm(`${targetPath}-wal`, { force: true })
    await rm(`${targetPath}-shm`, { force: true })
    if (existsSync(targetPath)) {
      await rename(targetPath, oldPath)
      movedCurrent = true
    }
    await rename(tempPath, targetPath)
    await rm(oldPath, { force: true })
  } catch (error) {
    await rm(tempPath, { force: true })
    if (movedCurrent && !existsSync(targetPath)) await rename(oldPath, targetPath)
    throw error
  }

  return { sourcePath, targetPath, safetyBackup }
}

async function main() {
  const envFile = loadEnvFile(argValue('env', '.env.prod'))
  const source = argValue('file')
  if (!source) throw new Error('Informe --file=C:\\caminho\\backup.db')
  assertRestoreAllowed(argValue('confirm'))

  const target = resolveEnvPath(process.env.DB_PATH, './server/estoque.db')
  const backupDir = resolveEnvPath(process.env.BACKUP_DIR, getBackupSettings().dir)
  const result = await restoreBackup({ source, target, backupDir })
  console.log(JSON.stringify({
    ok: true,
    envFile,
    backup: basename(result.sourcePath),
    dbPath: result.targetPath,
    safetyBackup: result.safetyBackup,
  }, null, 2))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(error => {
    console.error(error.message)
    process.exit(1)
  })
}
