import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import { withTimeout } from './withTimeout'

export type Sale = Database['public']['Tables']['sales']['Row']
export type Seller = Database['public']['Tables']['sellers']['Row']

export interface SaleWithDetails extends Sale {
  vehicle: { brand: string; model: string; trim: string | null; plate: string | null } | null
  sellerName: string | null
}

/**
 * Real operational sales history. `sales` has no FK relationship declared in
 * the hand-written Database type (see database.ts's header note on
 * `Relationships: []`), so vehicle/seller details are fetched separately and
 * merged client-side rather than relying on postgrest embedding.
 *
 * A sale is either origin='app' (real vehicle_id) or origin='migration' (a
 * legacy sale imported from the spreadsheet, no live vehicle — see
 * ARCHITECTURE.md, "Onda 10"). For the second kind, vehicle/plate details
 * come from vehicle_occurrences via source_occurrence_id instead — never
 * a fabricated vehicle just to have something to join against.
 */
export async function fetchSales(): Promise<SaleWithDetails[]> {
  const { data: sales, error } = await withTimeout(
    supabase.from('sales').select('*').order('sale_date', { ascending: false }),
  )
  if (error) throw error
  if (sales.length === 0) return []

  const vehicleIds = [...new Set(sales.filter((s) => s.vehicle_id !== null).map((s) => s.vehicle_id as string))]
  const occurrenceIds = [...new Set(sales.filter((s) => s.vehicle_id === null && s.source_occurrence_id !== null).map((s) => s.source_occurrence_id as string))]
  const sellerIds = [...new Set(sales.map((s) => s.seller_id).filter((id): id is string => id !== null))]

  const [{ data: vehicles, error: vehiclesError }, { data: occurrences, error: occurrencesError }, { data: sellers, error: sellersError }] = await Promise.all([
    vehicleIds.length > 0
      ? withTimeout(supabase.from('vehicles').select('id, brand, model, trim, plate').in('id', vehicleIds))
      : Promise.resolve({ data: [], error: null }),
    occurrenceIds.length > 0
      ? withTimeout(
          supabase
            .from('vehicle_occurrences')
            .select('id, confirmed_brand, confirmed_model, parsed_brand, parsed_model, model_raw, confirmed_plate, plate_normalized')
            .in('id', occurrenceIds),
        )
      : Promise.resolve({ data: [], error: null }),
    sellerIds.length > 0
      ? withTimeout(supabase.from('sellers').select('id, name').in('id', sellerIds))
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }>, error: null }),
  ])
  if (vehiclesError) throw vehiclesError
  if (occurrencesError) throw occurrencesError
  if (sellersError) throw sellersError

  const vehicleMap = new Map(vehicles.map((v) => [v.id, v]))
  // create_initial_inventory maps the occurrence's model_raw to vehicles.trim
  // (a "version" string, e.g. "LXR 2.0") — mirrored here for the same shape.
  const occurrenceMap = new Map(
    occurrences.map((o) => [
      o.id,
      {
        brand: o.confirmed_brand ?? o.parsed_brand ?? 'Não identificado',
        model: o.confirmed_model ?? o.parsed_model ?? 'Não identificado',
        trim: o.model_raw,
        plate: o.confirmed_plate ?? o.plate_normalized,
      },
    ]),
  )
  const sellerMap = new Map((sellers ?? []).map((s) => [s.id, s.name]))

  return sales.map((s) => ({
    ...s,
    vehicle: s.vehicle_id
      ? (vehicleMap.get(s.vehicle_id) ?? null)
      : s.source_occurrence_id
        ? (occurrenceMap.get(s.source_occurrence_id) ?? null)
        : null,
    sellerName: s.seller_id ? (sellerMap.get(s.seller_id) ?? null) : null,
  }))
}

export async function fetchActiveSellers(): Promise<Seller[]> {
  const { data, error } = await withTimeout(
    supabase.from('sellers').select('*').eq('active', true).order('name', { ascending: true }),
  )
  if (error) throw error
  return data
}

/** Creates a seller on the fly from the sale form's "novo vendedor" field. */
export async function createSeller(name: string): Promise<Seller> {
  const { data, error } = await supabase.from('sellers').insert({ name }).select().single()
  if (error) throw error
  return data
}

export interface RegisterSaleInput {
  vehicleId: string
  saleDate: string
  saleValue: number
  customerName?: string
  customerPhone?: string
  sellerId?: string
  dealType?: string
  tradeInDescription?: string
  channel?: string
  commissionAmount?: number
  commissionPercentage?: number
  observations?: string
}

/** Registrar venda (Onda 4 §4) — the only way `vehicles.status` becomes 'sold'. */
export async function registerSale(input: RegisterSaleInput): Promise<Sale> {
  const { data, error } = await supabase.rpc('register_sale', {
    p_vehicle_id: input.vehicleId,
    p_sale_date: input.saleDate,
    p_sale_value: input.saleValue,
    p_customer_name: input.customerName ?? null,
    p_customer_phone: input.customerPhone ?? null,
    p_seller_id: input.sellerId ?? null,
    p_deal_type: input.dealType ?? null,
    p_trade_in_description: input.tradeInDescription ?? null,
    p_channel: input.channel ?? null,
    p_commission_amount: input.commissionAmount ?? null,
    p_commission_percentage: input.commissionPercentage ?? null,
    p_observations: input.observations ?? null,
  })
  if (error) throw error
  return data
}

/** Cancelamento de venda (Onda 4 §5) — soft cancel, reverte o veículo para disponível. */
export async function cancelSale(saleId: string, reason: string): Promise<Sale> {
  const { data, error } = await supabase.rpc('cancel_sale', { p_sale_id: saleId, p_reason: reason })
  if (error) throw error
  return data
}
