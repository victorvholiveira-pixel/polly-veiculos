import { beforeEach, describe, expect, it } from 'vitest'
import { clearToken, decodeToken, getToken, isExpired, setToken, type TokenPayload } from '../authToken'

function fakeToken(payload: TokenPayload): string {
  const payloadPart = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${payloadPart}.fake-signature`
}

describe('authToken', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('round-trips get/set/clear via localStorage', () => {
    expect(getToken()).toBeNull()
    setToken('abc.def')
    expect(getToken()).toBe('abc.def')
    clearToken()
    expect(getToken()).toBeNull()
  })

  it('decodes a valid token payload without checking the signature', () => {
    const token = fakeToken({ name: 'Victor', iat: 1000, exp: 2000 })
    expect(decodeToken(token)).toEqual({ name: 'Victor', iat: 1000, exp: 2000 })
  })

  it('returns null for a malformed token instead of throwing', () => {
    expect(decodeToken('garbage')).toBeNull()
    expect(decodeToken('')).toBeNull()
  })

  it('isExpired reflects the exp timestamp', () => {
    expect(isExpired({ name: 'x', iat: 0, exp: Date.now() - 1000 })).toBe(true)
    expect(isExpired({ name: 'x', iat: 0, exp: Date.now() + 100000 })).toBe(false)
  })
})
