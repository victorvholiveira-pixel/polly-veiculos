import ExcelJS from 'exceljs'
import { getIgnoredSheetInfo, type IgnoredSheet } from './ignored-sheets'
import type { RawRow } from './types'

export interface LoadedSheet {
  name: string
  /** 1-indexed row -> (0-indexed column -> value). */
  rows: RawRow[]
  maxRow: number
  maxCol: number
}

export interface LoadedWorkbook {
  sourcePath: string
  allSheetNames: string[]
  /** Sheets actually loaded (i.e. not in IGNORED_SHEETS). */
  sheets: LoadedSheet[]
  /** Every skipped sheet with its reason — the auditable "ignored sheets" list for the report. */
  skipped: Array<{ name: string; info: IgnoredSheet }>
}

function cellValue(cell: ExcelJS.Cell): unknown {
  const v = cell.value
  if (v === null || v === undefined) return null
  if (typeof v === 'object') {
    // ExcelJS represents rich text, hyperlinks and formula results as objects.
    if ('result' in v) return (v as { result: unknown }).result ?? null
    if ('richText' in v) {
      return (v as { richText: Array<{ text: string }> }).richText.map((r) => r.text).join('')
    }
    if (v instanceof Date) return v
    if ('text' in v) return (v as { text: unknown }).text
  }
  return v
}

/**
 * Loads the workbook from disk. Sensitive/ignored sheets (see ignored-sheets.ts)
 * are recognized by NAME ONLY and their cell grid is never read — `worksheet.eachRow`
 * is simply never called for them, so their content never enters process memory
 * as parsed data.
 */
export async function loadWorkbook(sourcePath: string): Promise<LoadedWorkbook> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(sourcePath)

  const allSheetNames = workbook.worksheets.map((ws) => ws.name)
  const sheets: LoadedSheet[] = []
  const skipped: LoadedWorkbook['skipped'] = []

  for (const worksheet of workbook.worksheets) {
    const ignored = getIgnoredSheetInfo(worksheet.name)
    if (ignored) {
      skipped.push({ name: worksheet.name, info: ignored })
      continue
    }

    const rows: RawRow[] = []
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const cells = new Map<number, unknown>()
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const value = cellValue(cell)
        if (value !== null && value !== '') {
          cells.set(colNumber - 1, value) // store 0-indexed
        }
      })
      if (cells.size > 0) {
        rows.push({ sheetName: worksheet.name, rowNumber, cells })
      }
    })

    sheets.push({
      name: worksheet.name,
      rows,
      maxRow: worksheet.rowCount,
      maxCol: worksheet.columnCount,
    })
  }

  return { sourcePath, allSheetNames, sheets, skipped }
}
