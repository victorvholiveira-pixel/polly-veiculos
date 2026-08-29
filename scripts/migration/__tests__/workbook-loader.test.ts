import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import ExcelJS from 'exceljs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadWorkbook } from '../workbook-loader'

// Deliberately fake-looking "credential" text — structurally similar to what
// the real sensitive worksheet contains, but not copied from it. This test
// exists to prove the loader never reads it, not to hold real secrets.
const FAKE_SENSITIVE_CONTENT = 'PlataformaFake | fake.user@example.com | fake-not-a-real-password-1234'

describe('loadWorkbook — sensitive sheet handling', () => {
  let dir: string
  let filePath: string

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'polly-migration-test-'))
    filePath = path.join(dir, 'fixture.xlsx')

    const workbook = new ExcelJS.Workbook()
    const realSheet = workbook.addWorksheet(' JULHO 2022')
    realSheet.getCell('A4').value = 'Data venda'
    realSheet.getCell('B4').value = 'Marca'
    realSheet.getCell('A5').value = new Date(Date.UTC(2022, 6, 5))
    realSheet.getCell('B5').value = 'Fiat Palio'

    const sensitiveSheet = workbook.addWorksheet('INFORMAÇÃO ')
    sensitiveSheet.getCell('A2').value = FAKE_SENSITIVE_CONTENT

    await workbook.xlsx.writeFile(filePath)
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('never reads the sensitive worksheet\'s cells into the loaded result', async () => {
    const result = await loadWorkbook(filePath)

    const loadedNames = result.sheets.map((s) => s.name)
    expect(loadedNames).toContain(' JULHO 2022')
    expect(loadedNames).not.toContain('INFORMAÇÃO ')

    // The fake content must not appear ANYWHERE in the loaded result — not
    // even as a stray value on another sheet's row (proves no cross-leak).
    const serialized = JSON.stringify(
      result.sheets.map((s) => s.rows.map((r) => [...r.cells.values()])),
    )
    expect(serialized).not.toContain('fake.user@example.com')
    expect(serialized).not.toContain('fake-not-a-real-password')
  })

  it('records the sensitive sheet only as a generic, non-content skip reason', async () => {
    const result = await loadWorkbook(filePath)
    const skipped = result.skipped.find((s) => s.name === 'INFORMAÇÃO ')
    expect(skipped?.info.reason).toBe('sensitive')
    expect(skipped?.info.detail).toBe('Excluded non-operational sensitive worksheet.')
  })
})
