import type { CanonicalVehicleCandidate, CurrentInventoryCandidate, NormalizedOccurrence } from '../types'

/**
 * Builds the "estoque atual candidato" (Onda 2 §12): vehicles whose
 * trajectory ends, still unsold, in the workbook's most recent period. This
 * is explicitly a CANDIDATE list for human validation — see the cutover
 * review flow in ARCHITECTURE.md — never inserted as official inventory here.
 */
export function buildCurrentInventoryCandidates(
  vehicles: readonly CanonicalVehicleCandidate[],
  occurrences: readonly NormalizedOccurrence[],
): { candidates: CurrentInventoryCandidate[]; latestPeriod: string } {
  const occurrenceByKey = new Map(occurrences.map((o) => [`${o.sourceSheet}#${o.sourceRow}`, o]))
  const latestPeriod = occurrences.reduce((max, o) => (o.sourcePeriod > max ? o.sourcePeriod : max), '')

  const candidates: CurrentInventoryCandidate[] = []

  for (const vehicle of vehicles) {
    if (vehicle.finalStatus !== 'stock_candidate') continue
    if (vehicle.lastSeenAt !== latestPeriod) continue

    const lastOccurrenceKey = vehicle.occurrenceKeys[vehicle.occurrenceKeys.length - 1]!
    const lastOccurrence = occurrenceByKey.get(lastOccurrenceKey)
    if (!lastOccurrence) continue

    const priorMonthsSeen = [
      ...new Set(vehicle.occurrenceKeys.map((k) => occurrenceByKey.get(k)?.sourcePeriod).filter((p): p is string => Boolean(p))),
    ].sort()

    const warnings = [...lastOccurrence.warnings]
    if (!vehicle.plate) warnings.push('no plate recorded for this vehicle across any occurrence')
    if (!vehicle.brand) warnings.push('brand could not be parsed with confidence')

    candidates.push({
      vehicleCandidateId: vehicle.id,
      brand: vehicle.brand,
      model: vehicle.model,
      version: vehicle.version,
      year: vehicle.year,
      plate: vehicle.plate,
      value: lastOccurrence.valueParsed,
      sourceSheet: lastOccurrence.sourceSheet,
      sourceRow: lastOccurrence.sourceRow,
      confidence: vehicle.confidence,
      warnings,
      priorMonthsSeen,
    })
  }

  return { candidates, latestPeriod }
}
