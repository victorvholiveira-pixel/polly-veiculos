import { describe, expect, it } from 'vitest'
import { resolveLayout } from '../eras'
import { isLikelyTotalOrHeaderRow, parseRow } from '../row-parser'
import type { RawRow } from '../types'

function row(sheetName: string, rowNumber: number, cells: Record<number, unknown>): RawRow {
  return { sheetName, rowNumber, cells: new Map(Object.entries(cells).map(([k, v]) => [Number(k), v])) }
}

describe('parseRow — position-based layout mapping', () => {
  it('extracts fields by the era layout position, not by any header text (L2: AGOS 22 / SET 22)', () => {
    const layout = resolveLayout('AGOS 22')!
    // A=0 date, B=1 marca, C=2 modelo, D=3 valor, E=4 entrada, F=5 nome/flag, G=6 fone, H=7 placa
    const r = row('AGOS 22', 5, { 1: 'Honda Civic. 2016', 2: 'LXR. 2.0', 3: 83900, 5: 1, 7: 'FJV 1543' })
    const fields = parseRow(r, layout)
    expect(fields.brandModelRaw).toBe('Honda Civic. 2016')
    expect(fields.versionRaw).toBe('LXR. 2.0')
    expect(fields.valueRaw).toBe(83900)
    expect(fields.plateRaw).toBe('FJV 1543')
    expect(fields.stockFlagRaw).toBe(1) // no dedicated flag column in L2 — falls back to the "nome" slot
  })

  it('extracts fields correctly for a later era with a dedicated stock-flag column (L12: JAN24)', () => {
    const layout = resolveLayout('JAN24')!
    // A=0 date, D=3 flag, E=4 marca, F=5 modelo, G=6 valor, J=9 placa
    const r = row('JAN24', 10, { 3: 1, 4: 'Fiat', 5: 'Uno', 6: 25900, 9: 'ABC1234' })
    const fields = parseRow(r, layout)
    expect(fields.stockFlagRaw).toBe(1)
    expect(fields.brandModelRaw).toBe('Fiat')
    expect(fields.plateRaw).toBe('ABC1234')
  })

  it('resolves every sheet name referenced by an era layout', () => {
    // Two sheets from very different eras — proves the sheet -> layout map isn't accidentally a single fallback.
    expect(resolveLayout(' JULHO 2022')?.id).toBe('L1')
    expect(resolveLayout('AGO 2026')?.id).toBe('L21')
    expect(resolveLayout('a sheet that does not exist')).toBeUndefined()
  })
})

describe('isLikelyTotalOrHeaderRow', () => {
  it('flags a row with no brand, plate, value or date as noise (a totals/section row)', () => {
    const layout = resolveLayout('AGO 2026')!
    const r = row('AGO 2026', 200, {})
    expect(isLikelyTotalOrHeaderRow(parseRow(r, layout))).toBe(true)
  })

  it('does not treat a single stray punctuation character as real brand data', () => {
    const layout = resolveLayout('AGO 2026')!
    // F = marca column for L21 (index 5)
    const r = row('AGO 2026', 184, { 5: '.' })
    expect(isLikelyTotalOrHeaderRow(parseRow(r, layout))).toBe(true)
  })

  it('keeps a row with a real (even if incomplete) vehicle description', () => {
    const layout = resolveLayout('AGO 2026')!
    const r = row('AGO 2026', 8, { 5: 'Ecosport 2011' })
    expect(isLikelyTotalOrHeaderRow(parseRow(r, layout))).toBe(false)
  })
})
