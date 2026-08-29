import { callApi } from '@/lib/api'
import type { ReviewDecision } from '@/types/api'
import { loadReviewFixture } from './reviewFixture'

export interface AmbiguousSaleItem {
  id: string
  brand: string | null
  model: string | null
  plate: string | null
  value: number | null
  buyer: string | null
  period: string
  sourceSheet: string
  sourceRow: number
  warnings: string[]
  reviewDecision: ReviewDecision
}

export interface AmbiguousSaleResult {
  items: AmbiguousSaleItem[]
  source: 'live' | 'demo'
}

/**
 * P2 — vendas ambíguas (Onda 3 §13): `sale_classification = 'sale_ambiguous'`
 * occurrences. Reviewing one here only records a decision on the occurrence
 * — it does NOT create a `Sales` row. That happens in a future onda's real
 * historical cutover, using exactly this decision as input.
 */
export async function fetchAmbiguousSales(): Promise<AmbiguousSaleResult> {
  try {
    const items = await callApi<AmbiguousSaleItem[]>('fetchAmbiguousSales')
    return { source: 'live', items }
  } catch {
    const fixture = await loadReviewFixture()
    return {
      source: 'demo',
      items: fixture.ambiguousSales.map((o) => ({
        id: o.key,
        brand: o.brand,
        model: o.model,
        plate: o.plate,
        value: o.value,
        buyer: o.buyer,
        period: o.period,
        sourceSheet: o.sourceSheet,
        sourceRow: o.sourceRow,
        warnings: o.warnings,
        reviewDecision: 'pending',
      })),
    }
  }
}

export type SaleDecision = Extract<ReviewDecision, 'approved' | 'rejected' | 'needs_followup'>

/** Only callable when the list came from 'live' — see ReviewCenter's demo guard. */
export async function decideSale(occurrenceId: string, decision: SaleDecision, reason?: string): Promise<void> {
  await callApi('decideSale', { occurrenceId, decision, reason })
}
