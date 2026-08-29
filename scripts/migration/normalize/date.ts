import type { DateValidationStatus } from '../types'

export interface DateResult {
  raw: string | null
  /** ISO date (YYYY-MM-DD), set ONLY when validation === 'valid'. */
  parsed: string | null
  validation: DateValidationStatus
  /** Heuristic best guess for an invalid date — never a confirmed value. */
  suggestedValue: string | null
}

const DATE_STRING = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/
const PLAUSIBLE_YEAR_MIN = 2015
const PLAUSIBLE_YEAR_MAX = 2035

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * Parses a raw date cell (a JS Date, as ExcelJS returns for real Excel date
 * cells, or a literal string like "00/07/2022"). Golden rule: an implausible
 * or malformed date is classified and reported, never silently "corrected"
 * (e.g. a 3-digit year typo is NOT turned into a real year here).
 *
 * `sheetPeriod` (YYYY-MM-01, the sheet's own month) is only used to build a
 * `suggestedValue` for the one unambiguous case in this workbook: a
 * placeholder day of "00", which the source itself always uses to mean
 * "sometime this month".
 */
export function normalizeDate(raw: unknown, sheetPeriod: string): DateResult {
  if (raw === null || raw === undefined || raw === '') {
    return { raw: null, parsed: null, validation: 'missing', suggestedValue: null }
  }

  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) {
      return { raw: String(raw), parsed: null, validation: 'invalid_year_digits', suggestedValue: null }
    }
    const year = raw.getUTCFullYear()
    const rawIso = iso(year, raw.getUTCMonth() + 1, raw.getUTCDate())
    if (year < PLAUSIBLE_YEAR_MIN || year > PLAUSIBLE_YEAR_MAX) {
      return { raw: rawIso, parsed: null, validation: 'implausible_year', suggestedValue: null }
    }
    return { raw: rawIso, parsed: rawIso, validation: 'valid', suggestedValue: null }
  }

  const text = String(raw).trim()
  const match = DATE_STRING.exec(text)
  if (!match) {
    return { raw: text, parsed: null, validation: 'missing', suggestedValue: null }
  }

  const [, dayStr, monthStr, yearStr] = match as unknown as [string, string, string, string]
  const day = Number(dayStr)
  const month = Number(monthStr)

  // A 3- or 4-digit year starting with "0" (e.g. "0222") is structurally
  // malformed, not just an out-of-range real year — flagged distinctly.
  if (yearStr.length !== 4 && yearStr.length !== 2) {
    return { raw: text, parsed: null, validation: 'invalid_year_digits', suggestedValue: null }
  }
  if (yearStr.length === 4 && yearStr.startsWith('0')) {
    return {
      raw: text,
      parsed: null,
      validation: 'invalid_year_digits',
      suggestedValue: iso(Number(`2${yearStr.slice(1)}`), month, day || 1),
    }
  }

  const year = yearStr.length === 2 ? 2000 + Number(yearStr) : Number(yearStr)

  if (day === 0) {
    return { raw: text, parsed: null, validation: 'invalid_placeholder_day', suggestedValue: `${sheetPeriod.slice(0, 7)}-01` }
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return { raw: text, parsed: null, validation: 'invalid_year_digits', suggestedValue: null }
  }
  if (year < PLAUSIBLE_YEAR_MIN || year > PLAUSIBLE_YEAR_MAX) {
    return { raw: text, parsed: null, validation: 'implausible_year', suggestedValue: null }
  }

  return { raw: text, parsed: iso(year, month, day), validation: 'valid', suggestedValue: null }
}
