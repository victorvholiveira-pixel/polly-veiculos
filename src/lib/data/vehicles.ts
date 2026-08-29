import { supabase } from '@/lib/supabase'
import type { Database, VehicleStatus } from '@/types/database'
import { withTimeout } from './withTimeout'

export type Vehicle = Database['public']['Tables']['vehicles']['Row']

export interface VehicleListResult {
  items: Vehicle[]
  source: 'supabase' | 'demo'
}

/**
 * Real Estoque list. No demo fallback here (unlike the Review Center):
 * showing fabricated *inventory* — as opposed to a labeled preview of the
 * review workflow — would misrepresent what's actually in the shop, so an
 * unreachable backend is surfaced as an explicit error state instead.
 */
export async function fetchVehicles(status: VehicleStatus | 'all' = 'available'): Promise<Vehicle[]> {
  let query = supabase.from('vehicles').select('*').order('created_at', { ascending: false })
  if (status !== 'all') query = query.eq('status', status)
  const { data, error } = await withTimeout(query)
  if (error) throw error
  return data
}

export async function fetchVehicle(id: string): Promise<Vehicle | null> {
  const { data, error } = await withTimeout(supabase.from('vehicles').select('*').eq('id', id).maybeSingle())
  if (error) throw error
  return data
}

export interface VehicleFormInput {
  brand: string
  model: string
  trim?: string | null
  model_year?: number | null
  manufacture_year?: number | null
  plate?: string | null
  asking_price?: number | null
  observations?: string | null
}

/**
 * Cadastro manual (Onda 3 §11) — always origin='manual', distinguishable
 * from migrated vehicles. Goes through the create_vehicle RPC (Onda 6)
 * instead of a direct insert so the creation is always audit-logged —
 * audit_log.sql has documented "criação/edição de veículo" as something
 * that should be audited since Onda 1, but nothing wrote it there until now.
 */
export async function createVehicle(input: VehicleFormInput): Promise<Vehicle> {
  const { data, error } = await supabase.rpc('create_vehicle', {
    p_brand: input.brand,
    p_model: input.model,
    p_trim: input.trim ?? null,
    p_model_year: input.model_year ?? null,
    p_manufacture_year: input.manufacture_year ?? null,
    p_plate: input.plate ?? null,
    p_asking_price: input.asking_price ?? null,
    p_observations: input.observations ?? null,
  })
  if (error) throw error
  return data
}

/**
 * Edição (Onda 3 §12). `status` has no corresponding parameter on
 * update_vehicle — the RPC structurally cannot change it, on top of the DB
 * trigger vehicles_guard_sold_transition already rejecting a direct move to
 * 'sold' regardless of caller. Also audit-logged (before/after), like create.
 */
export async function updateVehicle(id: string, input: VehicleFormInput): Promise<Vehicle> {
  const { data, error } = await supabase.rpc('update_vehicle', {
    p_id: id,
    p_brand: input.brand,
    p_model: input.model,
    p_trim: input.trim ?? null,
    p_model_year: input.model_year ?? null,
    p_manufacture_year: input.manufacture_year ?? null,
    p_plate: input.plate ?? null,
    p_asking_price: input.asking_price ?? null,
    p_observations: input.observations ?? null,
  })
  if (error) throw error
  return data
}

export function searchVehicles(vehicles: Vehicle[], query: string): Vehicle[] {
  const q = query.trim().toLowerCase()
  if (!q) return vehicles
  return vehicles.filter((v) =>
    [v.brand, v.model, v.trim, v.plate].some((field) => field?.toLowerCase().includes(q)),
  )
}
