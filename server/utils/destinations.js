export function getDestinationFullName(db, destinationOrId) {
  let destination = typeof destinationOrId === 'string'
    ? db.prepare('SELECT * FROM destinations WHERE id = ?').get(destinationOrId)
    : destinationOrId
  if (!destination) return ''

  const names = []
  const seen = new Set()
  while (destination && !seen.has(destination.id)) {
    seen.add(destination.id)
    names.unshift(destination.name)
    destination = destination.parent_id
      ? db.prepare('SELECT * FROM destinations WHERE id = ?').get(destination.parent_id)
      : null
  }
  return names.join(' > ')
}
