import { describe, expect, it } from 'vitest'
import { buildOccurrence } from '../../occurrence-builder'
import { resolveLayout } from '../../eras'
import type { RawRow } from '../../types'
import { resolveIdentity } from '../resolve'

function row(sheetName: string, rowNumber: number, cells: Record<number, unknown>): RawRow {
  return { sheetName, rowNumber, cells: new Map(Object.entries(cells).map(([k, v]) => [Number(k), v])) }
}

const JAN24 = resolveLayout('JAN24')!
const FEV24 = resolveLayout('FEV24')!
const MARC24 = resolveLayout('MARC24')!

describe('resolveIdentity', () => {
  it('Tier 1: merges the same vehicle appearing in consecutive months by exact plate', () => {
    // JAN24 flag col=3, marca=4, modelo=5, valor=6, placa=9
    const jan = buildOccurrence(row('JAN24', 5, { 3: 1, 4: 'Fiat', 5: 'Uno', 6: 25900, 9: 'ABC1234' }), JAN24, '2024-01-01')
    // FEV24 flag col=3, marca=5, modelo=6, valor=7, placa=10
    const fev = buildOccurrence(row('FEV24', 5, { 3: 1, 5: 'Fiat', 6: 'Uno', 7: 25900, 10: 'ABC1234' }), FEV24, '2024-02-01')

    const { vehicles, resolutions } = resolveIdentity([jan, fev])

    expect(vehicles).toHaveLength(1)
    expect(vehicles[0]?.occurrenceKeys).toEqual(['JAN24#5', 'FEV24#5'])
    expect(resolutions.find((r) => r.occurrenceKey === 'FEV24#5')?.matchStatus).toBe('resolved_exact_plate')
  })

  it('never merges across a broken continuity gap, even with an identical plate — creates a second vehicle instead', () => {
    const jan = buildOccurrence(row('JAN24', 5, { 3: 1, 4: 'Fiat', 5: 'Uno', 6: 25900, 9: 'ABC1234' }), JAN24, '2024-01-01')
    // MARC24 is two months later (gap = 2) — continuity requires gap <= 1.
    const marc = buildOccurrence(row('MARC24', 5, { 3: 1, 5: 'Fiat', 6: 'Uno', 7: 25900, 10: 'ABC1234' }), MARC24, '2024-03-01')

    const { vehicles } = resolveIdentity([jan, marc])
    expect(vehicles).toHaveLength(2)
  })

  it('same plate but contradicting parsed brand is a conflict, never auto-merged (false merge > false negative)', () => {
    const jan = buildOccurrence(row('JAN24', 5, { 3: 1, 4: 'Fiat', 5: 'Uno', 6: 25900, 9: 'ABC1234' }), JAN24, '2024-01-01')
    // Same plate the very next month, but a completely different, unambiguous brand.
    const fev = buildOccurrence(row('FEV24', 5, { 3: 1, 5: 'Honda', 6: 'Civic', 7: 83900, 10: 'ABC1234' }), FEV24, '2024-02-01')

    const { vehicles, matchCandidates, resolutions } = resolveIdentity([jan, fev])

    expect(vehicles).toHaveLength(2) // never fused into one
    const fevResolution = resolutions.find((r) => r.occurrenceKey === 'FEV24#5')
    expect(fevResolution?.matchStatus).toBe('pending_review')

    const conflict = matchCandidates.find((m) => m.occurrenceA === 'FEV24#5')
    expect(conflict?.autoMatchAllowed).toBe(false)
    expect(conflict?.reasonsAgainst.join(' ')).toContain('brand conflicts')
  })

  it('Tier 2/3: a plate-less occurrence with a strong attribute match can auto-merge, but a weak one only becomes a review candidate', () => {
    // Strong: same brand+model+year+value, consecutive month, no plate on either side.
    const jan = buildOccurrence(row('JAN24', 6, { 3: 1, 4: 'Renault', 5: 'Kwid Zen 2021', 6: 49900 }), JAN24, '2024-01-01')
    const fev = buildOccurrence(row('FEV24', 6, { 3: 1, 5: 'Renault', 6: 'Kwid Zen 2021', 7: 49900 }), FEV24, '2024-02-01')

    const strong = resolveIdentity([jan, fev])
    expect(strong.vehicles).toHaveLength(1)
    expect(strong.resolutions.find((r) => r.occurrenceKey === 'FEV24#6')?.matchStatus).toBe('resolved_high_confidence')

    // Weak: same brand only, year/value both differ substantially — must NOT auto-merge.
    const janWeak = buildOccurrence(row('JAN24', 7, { 3: 1, 4: 'Renault', 5: 'Kwid Zen 2021', 6: 49900 }), JAN24, '2024-01-01')
    const fevWeak = buildOccurrence(row('FEV24', 7, { 3: 1, 5: 'Renault', 6: 'Duster Dynamique 2017', 7: 54900 }), FEV24, '2024-02-01')

    const weak = resolveIdentity([janWeak, fevWeak])
    expect(weak.vehicles).toHaveLength(2) // no confident single winner — stays a candidate, not a merge
    expect(weak.resolutions.find((r) => r.occurrenceKey === 'FEV24#7')?.matchStatus).not.toBe('resolved_high_confidence')
  })

  it('an occurrence with no plate and no plausible attribute match becomes its own vehicle, unresolved', () => {
    const isolated = buildOccurrence(row('JAN24', 9, { 4: 'Xyzzy Nothing Recognizable' }), JAN24, '2024-01-01')
    const { vehicles, resolutions } = resolveIdentity([isolated])
    expect(vehicles).toHaveLength(1)
    expect(resolutions[0]?.matchStatus).toBe('unresolved_no_signal')
  })
})
