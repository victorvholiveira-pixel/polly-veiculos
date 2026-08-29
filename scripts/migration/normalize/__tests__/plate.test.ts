import { describe, expect, it } from 'vitest'
import { normalizePlate } from '../plate'

describe('normalizePlate', () => {
  it('classifies a valid old-format plate (ABC1234)', () => {
    const result = normalizePlate('FJV 1543')
    expect(result.format).toBe('old')
    expect(result.normalized).toBe('FJV1543')
  })

  it('classifies a valid Mercosul-format plate (ABC1D23)', () => {
    const result = normalizePlate('GGF5B68')
    expect(result.format).toBe('mercosul')
    expect(result.normalized).toBe('GGF5B68')
  })

  it('classifies an invalid/malformed plate without inventing characters', () => {
    // A trim/spec value ("2.0") that the audit found leaked into the Placa
    // column on at least one row — fits neither known plate shape.
    const result = normalizePlate('2.0')
    expect(result.format).toBe('invalid')
    expect(result.normalized).toBeNull()
    // The raw value is preserved verbatim (trimmed), never "corrected".
    expect(result.raw).toBe('2.0')
  })

  it('treats a missing plate as `missing`, not `invalid`', () => {
    const result = normalizePlate(null)
    expect(result.format).toBe('missing')
    expect(result.raw).toBeNull()
  })
})
