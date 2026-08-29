import { describe, expect, it } from 'vitest'
import { isUnreachableError, withTimeout } from '../withTimeout'

class FakePostgrestError extends Error {
  code: string
  details: string
  hint: string
  constructor(message: string) {
    super(message)
    this.name = 'PostgrestError'
    this.code = '42501'
    this.details = ''
    this.hint = 'Grant the required privileges to the current role.'
  }
}

describe('withTimeout', () => {
  it('resolves with the original value when the promise settles in time', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 50)).resolves.toBe('ok')
  })

  it('rejects with a timeout error when the promise takes too long', async () => {
    const never = new Promise(() => {})
    await expect(withTimeout(never, 10)).rejects.toThrow(/Timed out after 10ms/)
  })
})

describe('isUnreachableError', () => {
  it('treats a withTimeout timeout as unreachable (falls back to demo)', () => {
    expect(isUnreachableError(new Error('Timed out after 3000ms'))).toBe(true)
  })

  it('treats a browser fetch-level failure as unreachable (falls back to demo)', () => {
    expect(isUnreachableError(new TypeError('Failed to fetch'))).toBe(true)
  })

  it('never treats a real PostgrestError as unreachable — it must be surfaced, not hidden behind demo mode', () => {
    expect(isUnreachableError(new FakePostgrestError('permission denied for table vehicle_occurrences'))).toBe(false)
  })

  it('treats a non-Error value as not unreachable (nothing to safely swallow)', () => {
    expect(isUnreachableError('some string')).toBe(false)
    expect(isUnreachableError(null)).toBe(false)
  })
})
