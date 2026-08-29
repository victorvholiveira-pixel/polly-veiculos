import type { PipelineResult } from '../pipeline'

export interface MigrationSummary {
  generatedAt: string
  workbook: {
    totalSheets: number
    usedSheets: number
    ignoredSheets: Array<{ name: string; reason: string; detail: string }>
    unclassifiedSheets: string[]
    periodFrom: string
    periodTo: string
  }
  rows: {
    totalDataRows: number
    ignoredAsTotalsOrHeaders: number
  }
  vehicles: {
    occurrences: number
    canonicalVehiclesEstimated: number
    autoMatchesTier1: number
    autoMatchesTier2: number
    reviewCandidates: number
    conflicts: number
  }
  plates: { old: number; mercosul: number; invalid: number; missing: number }
  dates: { valid: number; invalidPlaceholderDay: number; invalidYearDigits: number; implausibleYear: number; missing: number }
  sales: { detected: number; validDate: number; invalidDate: number; ambiguous: number }
  currentInventory: { count: number; totalValue: number; withWarnings: number }
  reviewQueue: { totalEntries: number; byReason: Record<string, number> }
}

export function buildSummary(result: PipelineResult): MigrationSummary {
  const { workbook, occurrences, vehicles, matchCandidates, sales, currentInventory, reviewQueue, unclassifiedSheets, rowsIgnoredAsTotals } =
    result

  const periods = occurrences.map((o) => o.sourcePeriod).sort()

  const plates = { old: 0, mercosul: 0, invalid: 0, missing: 0 }
  const dates = { valid: 0, invalidPlaceholderDay: 0, invalidYearDigits: 0, implausibleYear: 0, missing: 0 }
  for (const o of occurrences) {
    plates[o.plateFormat] += 1
    if (o.saleDateValidation === 'valid') dates.valid += 1
    else if (o.saleDateValidation === 'invalid_placeholder_day') dates.invalidPlaceholderDay += 1
    else if (o.saleDateValidation === 'invalid_year_digits') dates.invalidYearDigits += 1
    else if (o.saleDateValidation === 'implausible_year') dates.implausibleYear += 1
    else dates.missing += 1
  }

  const autoMatchesTier1 = result.resolutions.filter((r) => r.matchStatus === 'resolved_exact_plate' && r.matchScore === 1).length
  const autoMatchesTier2 = result.resolutions.filter((r) => r.matchStatus === 'resolved_high_confidence').length
  const reviewCandidates = result.resolutions.filter((r) => r.matchStatus === 'pending_review').length
  const conflicts = matchCandidates.filter((m) => m.reasonsAgainst.some((r) => r.includes('conflict'))).length

  const inventoryTotalValue = currentInventory.candidates.reduce((sum, c) => sum + (c.value ?? 0), 0)
  const inventoryWithWarnings = currentInventory.candidates.filter((c) => c.warnings.length > 0).length

  const byReason: Record<string, number> = {}
  for (const entry of reviewQueue) {
    byReason[entry.reason] = entry.occurrenceKeys.length
  }

  return {
    generatedAt: new Date().toISOString(),
    workbook: {
      totalSheets: workbook.allSheetNames.length,
      usedSheets: workbook.sheets.length,
      ignoredSheets: workbook.skipped.map((s) => ({ name: s.name, reason: s.info.reason, detail: s.info.detail })),
      unclassifiedSheets,
      periodFrom: periods[0] ?? '',
      periodTo: periods[periods.length - 1] ?? '',
    },
    rows: {
      totalDataRows: occurrences.length,
      ignoredAsTotalsOrHeaders: rowsIgnoredAsTotals,
    },
    vehicles: {
      occurrences: occurrences.length,
      canonicalVehiclesEstimated: vehicles.length,
      autoMatchesTier1,
      autoMatchesTier2,
      reviewCandidates,
      conflicts,
    },
    plates,
    dates,
    sales: {
      detected: sales.length,
      validDate: sales.filter((s) => s.classification === 'sale_detected').length,
      invalidDate: sales.filter((s) => s.classification === 'sale_detected_with_invalid_date').length,
      ambiguous: sales.filter((s) => s.classification === 'sale_ambiguous').length,
    },
    currentInventory: {
      count: currentInventory.candidates.length,
      totalValue: inventoryTotalValue,
      withWarnings: inventoryWithWarnings,
    },
    reviewQueue: {
      totalEntries: reviewQueue.reduce((sum, e) => sum + e.occurrenceKeys.length, 0),
      byReason,
    },
  }
}
