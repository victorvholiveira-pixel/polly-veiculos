import type { ValueValidation } from '../types'

export interface ValueResult {
  raw: number | string | null
  parsed: number | null
  validation: ValueValidation
}

const PLAUSIBLE_MIN = 500
const PLAUSIBLE_MAX = 1_000_000

/**
 * The audit confirmed `valor` is stored as clean numeric cells workbook-wide
 * (not currency strings), so the string branch below is a defensive
 * fallback, not the expected path. Never alters the value — only classifies it.
 */
export function normalizeValue(raw: unknown): ValueResult {
  if (raw === null || raw === undefined || raw === '') {
    return { raw: null, parsed: null, validation: 'null' }
  }

  if (typeof raw === 'number') {
    return classify(raw, raw)
  }

  const text = String(raw).trim()
  const cleaned = text.replace(/[^\d.,-]/g, '').replace(/\.(?=\d{3},)/g, '').replace(',', '.')
  const num = Number(cleaned)
  if (Number.isNaN(num)) {
    return { raw: text, parsed: null, validation: 'null' }
  }
  return classify(text, num)
}

function classify(raw: number | string, num: number): ValueResult {
  if (num < 0) return { raw, parsed: null, validation: 'negative' }
  if (num === 0) return { raw, parsed: null, validation: 'zero' }
  if (num < PLAUSIBLE_MIN || num > PLAUSIBLE_MAX) return { raw, parsed: num, validation: 'implausible' }
  return { raw, parsed: num, validation: 'valid' }
}
