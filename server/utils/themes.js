import { readdirSync } from 'node:fs'

export function themesFromNames(names) {
  return [...new Set(names
    .filter(name => /^[a-z0-9][a-z0-9_-]*\.css$/i.test(name))
    .map(name => name.slice(0, -4).toLowerCase()))]
    .sort((a, b) => (a === 'industrial' ? -1 : b === 'industrial' ? 1 : a.localeCompare(b)))
    .map(id => ({
      id,
      name: id.split(/[-_]/).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' '),
    }))
}

export function listThemes(directory) {
  try {
    return themesFromNames(
      readdirSync(directory, { withFileTypes: true })
        .filter(entry => entry.isFile())
        .map(entry => entry.name)
    )
  } catch {
    return []
  }
}
