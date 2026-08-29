import { callApi } from '@/lib/api'
import type { ReviewDecision } from '@/types/api'
import { loadReviewFixture } from './reviewFixture'

export interface InventoryReviewItem {
  /** Real VehicleOccurrences.id when backed by the live API, a synthetic "sheet#row" key in demo mode. */
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
  /** 'live' when backed by the real API, 'demo' when it fell back to the offline fixture. */
  source: 'live' | 'demo'
}

/**
 * P0 — current inventory candidates (Onda 3 §5): stock occurrences from the
 * most recent period, pending human confirmation before they become real
 * Vehicles rows. Falls back to the offline demo fixture only when the API
 * itself is unreachable — never on an empty (but successful) result.
 */
export async function fetchInventoryCandidates(): Promise<InventoryReviewResult> {
  try {
    const items = await callApi<InventoryReviewItem[]>('fetchInventoryCandidates')
    return { source: 'live', items }
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

/** Persists one review decision. Only callable when `source === 'live'` — see ReviewCenter's demo guard. */
export async function decideInventoryCandidate(occurrenceId: string, input: InventoryDecisionInput): Promise<void> {
  await callApi('decideInventoryCandidate', { occurrenceId, decision: input.decision, reason: input.reason, corrections: input.corrections })
}

export interface CreateInitialInventoryResult {
  createdVehicleId: string
  sourceSheet: string
  sourceRow: number
}

/** The explicit "Criar estoque inicial" action (Onda 3 §8). Idempotent — see gas/Logic.js's createInitialInventory_. */
export async function createInitialInventory(batchLabel: string): Promise<CreateInitialInventoryResult[]> {
  return callApi<CreateInitialInventoryResult[]>('createInitialInventory', { batchLabel })
}
