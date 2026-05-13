import assert from 'node:assert/strict'
import test from 'node:test'
import { getAuthToken } from '../server/utils/authToken.js'

test('getAuthToken reads header token first', () => {
  const token = getAuthToken({
    headers: {
      'x-auth-token': 'header-token',
      cookie: 'auth_token=cookie-token',
    },
  })

  assert.equal(token, 'header-token')
})

test('getAuthToken reads auth cookie', () => {
  const token = getAuthToken({
    headers: {
      cookie: 'theme=dark; auth_token=cookie%20token; other=1',
    },
  })

  assert.equal(token, 'cookie token')
})

test('getAuthToken returns empty string when no token exists', () => {
  assert.equal(getAuthToken({ headers: {} }), '')
})
