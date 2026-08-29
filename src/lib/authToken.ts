/**
 * Client-side handling of the signed login token (see gas/Auth.js). Decoding
 * here is just to read `name`/`exp` for display and expiry checks — the
 * signature is never verified client-side, only by the backend on every call.
 */

const STORAGE_KEY = 'polly_auth_token'

export interface TokenPayload {
  name: string
  iat: number
  exp: number
}

export function getToken(): string | null {
  return localStorage.getItem(STORAGE_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(STORAGE_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(STORAGE_KEY)
}

function base64UrlToBase64(input: string): string {
  const padded = input + '='.repeat((4 - (input.length % 4)) % 4)
  return padded.replace(/-/g, '+').replace(/_/g, '/')
}

export function decodeToken(token: string): TokenPayload | null {
  try {
    const [payloadPart] = token.split('.')
    if (!payloadPart) return null
    const json = atob(base64UrlToBase64(payloadPart))
    return JSON.parse(json) as TokenPayload
  } catch {
    return null
  }
}

export function isExpired(payload: TokenPayload): boolean {
  return Date.now() > payload.exp
}
