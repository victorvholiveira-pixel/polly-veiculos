/**
 * Formatos de linha devolvidos pelo backend (Google Apps Script + Sheets —
 * ver gas/Store.js e gas/Logic.js, que são a fonte de verdade). Espelha os
 * nomes de coluna das abas 1:1 — sem camada de tradução — para o backend
 * poder mudar de motor de novo no futuro sem reescrever este arquivo.
 */

export type VehicleStatus = 'available' | 'reserved' | 'sold'
export type VehicleOrigin = 'manual' | 'migration'
export type PlateFormat = 'old' | 'mercosul' | 'unknown'
export type SaleStatus = 'completed' | 'cancelled'
export type ReviewDecision = 'pending' | 'approved' | 'rejected' | 'edited_and_approved' | 'needs_followup'
export type SaleClassification = 'sale_detected' | 'sale_detected_with_invalid_date' | 'sale_ambiguous'
export type MatchCandidateDecision = 'pending' | 'same_vehicle' | 'different_vehicles'
export type AuditEntityType = 'vehicle' | 'sale' | 'vehicle_occurrence' | 'settings'

export interface Vehicle {
  id: string
  brand: string
  model: string
  trim: string | null
  model_year: number | null
  manufacture_year: number | null
  plate: string | null
  plate_format: PlateFormat | null
  asking_price: number | null
  entry_date: string | null
  origin: VehicleOrigin
  status: VehicleStatus
  observations: string | null
  founding_occurrence_id: string | null
  created_at: string
  updated_at: string
}

export interface Sale {
  id: string
  vehicle_id: string
  seller_id: string | null
  sale_date: string
  customer_name: string | null
  customer_phone: string | null
  sale_value: number
  deal_type: string | null
  trade_in_description: string | null
  channel: string | null
  commission_amount: number | null
  commission_percentage: number | null
  commission_rule_snapshot: unknown
  observations: string | null
  status: SaleStatus
  cancelled_reason: string | null
  cancelled_at: string | null
  source_occurrence_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface SaleWithDetails extends Sale {
  vehicle: { brand: string; model: string; trim: string | null; plate: string | null } | null
  sellerName: string | null
}

export interface Seller {
  id: string
  name: string
  active: boolean
  created_at: string
  updated_at: string
}

export interface AppSettings {
  id: string
  default_commission_pct: number | null
  store_name: string
  cnpj: string | null
  updated_at: string
}

export interface AuditLogEntry {
  id: string
  entity_type: AuditEntityType
  action: string
  entity_id: string
  actor: string | null
  diff: unknown
  created_at: string
}
