import db from '../db.js'
import { getAuthToken } from '../utils/authToken.js'
import { isOwnPasswordChangeRequest } from '../utils/authPolicy.js'

// Middleware: require valid session token
export function requireAuth(req, res, next) {
  const token = getAuthToken(req)
  if (!token) return res.status(401).json({ error: 'Token não fornecido' })

  const session = db.prepare(`
    SELECT s.user_id, u.name, u.username, u.role, u.active, u.must_change_password
    FROM sessions s JOIN users u ON s.user_id = u.id
    WHERE s.token = ?
  `).get(token)

  if (!session) return res.status(401).json({ error: 'Sessão inválida' })
  if (!session.active) return res.status(403).json({ error: 'Usuário desativado' })

  const changingOwnPassword = isOwnPasswordChangeRequest(req, session.user_id)
  if (session.must_change_password && !changingOwnPassword) {
    return res.status(403).json({
      error: 'Troque a senha inicial antes de continuar.',
      code: 'PASSWORD_CHANGE_REQUIRED',
    })
  }

  req.user = {
    id: session.user_id,
    name: session.name,
    username: session.username || session.name,
    role: session.role,
    mustChangePassword: Boolean(session.must_change_password),
  }
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
