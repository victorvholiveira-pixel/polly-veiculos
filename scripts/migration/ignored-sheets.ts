/**
 * Explicit list of sheets the pipeline never treats as vehicle/sale data.
 *
 * The `workbook-loader` checks every sheet name against this list BEFORE
 * reading any cell content, and for `reason: 'sensitive'` it skips reading
 * the sheet's cells entirely — it never even parses that worksheet's grid,
 * let alone stores anything from it. This is the single choke point that
 * guarantees the sensitive worksheet's content can never reach a log, a
 * JSON artifact, a report, a test fixture, or git.
 */
export interface IgnoredSheet {
  name: string
  reason: 'duplicate' | 'empty' | 'sensitive' | 'reference_only'
  detail: string
}

export const IGNORED_SHEETS: readonly IgnoredSheet[] = [
  { name: 'Cópia de SET 22', reason: 'duplicate', detail: 'Byte-for-byte duplicate of "SET 22".' },
  { name: 'Cópia de NOVEMBRO ', reason: 'duplicate', detail: 'Byte-for-byte duplicate of "NOV 22".' },
  { name: 'Página16', reason: 'empty', detail: 'Sheet is entirely empty (A1 is null).' },
  { name: 'Página14', reason: 'empty', detail: 'Sheet is entirely empty (A1 is null).' },
  { name: 'Página13', reason: 'empty', detail: 'Sheet is entirely empty (A1 is null).' },
  {
    name: 'INFORMAÇÃO ',
    reason: 'sensitive',
    detail: 'Excluded non-operational sensitive worksheet.',
  },
]

const IGNORED_BY_NAME = new Map(IGNORED_SHEETS.map((s) => [s.name, s]))

export function getIgnoredSheetInfo(sheetName: string): IgnoredSheet | undefined {
  return IGNORED_BY_NAME.get(sheetName)
}

export function isSensitiveSheet(sheetName: string): boolean {
  return getIgnoredSheetInfo(sheetName)?.reason === 'sensitive'
}
