import { supabase } from '@/lib/supabase'
import type { ReviewDecision } from '@/types/database'
import { loadReviewFixture } from './reviewFixture'
import { withTimeout } from './withTimeout'

export interface InventoryReviewItem {
  /** Real vehicle_occurrences.id when backed by Supabase, a synthetic "sheet#row" key in demo mode. */
  id: string
  brand: string | null
  model: string | null
  trim: string | null
  year: number | null
  plate: string | null
  value: number | null
  sourceSheet: string
  sourceRow: number
  monthsSeen: string[]
  warnings: string[]
  confidence: 'high' | 'medium' | 'low'
  reviewDecision: ReviewDecision
}

export interface InventoryReviewResult {
  items: InventoryReviewItem[]
  /** 'supabase' when backed by the real project, 'demo' when it fell back to the offline fixture. */
  source: 'supabase' | 'demo'
}

function qualityToConfidence(quality: string): 'high' | 'medium' | 'low' {
  if (quality === 'reliable') return 'high'
  if (quality === 'partially_reliable') return 'medium'
  return 'low'
}

/**
 * P0 — current inventory candidates (Onda 3 §5): stock occurrences from the
 * most recent period, pending human confirmation before they become real
 * `vehicles` rows. Falls back to the offline demo fixture only when
 * Supabase itself is unreachable — never on an empty (but successful) result.
 */
export async function fetchInventoryCandidates(): Promise<InventoryReviewResult> {
  try {
    const { data: latest, error: latestError } = await withTimeout(
      supabase.from('vehicle_occurrences').select('period').order('period', { ascending: false }).limit(1).maybeSingle(),
    )
    if (latestError) throw latestError
    if (!latest) return { items: [], source: 'supabase' }

    const { data, error } = await withTimeout(
      supabase
        .from('vehicle_occurrences')
        .select('*')
        .eq('observed_status', 'stock')
        .eq('period', latest.period)
        .order('source_row', { ascending: true }),
    )
    if (error) throw error

    return {
      source: 'supabase',
      items: data.map((row) => ({
        id: row.id,
        brand: row.confirmed_brand ?? row.parsed_brand,
        model: row.confirmed_model ?? row.parsed_model,
        trim: row.confirmed_trim ?? row.model_raw,
        year: row.confirmed_year ?? row.parsed_year,
        plate: row.confirmed_plate ?? row.plate_normalized,
        value: row.confirmed_value ?? row.value_parsed,
        sourceSheet: row.source_sheet,
        sourceRow: row.source_row,
        monthsSeen: [row.period],
        warnings: row.warnings,
        confidence: qualityToConfidence(row.data_quality),
        reviewDecision: row.review_decision,
      })),
    }
  } catch {
    const fixture = await loadReviewFixture()
    return {
      source: 'demo',
      items: fixture.currentInventory.map((c) => ({
        id: `${c.sourceSheet}#${c.sourceRow}`,
        brand: c.brand,
        model: c.model,
        trim: c.version,
        year: c.year,
        plate: c.plate,
        value: c.value,
        sourceSheet: c.sourceSheet,
        sourceRow: c.sourceRow,
        monthsSeen: c.priorMonthsSeen,
        warnings: c.warnings,
        confidence: c.confidence,
        reviewDecision: 'pending',
      })),
    }
  }
}

export interface InventoryDecisionInput {
  decision: Extract<ReviewDecision, 'approved' | 'rejected' | 'edited_and_approved'>
  reason?: string
  corrections?: {
    brand?: string
    model?: string
    trim?: string
    year?: number
    plate?: string
    value?: number
  }
}

/** Persists one review decision. Only callable when `source === 'supabase'` — see ReviewCenter's demo guard. */
export async function decideInventoryCandidate(occurrenceId: string, input: InventoryDecisionInput): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('vehicle_occurrences')
    .update({
      review_decision: input.decision,
      review_reason: input.reason ?? null,
      confirmed_brand: input.corrections?.brand,
      confirmed_model: input.corrections?.model,
      confirmed_trim: input.corrections?.trim,
      confirmed_year: input.corrections?.year,
      confirmed_plate: input.corrections?.plate,
      confirmed_value: input.corrections?.value,
      reviewed_by: user?.id ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', occurrenceId)

  if (error) throw error
}

export interface CreateInitialInventoryResult {
  createdVehicleId: string
  sourceSheet: string
  sourceRow: number
}

/** The explicit "Criar estoque inicial" action (Onda 3 §8). Idempotent — see the RPC's own comment. */
export async function createInitialInventory(batchLabel: string): Promise<CreateInitialInventoryResult[]> {
  const { data, error } = await supabase.rpc('create_initial_inventory', { p_batch_label: batchLabel })
  if (error) throw error
  return data.map((row) => ({ createdVehicleId: row.created_vehicle_id, sourceSheet: row.source_sheet, sourceRow: row.source_row }))
}
