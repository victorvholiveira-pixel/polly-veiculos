/**
 * Hand-written mirror of the schema in supabase/migrations/, shaped like the
 * output of `supabase gen types typescript`.
 *
 * TODO(Onda 2+): once a real Supabase project is linked, replace this file by
 * running `supabase gen types typescript --linked > src/types/database.ts`
 * and delete this note. Until then this is the single source of truth for
 * table shapes in the app — do not hand-roll a second copy of these models
 * anywhere else (see ARCHITECTURE.md).
 *
 * Note on `numeric` columns: the real generator emits `string` for `numeric`
 * (Postgres numeric can exceed JS float precision). This hand-written version
 * uses `number` for ergonomics during the foundation wave; re-check this
 * against the generated types once available.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type VehicleStatus = 'available' | 'reserved' | 'sold'
export type VehicleOrigin = 'manual' | 'migration'
export type PlateFormat = 'old' | 'mercosul' | 'unknown'
export type OccurrenceObservedStatus = 'stock' | 'sold'
export type OccurrenceDataQuality = 'reliable' | 'partially_reliable' | 'ambiguous' | 'invalid'
export type OccurrenceMatchStatus =
  | 'resolved_exact_plate'
  | 'resolved_high_confidence'
  | 'resolved_manual'
  | 'pending_review'
  | 'unresolved_no_signal'
export type SaleStatus = 'completed' | 'cancelled'
export type AuditEntityType = 'vehicle' | 'sale' | 'vehicle_occurrence' | 'settings'

export interface Database {
  public: {
    Tables: {
      vehicles: {
        Row: {
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
        Insert: {
          id?: string
          brand: string
          model: string
          trim?: string | null
          model_year?: number | null
          manufacture_year?: number | null
          plate?: string | null
          plate_format?: PlateFormat | null
          asking_price?: number | null
          entry_date?: string | null
          origin?: VehicleOrigin
          status?: VehicleStatus
          observations?: string | null
          founding_occurrence_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['vehicles']['Insert']>
      }
      vehicle_occurrences: {
        Row: {
          id: string
          source_sheet: string
          source_row: number
          period: string
          observed_status: OccurrenceObservedStatus
          brand_raw: string | null
          model_raw: string | null
          plate_raw: string | null
          value_raw: number | null
          sale_date_raw: string | null
          buyer_name_raw: string | null
          buyer_phone_raw: string | null
          channel_raw: string | null
          seller_raw: string | null
          trade_in_raw: string | null
          observations_raw: string | null
          original_payload: Json
          data_quality: OccurrenceDataQuality
          vehicle_id: string | null
          match_status: OccurrenceMatchStatus
          match_score: number | null
          migration_run_id: string
          imported_at: string
          reviewed_by: string | null
          reviewed_at: string | null
        }
        Insert: {
          id?: string
          source_sheet: string
          source_row: number
          period: string
          observed_status: OccurrenceObservedStatus
          brand_raw?: string | null
          model_raw?: string | null
          plate_raw?: string | null
          value_raw?: number | null
          sale_date_raw?: string | null
          buyer_name_raw?: string | null
          buyer_phone_raw?: string | null
          channel_raw?: string | null
          seller_raw?: string | null
          trade_in_raw?: string | null
          observations_raw?: string | null
          original_payload: Json
          data_quality: OccurrenceDataQuality
          vehicle_id?: string | null
          match_status?: OccurrenceMatchStatus
          match_score?: number | null
          migration_run_id: string
          imported_at?: string
          reviewed_by?: string | null
          reviewed_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['vehicle_occurrences']['Insert']>
      }
      vehicle_match_candidates: {
        Row: {
          id: string
          occurrence_id: string
          candidate_vehicle_id: string
          score: number
          reason: string
          created_at: string
        }
        Insert: {
          id?: string
          occurrence_id: string
          candidate_vehicle_id: string
          score: number
          reason: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['vehicle_match_candidates']['Insert']>
      }
      sellers: {
        Row: {
          id: string
          name: string
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['sellers']['Insert']>
      }
      sales: {
        Row: {
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
          commission_rule_snapshot: Json | null
          observations: string | null
          status: SaleStatus
          cancelled_reason: string | null
          cancelled_at: string | null
          source_occurrence_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        // No public Insert/Update: rows are written only via the future
        // register_sale/cancel_sale RPC functions (see ARCHITECTURE.md).
        Insert: never
        Update: never
      }
      app_settings: {
        Row: {
          id: true
          default_commission_pct: number | null
          store_name: string
          cnpj: string | null
          updated_at: string
        }
        Insert: never // seeded once by migration; never inserted from the app
        Update: {
          default_commission_pct?: number | null
          store_name?: string
          cnpj?: string | null
          updated_at?: string
        }
      }
      audit_log: {
        Row: {
          id: string
          entity_type: AuditEntityType
          entity_id: string
          action: string
          actor: string | null
          diff: Json | null
          created_at: string
        }
        // Written only by RPCs/triggers, never directly from the app.
        Insert: never
        Update: never
      }
    }
  }
}
