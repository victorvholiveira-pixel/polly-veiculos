import { supabase } from '@/lib/supabase'
import type { ReviewDecision } from '@/types/database'
import { loadReviewFixture } from './reviewFixture'
import { withTimeout } from './withTimeout'

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
  source: 'supabase' | 'demo'
}

/**
 * P2 — vendas ambíguas (Onda 3 §13): `sale_classification = 'sale_ambiguous'`
 * occurrences. Reviewing one here only records a decision on the occurrence
 * — it does NOT create a `sales` row. That happens in a future onda's real
 * historical cutover, using exactly this decision as input.
 */
export async function fetchAmbiguousSales(): Promise<AmbiguousSaleResult> {
  try {
    const { data, error } = await withTimeout(
      supabase.from('vehicle_occurrences').select('*').eq('sale_classification', 'sale_ambiguous').order('period', { ascending: true }),
    )
    if (error) throw error

    return {
      source: 'supabase',
      items: data.map((row) => ({
        id: row.id,
        brand: row.confirmed_brand ?? row.parsed_brand,
        model: row.confirmed_model ?? row.parsed_model,
        plate: row.confirmed_plate ?? row.plate_normalized,
        value: row.confirmed_value ?? row.value_parsed,
        buyer: row.buyer_name_raw,
        period: row.period,
        sourceSheet: row.source_sheet,
        sourceRow: row.source_row,
        warnings: row.warnings,
        reviewDecision: row.review_decision,
      })),
    }
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

/** Only callable when the list came from 'supabase' — see ReviewCenter's demo guard. */
export async function decideSale(occurrenceId: string, decision: SaleDecision, reason?: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('vehicle_occurrences')
    .update({
      review_decision: decision,
      review_reason: reason ?? null,
      reviewed_by: user?.id ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', occurrenceId)

  if (error) throw error
}
