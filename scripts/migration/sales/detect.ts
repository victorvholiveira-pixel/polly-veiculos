import type { NormalizedOccurrence, OccurrenceResolution, SaleCandidate } from '../types'

/**
 * Era-aware sale detection: a 'sold' occurrence is always evidence of a
 * sale, even when its date is unusable — an invalid date must not cause the
 * sale itself to be discarded (Onda 2 §10). Classification distinguishes a
 * clean sale from one whose date needs a human, and from one where the sale
 * itself is only weakly evidenced.
 */
export function detectSales(
  occurrences: readonly NormalizedOccurrence[],
  resolutions: readonly OccurrenceResolution[],
): SaleCandidate[] {
  const vehicleByOccurrence = new Map(resolutions.map((r) => [r.occurrenceKey, r.vehicleId]))

  const sales: SaleCandidate[] = []
  for (const o of occurrences) {
    if (o.observedStatus !== 'sold') continue

    const key = `${o.sourceSheet}#${o.sourceRow}`
    const hasStrongEvidence = Boolean(o.buyerRaw) || o.valueValidation === 'valid' || Boolean(o.plateRaw)

    const classification: SaleCandidate['classification'] =
      o.saleDateValidation === 'valid'
        ? 'sale_detected'
        : hasStrongEvidence
          ? 'sale_detected_with_invalid_date'
          : 'sale_ambiguous'

    sales.push({
      occurrenceKey: key,
      vehicleCandidateId: vehicleByOccurrence.get(key) ?? null,
      classification,
      saleDate: o.saleDateParsed,
      saleDateValidation: o.saleDateValidation,
      buyer: o.buyerRaw,
      value: o.valueParsed,
      platform: o.platformRaw,
      seller: o.sellerRaw,
      tradeIn: o.tradeInRaw,
      observations: o.observationsRaw,
      warnings: o.warnings,
    })
  }

  return sales
}
