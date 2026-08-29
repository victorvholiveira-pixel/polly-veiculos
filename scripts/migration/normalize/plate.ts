import type { PlateFormat } from '../types'
import { normalizeText } from './text'

export interface PlateResult {
  raw: string | null
  normalized: string | null
  format: PlateFormat
}

// ABC1234
const OLD_FORMAT = /^[A-Z]{3}\d{4}$/
// ABC1D23 (letter in the 5th position)
const MERCOSUL_FORMAT = /^[A-Z]{3}\d[A-Z]\d{2}$/

/**
 * Classifies a raw plate value. Never invents or corrects characters — a
 * plate that doesn't fit either known format is `invalid`, not "fixed".
 */
export function normalizePlate(raw: unknown): PlateResult {
  const text = normalizeText(raw)
  if (!text) {
    return { raw: null, normalized: null, format: 'missing' }
  }

  const stripped = text.toUpperCase().replace(/[^A-Z0-9]/g, '')

  if (OLD_FORMAT.test(stripped)) {
    return { raw: text, normalized: stripped, format: 'old' }
  }
  if (MERCOSUL_FORMAT.test(stripped)) {
    return { raw: text, normalized: stripped, format: 'mercosul' }
  }
  return { raw: text, normalized: null, format: 'invalid' }
}
