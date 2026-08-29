// Shared types for the migration pipeline. This module has no side effects
// and no I/O — safe to import from tests and from all pipeline stages.

export type ObservedStatus = 'stock' | 'sold'

export type DataQuality = 'reliable' | 'partially_reliable' | 'ambiguous' | 'invalid'

export type DateValidationStatus =
  | 'valid'
  | 'invalid_placeholder_day'
  | 'invalid_year_digits'
  | 'implausible_year'
  | 'missing'

export type PlateFormat = 'old' | 'mercosul' | 'invalid' | 'missing'

export type ValueValidation = 'valid' | 'null' | 'negative' | 'zero' | 'implausible'

/** Column positions for one sheet layout, 0-indexed (column A = 0). */
export interface LayoutColumns {
  date?: number
  flag?: number
  marca?: number
  modelo?: number
  valor?: number
  /** "Entrada/Troca" (early eras) or "Entrou Lj" (later eras) — stock entry evidence, not a sale date. */
  entrada?: number
  /** Buyer name, early eras ("Nome"). Sometimes doubles as an ad hoc stock flag (see eras.ts notes). */
  nome?: number
  /** Buyer name, later eras ("Compr"/"Comprador"), replaces `nome`. */
  compr?: number
  fone?: number
  placa?: number
  tempoV?: number
  plataforma?: number
  vended?: number
  laudo?: number
  troca?: number
  obs?: number
}

export interface SheetLayout {
  /** Stable id, e.g. "L12". Referenced by occurrences for traceability. */
  id: string
  /** Broad era name for human-facing reporting, e.g. "Era C — Plataforma/Vended/Laudo". */
  eraFamily: string
  periodLabel: string
  sheets: string[]
  /** 1-indexed row holding the header. Data starts at headerRow + 1. */
  headerRow: number
  columns: LayoutColumns
  /** Era A only: no stock-flag concept exists — every row is a completed sale. */
  allRowsSold?: boolean
  notes: string[]
}

/** One raw data row as read from a sheet, before any interpretation. */
export interface RawRow {
  sheetName: string
  /** 1-indexed row number, matching what a human sees in Excel. */
  rowNumber: number
  /** 0-indexed column -> raw cell value, as returned by the workbook loader. */
  cells: Map<number, unknown>
}

/**
 * One occurrence of a vehicle in one monthly sheet — the intermediate
 * representation described in FASE 0.5 / Onda 2 §5. Mirrors (but is not
 * identical to) the VehicleOccurrences sheet shape from gas/Store.js.
 */
export interface NormalizedOccurrence {
  sourceSheet: string
  sourceRow: number
  /** YYYY-MM-01, the sheet's month. */
  sourcePeriod: string
  layoutId: string

  // --- raw values, verbatim from the workbook (never mutated) ---
  brandModelRaw: string | null
  versionRaw: string | null
  plateRaw: string | null
  valueRaw: number | string | null
  saleDateRaw: string | null
  stockFlagRaw: string | number | null
  buyerRaw: string | null
  phoneRaw: string | null
  tradeInRaw: string | null
  platformRaw: string | null
  sellerRaw: string | null
  reportRaw: string | null
  observationsRaw: string | null
  /** Sanitized subset of raw cells for this row, keyed by field name — never includes the excluded sensitive worksheet. */
  originalPayload: Record<string, unknown>

  // --- normalized / parsed values, always kept separate from raw ---
  plateNormalized: string | null
  plateFormat: PlateFormat

  saleDateParsed: string | null
  saleDateValidation: DateValidationStatus
  /** Heuristic best guess when the raw date is invalid — NEVER treated as confirmed. */
  saleDateSuggestedValue: string | null

  valueParsed: number | null
  valueValidation: ValueValidation

  parsedBrand: string | null
  parsedModel: string | null
  parsedYear: number | null
  descriptionConfidence: 'high' | 'medium' | 'low'

  observedStatus: ObservedStatus
  observedStatusBasis: string

  warnings: string[]
  dataQuality: DataQuality
}

export function occurrenceKey(o: Pick<NormalizedOccurrence, 'sourceSheet' | 'sourceRow'>): string {
  return `${o.sourceSheet}#${o.sourceRow}`
}

// --- Identity resolution ---

export type MatchTier = 1 | 2 | 3

export interface MatchCandidate {
  occurrenceA: string
  occurrenceB: string
  tier: MatchTier
  score: number
  reasonsFor: string[]
  reasonsAgainst: string[]
  suggestedDecision: 'auto_match' | 'candidate_review' | 'reject'
  autoMatchAllowed: boolean
}

export interface CanonicalVehicleCandidate {
  id: string
  brand: string | null
  model: string | null
  version: string | null
  year: number | null
  plate: string | null
  occurrenceKeys: string[]
  firstSeenAt: string
  lastSeenAt: string
  finalStatus: 'stock_candidate' | 'sold_candidate' | 'unknown'
  confidence: 'high' | 'medium' | 'low'
  resolutionMethod: 'tier1_plate_continuity' | 'tier2_attribute_match' | 'tier3_unresolved_singleton' | 'manual'
}

export type OccurrenceMatchStatus =
  | 'resolved_exact_plate'
  | 'resolved_high_confidence'
  | 'resolved_manual'
  | 'pending_review'
  | 'unresolved_no_signal'

/** Resolution outcome for one occurrence, kept separate from NormalizedOccurrence (which stays immutable). */
export interface OccurrenceResolution {
  occurrenceKey: string
  vehicleId: string
  matchStatus: OccurrenceMatchStatus
  matchScore: number | null
}

// --- Sales ---

export type SaleClassification = 'sale_detected' | 'sale_detected_with_invalid_date' | 'sale_ambiguous'

export interface SaleCandidate {
  occurrenceKey: string
  vehicleCandidateId: string | null
  classification: SaleClassification
  saleDate: string | null
  saleDateValidation: DateValidationStatus
  buyer: string | null
  value: number | null
  platform: string | null
  seller: string | null
  tradeIn: string | null
  observations: string | null
  warnings: string[]
}

// --- Current inventory ---

export interface CurrentInventoryCandidate {
  vehicleCandidateId: string
  brand: string | null
  model: string | null
  version: string | null
  year: number | null
  plate: string | null
  value: number | null
  sourceSheet: string
  sourceRow: number
  confidence: 'high' | 'medium' | 'low'
  warnings: string[]
  priorMonthsSeen: string[]
}

// --- Review queue ---

export interface ReviewQueueEntry {
  reason: string
  occurrenceKeys: string[]
  detail: string
}
