import db from '../db.js'

// Middleware: require valid session token
export function requireAuth(req, res, next) {
  const token = req.headers['x-auth-token']
  if (!token) return res.status(401).json({ error: 'Token não fornecido' })

  const session = db.prepare(`
    SELECT s.user_id, u.name, u.role, u.active
    FROM sessions s JOIN users u ON s.user_id = u.id
    WHERE s.token = ?
  `).get(token)

  if (!session) return res.status(401).json({ error: 'Sessão inválida' })
  if (!session.active) return res.status(403).json({ error: 'Usuário desativado' })

  req.user = { id: session.user_id, name: session.name, role: session.role }
  next()
}

// Middleware: require specific roles
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' })
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Sem permissão' })
    }
    next()
  }
}
