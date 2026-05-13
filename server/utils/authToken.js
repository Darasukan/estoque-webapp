export function getAuthToken(req) {
  const headerToken = req.headers?.['x-auth-token']
  if (headerToken) return headerToken

  const authCookie = String(req.headers?.cookie || '')
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith('auth_token='))

  return authCookie ? decodeURIComponent(authCookie.slice('auth_token='.length)) : ''
}
