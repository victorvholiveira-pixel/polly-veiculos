import { describe, expect, it } from 'vitest'
import {
  activeStock,
  computeStockSummary,
  daysInStockFor,
  filterVehiclesByChip,
  sortVehicles,
} from '../stockSummary'
import type { Vehicle } from '../vehicles'

function vehicle(overrides: Partial<Vehicle>): Vehicle {
  return {
    id: 'id',
    brand: 'Fiat',
    model: 'Uno',
    trim: null,
    model_year: 2015,
    manufacture_year: null,
    plate: 'ABC1234',
    plate_format: 'old',
    asking_price: 25900,
    entry_date: null,
    origin: 'manual',
    status: 'available',
    observations: null,
    founding_occurrence_id: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

const NOW = new Date('2026-08-29T12:00:00Z')

describe('activeStock', () => {
  it('excludes sold vehicles — a sale belongs to Histórico, not Estoque', () => {
    const vehicles = [
      vehicle({ id: '1', status: 'available' }),
      vehicle({ id: '2', status: 'reserved' }),
      vehicle({ id: '3', status: 'sold' }),
    ]
    expect(activeStock(vehicles).map((v) => v.id)).toEqual(['1', '2'])
  })
})

describe('computeStockSummary', () => {
  it('returns zeroed/null values for an empty stock without dividing by zero', () => {
    const summary = computeStockSummary([], NOW)
    expect(summary).toEqual({
      count: 0,
      totalValue: 0,
      avgTicket: null,
      avgDays: null,
      over30: 0,
      over60: 0,
      knownDatesCount: 0,
      unknownDatesCount: 0,
    })
  })

  it('sums totalValue and avgTicket only over active (non-sold) vehicles', () => {
    const vehicles = [
      vehicle({ id: '1', status: 'available', asking_price: 100000 }),
      vehicle({ id: '2', status: 'reserved', asking_price: 50000 }),
      vehicle({ id: '3', status: 'sold', asking_price: 999999 }),
    ]
    const summary = computeStockSummary(vehicles, NOW)
    expect(summary.count).toBe(2)
    expect(summary.totalValue).toBe(150000)
    expect(summary.avgTicket).toBe(75000)
  })

  it('treats a null asking_price as 0 for totals, without crashing', () => {
    const vehicles = [vehicle({ id: '1', asking_price: null }), vehicle({ id: '2', asking_price: 40000 })]
    const summary = computeStockSummary(vehicles, NOW)
    expect(summary.totalValue).toBe(40000)
    expect(summary.avgTicket).toBe(20000)
  })

  it('computes over30/over60/avgDays only from vehicles with a real entry_date', () => {
    const vehicles = [
      vehicle({ id: '1', entry_date: '2026-08-27' }), // 2 days
      vehicle({ id: '2', entry_date: '2026-07-20' }), // 40 days -> over30
      vehicle({ id: '3', entry_date: '2026-05-01' }), // 120 days -> over30 and over60
      vehicle({ id: '4', entry_date: null }), // unknown — never guessed
    ]
    const summary = computeStockSummary(vehicles, NOW)
    expect(summary.over30).toBe(2)
    expect(summary.over60).toBe(1)
    expect(summary.knownDatesCount).toBe(3)
    expect(summary.unknownDatesCount).toBe(1)
    expect(summary.avgDays).not.toBeNull()
  })
})

describe('daysInStockFor', () => {
  it('is null when there is no entry_date — never a fabricated age', () => {
    expect(daysInStockFor({ entry_date: null }, NOW)).toBeNull()
  })

  it('computes whole days since entry_date', () => {
    expect(daysInStockFor({ entry_date: '2026-08-19' }, NOW)).toBe(10)
  })
})

describe('filterVehiclesByChip', () => {
  const vehicles = [
    vehicle({ id: '1', status: 'available', entry_date: '2026-08-27' }), // 2 days
    vehicle({ id: '2', status: 'reserved', entry_date: '2026-07-20' }), // 40 days
    vehicle({ id: '3', status: 'available', entry_date: '2026-05-01' }), // 120 days
    vehicle({ id: '4', status: 'sold', entry_date: '2020-01-01' }),
    vehicle({ id: '5', status: 'available', entry_date: null }),
  ]

  it('"all" returns every active (non-sold) vehicle', () => {
    expect(filterVehiclesByChip(vehicles, 'all', NOW).map((v) => v.id)).toEqual(['1', '2', '3', '5'])
  })

  it('"available" / "reserved" filter by status, excluding sold', () => {
    expect(filterVehiclesByChip(vehicles, 'available', NOW).map((v) => v.id)).toEqual(['1', '3', '5'])
    expect(filterVehiclesByChip(vehicles, 'reserved', NOW).map((v) => v.id)).toEqual(['2'])
  })

  it('"over30"/"over60" never include a vehicle with unknown entry_date', () => {
    expect(filterVehiclesByChip(vehicles, 'over30', NOW).map((v) => v.id)).toEqual(['2', '3'])
    expect(filterVehiclesByChip(vehicles, 'over60', NOW).map((v) => v.id)).toEqual(['3'])
  })
})

describe('sortVehicles', () => {
  const vehicles = [
    vehicle({ id: 'A', brand: 'Toyota', model: 'Corolla', asking_price: 90000, entry_date: '2026-08-19' }), // 10 days
    vehicle({ id: 'B', brand: 'Honda', model: 'Civic', asking_price: 120000, entry_date: '2026-07-20' }), // 40 days
    vehicle({ id: 'C', brand: 'Fiat', model: 'Uno', asking_price: 40000, entry_date: null }),
  ]

  it('"newest" orders by fewest days in stock first, unknown dates always last', () => {
    expect(sortVehicles(vehicles, 'newest', NOW).map((v) => v.id)).toEqual(['A', 'B', 'C'])
  })

  it('"oldest" orders by most days in stock first, unknown dates always last', () => {
    expect(sortVehicles(vehicles, 'oldest', NOW).map((v) => v.id)).toEqual(['B', 'A', 'C'])
  })

  it('"price_desc"/"price_asc" order by asking_price', () => {
    expect(sortVehicles(vehicles, 'price_desc', NOW).map((v) => v.id)).toEqual(['B', 'A', 'C'])
    expect(sortVehicles(vehicles, 'price_asc', NOW).map((v) => v.id)).toEqual(['C', 'A', 'B'])
  })

  it('a null asking_price always sorts last, in both price directions', () => {
    const withNull = [...vehicles, vehicle({ id: 'D', asking_price: null })]
    expect(sortVehicles(withNull, 'price_desc', NOW).at(-1)?.id).toBe('D')
    expect(sortVehicles(withNull, 'price_asc', NOW).at(-1)?.id).toBe('D')
  })

  it('"brand_model" orders alphabetically in pt-BR collation', () => {
    expect(sortVehicles(vehicles, 'brand_model', NOW).map((v) => v.id)).toEqual(['C', 'B', 'A'])
  })

  it('never mutates the input array', () => {
    const copy = [...vehicles]
    sortVehicles(vehicles, 'price_desc', NOW)
    expect(vehicles).toEqual(copy)
  })
})
