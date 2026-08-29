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

/** Cadastro manual (Onda 3 §11) — always origin='manual', distinguishable from migrated vehicles. */
export async function createVehicle(input: VehicleFormInput): Promise<Vehicle> {
  const { data, error } = await supabase
    .from('vehicles')
    .insert({ ...input, origin: 'manual', status: 'available' })
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Edição (Onda 3 §12). `status` is not part of VehicleFormInput and the DB
 * trigger vehicles_guard_sold_transition rejects a direct move to 'sold'
 * regardless — this function structurally cannot make a vehicle sold.
 */
export async function updateVehicle(id: string, input: Partial<VehicleFormInput>): Promise<Vehicle> {
  const { data, error } = await supabase.from('vehicles').update(input).eq('id', id).select().single()
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
