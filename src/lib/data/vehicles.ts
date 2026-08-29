import { callApi } from '@/lib/api'
import type { Vehicle, VehicleStatus } from '@/types/api'

export type { Vehicle }

/**
 * Real Estoque list. No demo fallback here (unlike the Review Center):
 * showing fabricated *inventory* — as opposed to a labeled preview of the
 * review workflow — would misrepresent what's actually in the shop, so an
 * unreachable backend is surfaced as an explicit error state instead.
 */
export async function fetchVehicles(status: VehicleStatus | 'all' = 'available'): Promise<Vehicle[]> {
  return callApi<Vehicle[]>('fetchVehicles', { status })
}

export async function fetchVehicle(id: string): Promise<Vehicle | null> {
  return callApi<Vehicle | null>('fetchVehicle', { id })
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
 * from migrated vehicles. Goes through the createVehicle action (não um
 * append direto na planilha) para sempre gerar um audit_log — ver
 * gas/Logic.js.
 */
export async function createVehicle(input: VehicleFormInput): Promise<Vehicle> {
  return callApi<Vehicle>('createVehicle', input)
}

/**
 * Edição (Onda 3 §12). `status` não é parâmetro de updateVehicle — a ação
 * estruturalmente não consegue mudar o status do veículo.
 */
export async function updateVehicle(id: string, input: VehicleFormInput): Promise<Vehicle> {
  return callApi<Vehicle>('updateVehicle', { id, ...input })
}

export function searchVehicles(vehicles: Vehicle[], query: string): Vehicle[] {
  const q = query.trim().toLowerCase()
  if (!q) return vehicles
  return vehicles.filter((v) =>
    [v.brand, v.model, v.trim, v.plate].some((field) => field?.toLowerCase().includes(q)),
  )
}
