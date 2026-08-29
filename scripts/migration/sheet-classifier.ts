import { resolveLayout } from './eras'
import type { LoadedSheet, LoadedWorkbook } from './workbook-loader'
import { isLikelyTotalOrHeaderRow, parseRow } from './row-parser'
import type { RawRow, SheetLayout } from './types'

export interface ClassifiedSheet {
  sheet: LoadedSheet
  layout: SheetLayout
  /** Rows below the header row that carry a plausible vehicle record. */
  dataRows: RawRow[]
  /** Rows below the header row filtered out as totals/section noise. */
  skippedRows: number
}

export interface ClassificationResult {
  classified: ClassifiedSheet[]
  /** Sheets that were loaded but have no known layout — a real problem, not silently dropped. */
  unclassifiedSheets: string[]
}

/**
 * Maps every loaded sheet to its era layout (eras.ts) and splits its rows
 * into real data rows vs. totals/header noise. A sheet the pipeline has no
 * layout for is surfaced as `unclassifiedSheets`, never silently skipped —
 * that would hide real data instead of just deprioritizing it.
 */
export function classifySheets(workbook: LoadedWorkbook): ClassificationResult {
  const classified: ClassifiedSheet[] = []
  const unclassifiedSheets: string[] = []

  for (const sheet of workbook.sheets) {
    const layout = resolveLayout(sheet.name)
    if (!layout) {
      unclassifiedSheets.push(sheet.name)
      continue
    }

    const dataRows: RawRow[] = []
    let skippedRows = 0
    for (const row of sheet.rows) {
      if (row.rowNumber <= layout.headerRow) continue
      const fields = parseRow(row, layout)
      if (isLikelyTotalOrHeaderRow(fields)) {
        skippedRows += 1
        continue
      }
      dataRows.push(row)
    }

    classified.push({ sheet, layout, dataRows, skippedRows })
  }

  return { classified, unclassifiedSheets }
}
