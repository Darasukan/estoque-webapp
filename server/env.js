import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'

export function argValue(name, fallback = '') {
  const prefix = `--${name}=`
  const found = process.argv.find(arg => arg.startsWith(prefix))
  return found ? found.slice(prefix.length) : fallback
}

export function loadEnvFile(envFile = argValue('env', '.env')) {
  const envPath = resolve(process.cwd(), envFile)
  if (!existsSync(envPath)) return envFile

  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const index = trimmed.indexOf('=')
    const key = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
    if (key && process.env[key] === undefined) process.env[key] = value
  }
  return envFile
}

export function resolveEnvPath(value, fallback) {
  const path = value || fallback
  return isAbsolute(path) ? path : resolve(process.cwd(), path)
}
