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
 *
 * Every table below carries `Relationships: []` and the schema carries an
 * empty `Views` — required to structurally satisfy supabase-js's
 * `GenericTable`/`GenericSchema` constraints (omitting them silently
 * degrades every `.from(...)` call to `any`, which is how a real type error
 * here previously went unnoticed — see Onda 3's report for the finding).
 *
 * `sales`/`audit_log`/`app_settings` have no RLS insert policy for
 * `authenticated` — the app must never write them directly. That is
 * enforced by the database (RLS), not by these types: `GenericTable`
 * requires `Insert`/`Update` to be real object shapes, so a `never` here
 * (an earlier, type-only attempt at the same protection) doesn't type-check.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type VehicleStatus = 'available' | 'reserved' | 'sold'
export type VehicleOrigin = 'manual' | 'migration'
export type PlateFormat = 'old' | 'mercosul' | 'unknown'
export type OccurrencePlateFormat = 'old' | 'mercosul' | 'invalid' | 'missing'
export type OccurrenceObservedStatus = 'stock' | 'sold'
export type OccurrenceDataQuality = 'reliable' | 'partially_reliable' | 'ambiguous' | 'invalid'
export type OccurrenceMatchStatus =
  | 'resolved_exact_plate'
  | 'resolved_high_confidence'
  | 'resolved_manual'
  | 'pending_review'
  | 'unresolved_no_signal'
export type ReviewDecision = 'pending' | 'approved' | 'rejected' | 'edited_and_approved' | 'needs_followup'
export type SaleClassification = 'sale_detected' | 'sale_detected_with_invalid_date' | 'sale_ambiguous'
export type MatchCandidateDecision = 'pending' | 'same_vehicle' | 'different_vehicles'
export type SaleStatus = 'completed' | 'cancelled'
export type SaleOrigin = 'app' | 'migration'
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
        // status is intentionally NOT updatable through the normal Update shape —
        // the DB trigger vehicles_guard_sold_transition rejects a direct
        // transition to 'sold' regardless, but the app's own edit form should
        // never even offer it (see VehicleFormPage).
        Update: Partial<Omit<Database['public']['Tables']['vehicles']['Insert'], 'status'>>
        Relationships: []
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
          // Added Onda 3 — parsed/normalized fields (see 20260829000900_*)
          plate_normalized: string | null
          plate_format: OccurrencePlateFormat | null
          sale_date_parsed: string | null
          value_parsed: number | null
          parsed_brand: string | null
          parsed_model: string | null
          parsed_year: number | null
          observed_status_basis: string | null
          warnings: string[]
          sale_classification: SaleClassification | null
          // Added Onda 3 — human review overlay (see 20260829001000_*)
          review_decision: ReviewDecision
          review_reason: string | null
          confirmed_plate: string | null
          confirmed_brand: string | null
          confirmed_model: string | null
          confirmed_trim: string | null
          confirmed_year: number | null
          confirmed_value: number | null
        }
        // Insert is only ever performed by the migration pipeline / load-ledger
        // script (service_role) — never from the frontend (no INSERT policy for
        // `authenticated`). Included here for completeness/type-safety of that script.
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
          plate_normalized?: string | null
          plate_format?: OccurrencePlateFormat | null
          sale_date_parsed?: string | null
          value_parsed?: number | null
          parsed_brand?: string | null
          parsed_model?: string | null
          parsed_year?: number | null
          observed_status_basis?: string | null
          warnings?: string[]
          sale_classification?: SaleClassification | null
        }
        // The app (authenticated) may only ever touch the review overlay —
        // the DB trigger vehicle_occurrences_protect_raw enforces this even if
        // a caller tried to send raw/parsed fields too, but this type keeps
        // the app's own code from attempting it in the first place.
        Update: {
          vehicle_id?: string | null
          match_status?: OccurrenceMatchStatus
          match_score?: number | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          review_decision?: ReviewDecision
          review_reason?: string | null
          confirmed_plate?: string | null
          confirmed_brand?: string | null
          confirmed_model?: string | null
          confirmed_trim?: string | null
          confirmed_year?: number | null
          confirmed_value?: number | null
        }
        Relationships: []
      }
      vehicle_match_candidates: {
        Row: {
          id: string
          occurrence_id: string
          candidate_vehicle_id: string
          score: number
          reason: string
          created_at: string
          decision: MatchCandidateDecision
          decided_by: string | null
          decided_at: string | null
        }
        // Written only by the migration pipeline — see load-ledger.ts's note on
        // why match_candidates.json is NOT loaded into this table yet (Onda 3).
        Insert: {
          id?: string
          occurrence_id: string
          candidate_vehicle_id: string
          score: number
          reason: string
          created_at?: string
        }
        Update: {
          decision?: MatchCandidateDecision
          decided_by?: string | null
          decided_at?: string | null
        }
        Relationships: []
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
        Relationships: []
      }
      sales: {
        Row: {
          id: string
          vehicle_id: string | null
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
          origin: SaleOrigin
          created_at: string
          updated_at: string
        }
        // No RLS insert/update policy for `authenticated` — rows are written
        // only via the register_sale/cancel_sale RPCs (origin='app') or the
        // legacy import script running as service_role (origin='migration') —
        // see ARCHITECTURE.md. Shaped for completeness/type-safety of that
        // server-side code, not as an invitation to call .insert()/.update()
        // from the app.
        Insert: {
          id?: string
          vehicle_id?: string | null
          seller_id?: string | null
          sale_date: string
          customer_name?: string | null
          customer_phone?: string | null
          sale_value: number
          deal_type?: string | null
          trade_in_description?: string | null
          channel?: string | null
          commission_amount?: number | null
          commission_percentage?: number | null
          commission_rule_snapshot?: Json | null
          observations?: string | null
          status?: SaleStatus
          cancelled_reason?: string | null
          cancelled_at?: string | null
          source_occurrence_id?: string | null
          created_by?: string | null
          origin?: SaleOrigin
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['sales']['Insert']>
        Relationships: []
      }
      app_settings: {
        Row: {
          id: true
          default_commission_pct: number | null
          store_name: string
          cnpj: string | null
          updated_at: string
        }
        // Singleton row, seeded once by migration — never inserted from the app.
        Insert: {
          id?: true
          default_commission_pct?: number | null
          store_name?: string
          cnpj?: string | null
          updated_at?: string
        }
        Update: {
          default_commission_pct?: number | null
          store_name?: string
          cnpj?: string | null
          updated_at?: string
        }
        Relationships: []
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
        // No RLS insert policy for `authenticated` — written only by
        // RPCs/triggers. Shaped for completeness, not an invitation to write here.
        Insert: {
          id?: string
          entity_type: AuditEntityType
          entity_id: string
          action: string
          actor?: string | null
          diff?: Json | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['audit_log']['Insert']>
        Relationships: []
      }
      migration_import_batches: {
        Row: {
          id: string
          label: string
          created_by: string | null
          created_at: string
          occurrence_count: number
          vehicle_ids: string[]
        }
        // In practice only ever produced by the create_initial_inventory RPC,
        // never inserted directly by app code — kept here for completeness.
        Insert: {
          id?: string
          label: string
          created_by?: string | null
          created_at?: string
          occurrence_count: number
          vehicle_ids?: string[]
        }
        Update: Partial<Database['public']['Tables']['migration_import_batches']['Insert']>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      create_initial_inventory: {
        Args: { p_batch_label: string }
        Returns: Array<{ created_vehicle_id: string; source_sheet: string; source_row: number }>
      }
      register_sale: {
        Args: {
          p_vehicle_id: string
          p_sale_date: string
          p_sale_value: number
          p_customer_name?: string | null
          p_customer_phone?: string | null
          p_seller_id?: string | null
          p_deal_type?: string | null
          p_trade_in_description?: string | null
          p_channel?: string | null
          p_commission_amount?: number | null
          p_commission_percentage?: number | null
          p_observations?: string | null
        }
        Returns: Database['public']['Tables']['sales']['Row']
      }
      cancel_sale: {
        Args: { p_sale_id: string; p_reason: string }
        Returns: Database['public']['Tables']['sales']['Row']
      }
      create_vehicle: {
        Args: {
          p_brand: string
          p_model: string
          p_trim?: string | null
          p_model_year?: number | null
          p_manufacture_year?: number | null
          p_plate?: string | null
          p_plate_format?: string | null
          p_asking_price?: number | null
          p_entry_date?: string | null
          p_observations?: string | null
        }
        Returns: Database['public']['Tables']['vehicles']['Row']
      }
      update_vehicle: {
        Args: {
          p_id: string
          p_brand: string
          p_model: string
          p_trim?: string | null
          p_model_year?: number | null
          p_manufacture_year?: number | null
          p_plate?: string | null
          p_plate_format?: string | null
          p_asking_price?: number | null
          p_entry_date?: string | null
          p_observations?: string | null
        }
        Returns: Database['public']['Tables']['vehicles']['Row']
      }
    }
  }
}
