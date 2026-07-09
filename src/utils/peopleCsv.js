function parseCsvLine(line, separator) {
  const cells = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"' && line[i + 1] === '"') {
      cell += '"'
      i += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === separator && !quoted) {
      cells.push(cell.trim())
      cell = ''
    } else {
      cell += char
    }
  }

  cells.push(cell.trim())
  return cells
}

function normalizeHeader(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function parsePeopleCsv(text) {
  const lines = String(text || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
  if (!lines.length) return { rows: [], skipped: 0 }

  const first = lines[0]
  const separator = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ';' : ','
  const firstRow = parseCsvLine(first, separator)
  const headers = firstRow.map(normalizeHeader)
  const hasHeader = headers.includes('nome') || headers.includes('name') || headers.includes('cargo') || headers.includes('role')
  const headerNameIndex = Math.max(headers.indexOf('nome'), headers.indexOf('name'))
  const headerRoleIndex = Math.max(headers.indexOf('cargo'), headers.indexOf('role'))
  const nameIndex = hasHeader && headerNameIndex >= 0 ? headerNameIndex : 0
  const roleIndex = hasHeader && headerRoleIndex >= 0 ? headerRoleIndex : 1
  const dataLines = hasHeader ? lines.slice(1) : lines

  let skipped = 0
  const rows = []
  for (const line of dataLines) {
    const row = parseCsvLine(line, separator)
    const name = String(row[nameIndex] || '').trim()
    const role = String(row[roleIndex] || '').trim()
    if (!name) {
      skipped += 1
      continue
    }
    rows.push({ name, role })
  }

  return { rows, skipped }
}
