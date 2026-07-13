export function isOwnPasswordChangeRequest(req, userId) {
  return req.baseUrl === '/api/auth'
    && req.method === 'PUT'
    && req.path === `/users/${userId}`
}

export function passwordChangeError(pin, sameAsCurrent = false) {
  const value = String(pin || '').trim()
  if (value.length < 8) return 'Senha deve ter ao menos 8 caracteres.'
  if (sameAsCurrent) return 'A nova senha deve ser diferente da senha atual.'
  return ''
}
