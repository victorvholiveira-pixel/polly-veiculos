import { buildOccurrence } from './occurrence-builder'
import { buildCurrentInventoryCandidates } from './inventory/current-candidate'
import { resolveIdentity } from './identity/resolve'
import { buildReviewQueue } from './review-queue'
import { classifySheets } from './sheet-classifier'
import { detectSales } from './sales/detect'
import type {
  CanonicalVehicleCandidate,
  CurrentInventoryCandidate,
  MatchCandidate,
  NormalizedOccurrence,
  OccurrenceResolution,
  ReviewQueueEntry,
  SaleCandidate,
} from './types'
import { loadWorkbook, type LoadedWorkbook } from './workbook-loader'

export interface PipelineResult {
  workbook: LoadedWorkbook
  unclassifiedSheets: string[]
  occurrences: NormalizedOccurrence[]
  rowsIgnoredAsTotals: number
  vehicles: CanonicalVehicleCandidate[]
  matchCandidates: MatchCandidate[]
  resolutions: OccurrenceResolution[]
  sales: SaleCandidate[]
  currentInventory: { candidates: CurrentInventoryCandidate[]; latestPeriod: string }
  reviewQueue: ReviewQueueEntry[]
}

/**
 * Explicit sheet -> period map (YYYY-MM-01). Built once, by hand, from the
 * same evidence as eras.ts (each sheet's own dates) — kept separate from the
 * layout templates because period is a property of the SHEET, not of the
 * layout family it happens to share with its neighbors.
 */
const PERIOD_BY_SHEET: Record<string, string> = {
  ' JULHO 2022': '2022-07-01',
  'AGOS 22': '2022-08-01',
  'SET 22': '2022-09-01',
  'OUT 22': '2022-10-01',
  'NOV 22': '2022-11-01',
  Dez22: '2022-12-01',
  'JAN 2023': '2023-01-01',
  'FEV 2023': '2023-02-01',
  MARCO23: '2023-03-01',
  'Abril 23': '2023-04-01',
  'Maio 2023': '2023-05-01',
  'JUN 2023': '2023-06-01',
  'JUL 2023': '2023-07-01',
  'AGO 2023': '2023-08-01',
  'SET 2023': '2023-09-01',
  'OUT 2023': '2023-10-01',
  'Nov 2023': '2023-11-01',
  Dez2023: '2023-12-01',
  JAN24: '2024-01-01',
  FEV24: '2024-02-01',
  MARC24: '2024-03-01',
  'A B R 24': '2024-04-01',
  'M A I24': '2024-05-01',
  'J U N 24': '2024-06-01',
  ' J U L   24': '2024-07-01',
  'AGOS   24': '2024-08-01',
  Sete2024: '2024-09-01',
  OUT2024: '2024-10-01',
  'NOV 2024': '2024-11-01',
  'Dez 2024': '2024-12-01',
  'JAN 2025': '2025-01-01',
  'FEV 2025': '2025-02-01',
  'MAR 2025': '2025-03-01',
  'ABR 2025': '2025-04-01',
  'MAI 2025': '2025-05-01',
  'JUN 2025': '2025-06-01',
  ' JUL 2025': '2025-07-01',
  'Agos 2025': '2025-08-01',
  'SET 2025': '2025-09-01',
  'OUT 2025': '2025-10-01',
  'NOV 2025': '2025-11-01',
  'DEZ 2025': '2025-12-01',
  jan2026: '2026-01-01',
  fev2026: '2026-02-01',
  mar2026: '2026-03-01',
  abril2026: '2026-04-01',
  Maio2026: '2026-05-01',
  'JUNHO 2026': '2026-06-01',
  'JULHO 2026': '2026-07-01',
  'AGO 2026': '2026-08-01',
}

export function getSheetPeriod(sheetName: string): string {
  const period = PERIOD_BY_SHEET[sheetName]
  if (!period) throw new Error(`No known period for sheet ${JSON.stringify(sheetName)} — refusing to guess.`)
  return period
}

export async function runPipeline(sourcePath: string): Promise<PipelineResult> {
  const workbook = await loadWorkbook(sourcePath)
  const { classified, unclassifiedSheets } = classifySheets(workbook)

  const occurrences: NormalizedOccurrence[] = []
  let rowsIgnoredAsTotals = 0

  for (const { sheet, layout, dataRows, skippedRows } of classified) {
    const period = getSheetPeriod(sheet.name)
    rowsIgnoredAsTotals += skippedRows
    for (const row of dataRows) {
      occurrences.push(buildOccurrence(row, layout, period))
    }
  }

  const { vehicles, matchCandidates, resolutions } = resolveIdentity(occurrences)
  const sales = detectSales(occurrences, resolutions)
  const currentInventory = buildCurrentInventoryCandidates(vehicles, occurrences)
  const reviewQueue = buildReviewQueue(resolutions, matchCandidates)

  return {
    workbook,
    unclassifiedSheets,
    occurrences,
    rowsIgnoredAsTotals,
    vehicles,
    matchCandidates,
    resolutions,
    sales,
    currentInventory,
    reviewQueue,
  }
}
