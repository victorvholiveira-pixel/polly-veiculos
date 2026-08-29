import { computeAging, daysBetween } from './dashboard'
import type { Vehicle } from './vehicles'

/** Estoque = tudo que ainda não foi vendido. Um veículo vendido pertence ao Histórico, não ao Estoque. */
export function activeStock(vehicles: Vehicle[]): Vehicle[] {
  return vehicles.filter((v) => v.status !== 'sold')
}

export interface StockSummary {
  count: number
  totalValue: number
  avgTicket: number | null
  avgDays: number | null
  over30: number
  over60: number
  knownDatesCount: number
  unknownDatesCount: number
}

/** Mesma definição de "estoque" e de envelhecimento que a Home usa (computeAging) — nunca duas contas divergentes para o mesmo número. */
export function computeStockSummary(vehicles: Vehicle[], now: Date): StockSummary {
  const active = activeStock(vehicles)
  const totalValue = active.reduce((sum, v) => sum + (v.asking_price ?? 0), 0)
  const aging = computeAging(active, now)
  return {
    count: active.length,
    totalValue,
    avgTicket: active.length > 0 ? totalValue / active.length : null,
    avgDays: aging.avgDays,
    over30: aging.over30,
    over60: aging.over60,
    knownDatesCount: aging.knownCount,
    unknownDatesCount: aging.unknownCount,
  }
}

/** null quando não há entry_date — nunca uma idade inventada. */
export function daysInStockFor(v: { entry_date: string | null }, now: Date): number | null {
  return v.entry_date ? daysBetween(v.entry_date, now) : null
}

export type StockFilterKey = 'all' | 'available' | 'reserved' | 'over30' | 'over60'

export function filterVehiclesByChip(vehicles: Vehicle[], key: StockFilterKey, now: Date): Vehicle[] {
  const active = activeStock(vehicles)
  switch (key) {
    case 'all':
      return active
    case 'available':
      return active.filter((v) => v.status === 'available')
    case 'reserved':
      return active.filter((v) => v.status === 'reserved')
    case 'over30':
      return active.filter((v) => (daysInStockFor(v, now) ?? -1) >= 30)
    case 'over60':
      return active.filter((v) => (daysInStockFor(v, now) ?? -1) >= 60)
  }
}

export type StockSortKey = 'newest' | 'oldest' | 'price_desc' | 'price_asc' | 'brand_model'

export const SORT_OPTIONS: Array<{ key: StockSortKey; label: string }> = [
  { key: 'newest', label: 'Mais recentes' },
  { key: 'oldest', label: 'Mais antigos' },
  { key: 'price_desc', label: 'Maior preço' },
  { key: 'price_asc', label: 'Menor preço' },
  { key: 'brand_model', label: 'Marca / modelo' },
]

/** Veículo sem entry_date sempre vai para o fim, nas duas direções de data — nunca ordenado por uma idade que não existe. */
export function sortVehicles(vehicles: Vehicle[], key: StockSortKey, now: Date): Vehicle[] {
  const list = [...vehicles]
  switch (key) {
    case 'newest':
      return list.sort((a, b) => {
        const da = daysInStockFor(a, now)
        const db = daysInStockFor(b, now)
        if (da === null) return db === null ? 0 : 1
        if (db === null) return -1
        return da - db
      })
    case 'oldest':
      return list.sort((a, b) => {
        const da = daysInStockFor(a, now)
        const db = daysInStockFor(b, now)
        if (da === null) return db === null ? 0 : 1
        if (db === null) return -1
        return db - da
      })
    case 'price_desc':
      return list.sort((a, b) => (b.asking_price ?? -Infinity) - (a.asking_price ?? -Infinity))
    case 'price_asc':
      return list.sort((a, b) => (a.asking_price ?? Infinity) - (b.asking_price ?? Infinity))
    case 'brand_model':
      return list.sort((a, b) => `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`, 'pt-BR'))
  }
}
