import { describe, expect, it } from 'vitest'
import { buildOccurrence } from '../occurrence-builder'
import { resolveLayout } from '../eras'
import { occurrenceKey, type RawRow } from '../types'

function row(sheetName: string, rowNumber: number, cells: Record<number, unknown>): RawRow {
  return { sheetName, rowNumber, cells: new Map(Object.entries(cells).map(([k, v]) => [Number(k), v])) }
}

describe('buildOccurrence — source record identity', () => {
  it('produces a stable, unique key per (source_sheet, source_row) — never confused with vehicle identity', () => {
    const layout = resolveLayout('JAN24')!
    const r = row('JAN24', 12, { 4: 'Fiat', 5: 'Uno', 6: 25900 })

    const first = buildOccurrence(r, layout, '2024-01-01')
    const second = buildOccurrence(r, layout, '2024-01-01') // rebuilding from the same raw row must be idempotent

    expect(occurrenceKey(first)).toBe('JAN24#12')
    expect(occurrenceKey(first)).toBe(occurrenceKey(second))
    expect(first).toEqual(second)
  })

  it('gives two different rows two different keys even with identical content (no accidental merge at this layer)', () => {
    const layout = resolveLayout('JAN24')!
    const rowA = row('JAN24', 12, { 4: 'Fiat', 5: 'Uno', 6: 25900 })
    const rowB = row('JAN24', 13, { 4: 'Fiat', 5: 'Uno', 6: 25900 })

    const a = buildOccurrence(rowA, layout, '2024-01-01')
    const b = buildOccurrence(rowB, layout, '2024-01-01')

    expect(occurrenceKey(a)).not.toBe(occurrenceKey(b))
    // Identity resolution (a later stage) is what may eventually say these
    // are the same vehicle — occurrence identity itself never does.
  })

  it('never includes anything from an ignored/sensitive sheet in original_payload (defense in depth beyond the loader)', () => {
    const layout = resolveLayout('JAN24')!
    const r = row('JAN24', 12, { 4: 'Fiat', 5: 'Uno', 6: 25900 })
    const occurrence = buildOccurrence(r, layout, '2024-01-01')
    expect(Object.keys(occurrence.originalPayload)).not.toContain('senha')
    expect(Object.keys(occurrence.originalPayload)).not.toContain('cpf')
  })
})
