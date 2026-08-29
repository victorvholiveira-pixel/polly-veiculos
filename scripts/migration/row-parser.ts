import type { LayoutColumns, RawRow, SheetLayout } from './types'

/** Raw field values extracted by position — one step before any normalization. */
export interface ParsedRawFields {
  brandModelRaw: unknown
  versionRaw: unknown
  valueRaw: unknown
  saleDateRaw: unknown
  stockFlagRaw: unknown
  buyerRaw: unknown
  phoneRaw: unknown
  tradeInRaw: unknown
  platformRaw: unknown
  sellerRaw: unknown
  reportRaw: unknown
  observationsRaw: unknown
  plateRaw: unknown
}

function at(row: RawRow, columns: LayoutColumns, key: keyof LayoutColumns): unknown {
  const idx = columns[key]
  return idx === undefined ? null : (row.cells.get(idx) ?? null)
}

/**
 * Extracts raw field values from a row using ONLY the era layout's column
 * positions — never the row's own header text (there is no header text at
 * data-row level anyway; this is the boundary that keeps position, not
 * content, authoritative for every field below).
 */
export function parseRow(row: RawRow, layout: SheetLayout): ParsedRawFields {
  const c = layout.columns
  return {
    brandModelRaw: at(row, c, 'marca'),
    versionRaw: at(row, c, 'modelo'),
    valueRaw: at(row, c, 'valor'),
    saleDateRaw: at(row, c, 'date'),
    stockFlagRaw: c.flag !== undefined ? at(row, c, 'flag') : at(row, c, 'nome'),
    buyerRaw: c.compr !== undefined ? at(row, c, 'compr') : at(row, c, 'nome'),
    phoneRaw: at(row, c, 'fone'),
    tradeInRaw: c.troca !== undefined ? at(row, c, 'troca') : at(row, c, 'entrada'),
    platformRaw: at(row, c, 'plataforma'),
    sellerRaw: at(row, c, 'vended'),
    reportRaw: at(row, c, 'laudo'),
    observationsRaw: at(row, c, 'obs'),
    plateRaw: at(row, c, 'placa'),
  }
}

/**
 * Rows that are entirely totals/section-header noise rather than a vehicle
 * record: no brand/model text, no plate, no value, no date. Filtering these
 * out here keeps every downstream stage working with real candidate rows only.
 */
export function isLikelyTotalOrHeaderRow(fields: ParsedRawFields): boolean {
  // Require at least one letter, not just any non-empty string — the audit
  // found stray single-character junk cells (e.g. a lone "." at AGO 2026
  // row 184) that are non-empty but not a real brand/model description.
  const hasBrand = typeof fields.brandModelRaw === 'string' && /[a-zA-Z]/.test(fields.brandModelRaw)
  const hasPlate = typeof fields.plateRaw === 'string' && /[a-zA-Z]/.test(fields.plateRaw)
  const hasValue = typeof fields.valueRaw === 'number' && fields.valueRaw > 0
  const hasDate = fields.saleDateRaw !== null && fields.saleDateRaw !== undefined && fields.saleDateRaw !== ''
  return !hasBrand && !hasPlate && !hasValue && !hasDate
}
