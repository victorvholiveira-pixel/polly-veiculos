import { describe, expect, it } from 'vitest'
import { buildRecentActivity, computeAging, computeHighlights, computeMonthlyPerformance, daysBetween } from '../dashboard'
import type { AuditLogEntry } from '../audit'

describe('daysBetween', () => {
  it('counts whole days between a date-only string and a later local date', () => {
    expect(daysBetween('2026-08-01', new Date('2026-08-31T12:00:00'))).toBe(30)
  })

  it('returns 0 for the same day', () => {
    expect(daysBetween('2026-08-29', new Date('2026-08-29T23:00:00'))).toBe(0)
  })
})

describe('computeMonthlyPerformance', () => {
  it('builds one bucket per month, oldest first, summing count and revenue', () => {
    const now = new Date('2026-08-15T00:00:00')
    const sales = [
      { sale_date: '2026-08-05', sale_value: 10000 },
      { sale_date: '2026-08-20', sale_value: 20000 },
      { sale_date: '2026-06-10', sale_value: 5000 },
      { sale_date: '2025-12-10', sale_value: 999999 }, // outside the 6-month window, must be excluded by the caller's query — not filtered here
    ]
    const result = computeMonthlyPerformance(sales, now, 6)
    expect(result).toHaveLength(6)
    expect(result[0]!.label).toBe('Mar')
    expect(result.at(-1)!.label).toBe('Ago')
    expect(result.at(-1)!.salesCount).toBe(2)
    expect(result.at(-1)!.revenue).toBe(30000)
    const june = result.find((m) => m.month === '2026-06')!
    expect(june.salesCount).toBe(1)
    expect(june.revenue).toBe(5000)
  })

  it('returns all-zero buckets when there are no sales', () => {
    const result = computeMonthlyPerformance([], new Date('2026-08-15T00:00:00'), 6)
    expect(result.every((m) => m.salesCount === 0 && m.revenue === 0)).toBe(true)
  })
})

describe('computeAging', () => {
  const now = new Date('2026-08-29T00:00:00')

  it('sorts oldest first and buckets +30/+60 correctly', () => {
    const result = computeAging(
      [
        { id: 'a', brand: 'Fiat', model: 'Uno', plate: 'AAA1111', entry_date: '2026-08-20' }, // 9 days
        { id: 'b', brand: 'Honda', model: 'Civic', plate: 'BBB2222', entry_date: '2026-07-25' }, // 35 days
        { id: 'c', brand: 'Ford', model: 'Ka', plate: 'CCC3333', entry_date: '2026-06-01' }, // 89 days
      ],
      now,
    )
    expect(result.vehicles.map((v) => v.id)).toEqual(['c', 'b', 'a'])
    expect(result.over30).toBe(2)
    expect(result.over60).toBe(1)
    expect(result.avgDays).toBe(Math.round((9 + 35 + 89) / 3))
  })

  it('never fabricates a date — excludes vehicles with no entry_date and reports them separately', () => {
    const result = computeAging(
      [
        { id: 'a', brand: 'Fiat', model: 'Uno', plate: null, entry_date: null },
        { id: 'b', brand: 'Honda', model: 'Civic', plate: null, entry_date: '2026-08-01' },
      ],
      now,
    )
    expect(result.vehicles).toHaveLength(1)
    expect(result.knownCount).toBe(1)
    expect(result.unknownCount).toBe(1)
  })

  it('reports null averages/empty list when nothing has a known entry date', () => {
    const result = computeAging([{ id: 'a', brand: 'Fiat', model: 'Uno', plate: null, entry_date: null }], now)
    expect(result.vehicles).toEqual([])
    expect(result.avgDays).toBeNull()
    expect(result.over30).toBe(0)
  })
})

describe('computeHighlights', () => {
  it('finds the top-selling model, the biggest sale, and the fastest sale', () => {
    const vehiclesById = new Map([
      ['v1', { brand: 'Fiat', model: 'Uno', plate: null, entry_date: '2026-08-01' }],
      ['v2', { brand: 'Fiat', model: 'Uno', plate: null, entry_date: '2026-07-01' }],
      ['v3', { brand: 'Jeep', model: 'Renegade', plate: null, entry_date: '2026-06-01' }],
    ])
    const sales = [
      { vehicle_id: 'v1', sale_date: '2026-08-05', sale_value: 30000 }, // 4 days in stock
      { vehicle_id: 'v2', sale_date: '2026-08-10', sale_value: 32000 },
      { vehicle_id: 'v3', sale_date: '2026-08-15', sale_value: 95000 }, // biggest sale
    ]
    const result = computeHighlights(sales, vehiclesById)
    expect(result.topModel).toEqual({ brand: 'Fiat', model: 'Uno', count: 2 })
    expect(result.biggestSale).toEqual({ vehicleLabel: 'Jeep Renegade', value: 95000, date: '2026-08-15' })
    expect(result.fastestSale?.vehicleLabel).toBe('Fiat Uno')
    expect(result.fastestSale?.days).toBe(4)
  })

  it('returns all nulls with no sales — never invents a highlight', () => {
    expect(computeHighlights([], new Map())).toEqual({ topModel: null, biggestSale: null, fastestSale: null })
  })

  it('skips fastest-sale candidates with no known entry date instead of guessing', () => {
    const vehiclesById = new Map([['v1', { brand: 'Fiat', model: 'Uno', plate: null, entry_date: null }]])
    const result = computeHighlights([{ vehicle_id: 'v1', sale_date: '2026-08-05', sale_value: 10000 }], vehiclesById)
    expect(result.fastestSale).toBeNull()
    expect(result.biggestSale).not.toBeNull() // doesn't need entry_date, still computed
  })

  it('ignores a sale whose recorded entry date is after the sale date instead of showing a negative duration', () => {
    const vehiclesById = new Map([['v1', { brand: 'Fiat', model: 'Uno', plate: null, entry_date: '2026-09-01' }]])
    const result = computeHighlights([{ vehicle_id: 'v1', sale_date: '2026-08-05', sale_value: 10000 }], vehiclesById)
    expect(result.fastestSale).toBeNull()
  })
})

describe('buildRecentActivity', () => {
  const vehiclesById = new Map([['veh-1', { brand: 'Honda', model: 'Civic', plate: null, entry_date: null }]])

  function entry(overrides: Partial<AuditLogEntry>): AuditLogEntry {
    return { id: 'log-1', entity_type: 'vehicle', entity_id: 'veh-1', action: 'vehicle_created', actor: null, diff: null, created_at: '2026-08-20T10:00:00Z', ...overrides }
  }

  it('reads brand/model straight from the diff for a manual creation', () => {
    const [activity] = buildRecentActivity([entry({ diff: { brand: 'Fiat', model: 'Uno' } })], vehiclesById)
    expect(activity!.vehicleLabel).toBe('Fiat Uno')
    expect(activity!.actionLabel).toBe('Veículo cadastrado')
  })

  it('reads brand/model from diff.after for an edit', () => {
    const [activity] = buildRecentActivity(
      [entry({ action: 'vehicle_updated', diff: { before: { brand: 'Fiat', model: 'Uno' }, after: { brand: 'Fiat', model: 'Palio' } } })],
      vehiclesById,
    )
    expect(activity!.vehicleLabel).toBe('Fiat Palio')
  })

  it('resolves the vehicle by id for a migration import (diff has no brand/model)', () => {
    const [activity] = buildRecentActivity([entry({ action: 'created_from_migration', diff: { source_occurrence_id: 'occ-1' } })], vehiclesById)
    expect(activity!.vehicleLabel).toBe('Honda Civic')
  })

  it('resolves the vehicle and amount for a sale, and the reason for a cancellation', () => {
    const [sale] = buildRecentActivity(
      [entry({ entity_type: 'sale', action: 'sale_registered', diff: { vehicle_id: 'veh-1', sale_value: 25900 } })],
      vehiclesById,
    )
    expect(sale!.vehicleLabel).toBe('Honda Civic')
    expect(sale!.amount).toBe(25900)

    const [cancelled] = buildRecentActivity(
      [entry({ entity_type: 'sale', action: 'sale_cancelled', diff: { vehicle_id: 'veh-1', reason: 'Comprador desistiu' } })],
      vehiclesById,
    )
    expect(cancelled!.note).toBe('Comprador desistiu')
  })

  it('falls back to the raw action string when there is no known label', () => {
    const [activity] = buildRecentActivity([entry({ action: 'algo_novo', diff: null })], vehiclesById)
    expect(activity!.actionLabel).toBe('algo_novo')
    expect(activity!.vehicleLabel).toBeNull()
  })
})
