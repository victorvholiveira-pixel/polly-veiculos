import { describe, expect, it } from 'vitest'
import { buildOccurrence } from '../../occurrence-builder'
import { resolveLayout } from '../../eras'
import { occurrenceKey, type OccurrenceResolution, type RawRow } from '../../types'
import { detectSales } from '../detect'

function row(sheetName: string, rowNumber: number, cells: Record<number, unknown>): RawRow {
  return { sheetName, rowNumber, cells: new Map(Object.entries(cells).map(([k, v]) => [Number(k), v])) }
}

function resolutionFor(o: ReturnType<typeof buildOccurrence>): OccurrenceResolution {
  return { occurrenceKey: occurrenceKey(o), vehicleId: 'veh_00001', matchStatus: 'unresolved_no_signal', matchScore: null }
}

describe('detectSales', () => {
  it('classifies a sale with a valid date as sale_detected', () => {
    const layout = resolveLayout('JAN24')!
    // A=date(0), D=flag(3) left empty, E=marca(4), F=modelo(5), G=valor(6), J=placa(9)
    const r = row('JAN24', 8, { 0: new Date(Date.UTC(2024, 0, 24)), 4: 'Ford', 5: 'Ka', 6: 55900, 9: 'GDN9C65' })
    const o = buildOccurrence(r, layout, '2024-01-01')
    expect(o.observedStatus).toBe('sold')

    const [sale] = detectSales([o], [resolutionFor(o)])
    expect(sale?.classification).toBe('sale_detected')
    expect(sale?.value).toBe(55900)
  })

  it('classifies a sale with an invalid date but strong evidence (buyer/value/plate) as sale_detected_with_invalid_date, never discarded', () => {
    const layout = resolveLayout(' JULHO 2022')!
    // L1: A=date(0), B=marca(1), D=valor(3), F=nome(5)
    const r = row(' JULHO 2022', 7, { 0: '00/07/2022', 1: 'Palio vermelho', 3: 39900, 5: 'Sr Jose' })
    const o = buildOccurrence(r, layout, '2022-07-01')
    expect(o.observedStatus).toBe('sold') // era A: whole sheet is a sales log
    expect(o.saleDateValidation).toBe('invalid_placeholder_day')

    const [sale] = detectSales([o], [resolutionFor(o)])
    expect(sale?.classification).toBe('sale_detected_with_invalid_date')
    expect(sale?.saleDate).toBeNull() // never a guessed/confirmed date
  })

  it('classifies a sold row with no date and no other evidence as sale_ambiguous, not dropped', () => {
    // L1 (' JULHO 2022'): the era has no stock concept at all — every row is
    // 'sold' regardless of date/flag (see eras.ts). With no date, no buyer,
    // no value and no plate, this is the weakest possible sale evidence.
    const layout = resolveLayout(' JULHO 2022')!
    const r = row(' JULHO 2022', 40, { 1: 'Xyz Unknown Thing' })
    const o = buildOccurrence(r, layout, '2022-07-01')
    expect(o.observedStatus).toBe('sold')

    const [sale] = detectSales([o], [resolutionFor(o)])
    expect(sale?.classification).toBe('sale_ambiguous')
  })

  it('never produces a sale candidate for a stock row', () => {
    const layout = resolveLayout('JAN24')!
    const r = row('JAN24', 5, { 3: 1, 4: 'Fiat', 5: 'Uno', 6: 25900 })
    const o = buildOccurrence(r, layout, '2024-01-01')
    expect(o.observedStatus).toBe('stock')
    expect(detectSales([o], [resolutionFor(o)])).toHaveLength(0)
  })
})
