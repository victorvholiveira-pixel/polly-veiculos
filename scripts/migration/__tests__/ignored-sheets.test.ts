import { describe, expect, it } from 'vitest'
import { getIgnoredSheetInfo, isSensitiveSheet } from '../ignored-sheets'

describe('ignored-sheets', () => {
  it('identifies the sensitive worksheet and exposes only the generic, non-content reason', () => {
    expect(isSensitiveSheet('INFORMAÇÃO ')).toBe(true)
    expect(getIgnoredSheetInfo('INFORMAÇÃO ')?.detail).toBe('Excluded non-operational sensitive worksheet.')
  })

  it('does not flag a real data sheet as ignored', () => {
    expect(getIgnoredSheetInfo('AGO 2026')).toBeUndefined()
    expect(isSensitiveSheet('AGO 2026')).toBe(false)
  })

  it('classifies duplicate and empty sheets distinctly from the sensitive one', () => {
    expect(getIgnoredSheetInfo('Cópia de SET 22')?.reason).toBe('duplicate')
    expect(getIgnoredSheetInfo('Página13')?.reason).toBe('empty')
  })
})
