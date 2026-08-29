import { describe, expect, it } from 'vitest'
import { normalizeDate } from '../date'

describe('normalizeDate', () => {
  it('parses a valid date', () => {
    const result = normalizeDate('05/07/2023', '2023-07-01')
    expect(result.validation).toBe('valid')
    expect(result.parsed).toBe('2023-07-05')
  })

  it('flags a placeholder day ("00") as invalid, never silently fixed', () => {
    const result = normalizeDate('00/07/2022', '2022-07-01')
    expect(result.validation).toBe('invalid_placeholder_day')
    expect(result.parsed).toBeNull()
    // A suggestion may exist, but it is explicitly separate from `parsed`.
    expect(result.suggestedValue).toBe('2022-07-01')
  })

  it('flags an implausible year without silently correcting it (golden rule example)', () => {
    const result = normalizeDate('27/04/1026', '2026-04-01')
    expect(result.validation).toBe('implausible_year')
    expect(result.parsed).toBeNull()
    expect(result.suggestedValue).toBeNull()
  })

  it('flags a structurally malformed year digit sequence distinctly from an implausible year', () => {
    const result = normalizeDate('30/10/0222', '2022-10-01')
    expect(result.validation).toBe('invalid_year_digits')
    expect(result.parsed).toBeNull()
  })

  it('treats an absent date as `missing`, not an error', () => {
    const result = normalizeDate(null, '2023-01-01')
    expect(result.validation).toBe('missing')
  })

  it('accepts a real JS Date (as ExcelJS returns for genuine date cells)', () => {
    const result = normalizeDate(new Date(Date.UTC(2023, 5, 20)), '2023-06-01')
    expect(result.validation).toBe('valid')
    expect(result.parsed).toBe('2023-06-20')
  })
})
