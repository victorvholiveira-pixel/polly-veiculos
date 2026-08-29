import { describe, expect, it } from 'vitest'
import { buildRecentActivity, buildSalesHistoryView, computeAging, computeHighlights, daysBetween } from '../dashboard'
import type { AuditLogEntry } from '../audit'

describe('daysBetween', () => {
  it('counts whole days between a date-only string and a later local date', () => {
    expect(daysBetween('2026-08-01', new Date('2026-08-31T12:00:00'))).toBe(30)
  })

  it('returns 0 for the same day', () => {
    expect(daysBetween('2026-08-29', new Date('2026-08-29T23:00:00'))).toBe(0)
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
    const vehiclesByKey = new Map([
      ['v:v1', { brand: 'Fiat', model: 'Uno', plate: null, entry_date: '2026-08-01' }],
      ['v:v2', { brand: 'Fiat', model: 'Uno', plate: null, entry_date: '2026-07-01' }],
      ['v:v3', { brand: 'Jeep', model: 'Renegade', plate: null, entry_date: '2026-06-01' }],
    ])
    const sales = [
      { vehicle_id: 'v1', source_occurrence_id: null, sale_date: '2026-08-05', sale_value: 30000 }, // 4 days in stock
      { vehicle_id: 'v2', source_occurrence_id: null, sale_date: '2026-08-10', sale_value: 32000 },
      { vehicle_id: 'v3', source_occurrence_id: null, sale_date: '2026-08-15', sale_value: 95000 }, // biggest sale
    ]
    const result = computeHighlights(sales, vehiclesByKey)
    expect(result.topModel).toEqual({ brand: 'Fiat', model: 'Uno', count: 2 })
    expect(result.biggestSale).toEqual({ vehicleLabel: 'Jeep Renegade', value: 95000, date: '2026-08-15' })
    expect(result.fastestSale?.vehicleLabel).toBe('Fiat Uno')
    expect(result.fastestSale?.days).toBe(4)
  })

  it('resolves a legacy sale (no vehicle_id) through its source_occurrence_id', () => {
    const vehiclesByKey = new Map([['o:occ-1', { brand: 'Renault', model: 'Kwid', plate: null, entry_date: null }]])
    const sales = [{ vehicle_id: null, source_occurrence_id: 'occ-1', sale_date: '2024-03-10', sale_value: 45000 }]
    const result = computeHighlights(sales, vehiclesByKey)
    expect(result.topModel).toEqual({ brand: 'Renault', model: 'Kwid', count: 1 })
    expect(result.biggestSale?.vehicleLabel).toBe('Renault Kwid')
    // a legacy sale never has a known entry_date, so it can never win "fastest sale" — never estimated
    expect(result.fastestSale).toBeNull()
  })

  it('returns all nulls with no sales — never invents a highlight', () => {
    expect(computeHighlights([], new Map())).toEqual({ topModel: null, biggestSale: null, fastestSale: null })
  })

  it('skips fastest-sale candidates with no known entry date instead of guessing', () => {
    const vehiclesByKey = new Map([['v:v1', { brand: 'Fiat', model: 'Uno', plate: null, entry_date: null }]])
    const result = computeHighlights([{ vehicle_id: 'v1', source_occurrence_id: null, sale_date: '2026-08-05', sale_value: 10000 }], vehiclesByKey)
    expect(result.fastestSale).toBeNull()
    expect(result.biggestSale).not.toBeNull() // doesn't need entry_date, still computed
  })

  it('ignores a sale whose recorded entry date is after the sale date instead of showing a negative duration', () => {
    const vehiclesByKey = new Map([['v:v1', { brand: 'Fiat', model: 'Uno', plate: null, entry_date: '2026-09-01' }]])
    const result = computeHighlights([{ vehicle_id: 'v1', source_occurrence_id: null, sale_date: '2026-08-05', sale_value: 10000 }], vehiclesByKey)
    expect(result.fastestSale).toBeNull()
  })
})

describe('buildRecentActivity', () => {
  const vehiclesByKey = new Map([['v:veh-1', { brand: 'Honda', model: 'Civic', plate: null, entry_date: null }]])

  function entry(overrides: Partial<AuditLogEntry>): AuditLogEntry {
    return { id: 'log-1', entity_type: 'vehicle', entity_id: 'veh-1', action: 'vehicle_created', actor: null, diff: null, created_at: '2026-08-20T10:00:00Z', ...overrides }
  }

  it('reads brand/model straight from the diff for a manual creation', () => {
    const [activity] = buildRecentActivity([entry({ diff: { brand: 'Fiat', model: 'Uno' } })], vehiclesByKey)
    expect(activity!.vehicleLabel).toBe('Fiat Uno')
    expect(activity!.actionLabel).toBe('Veículo cadastrado')
  })

  it('reads brand/model from diff.after for an edit', () => {
    const [activity] = buildRecentActivity(
      [entry({ action: 'vehicle_updated', diff: { before: { brand: 'Fiat', model: 'Uno' }, after: { brand: 'Fiat', model: 'Palio' } } })],
      vehiclesByKey,
    )
    expect(activity!.vehicleLabel).toBe('Fiat Palio')
  })

  it('resolves the vehicle by id for a migration import (diff has no brand/model)', () => {
    const [activity] = buildRecentActivity([entry({ action: 'created_from_migration', diff: { source_occurrence_id: 'occ-1' } })], vehiclesByKey)
    expect(activity!.vehicleLabel).toBe('Honda Civic')
  })

  it('resolves the vehicle and amount for a sale, and the reason for a cancellation', () => {
    const [sale] = buildRecentActivity(
      [entry({ entity_type: 'sale', action: 'sale_registered', diff: { vehicle_id: 'veh-1', sale_value: 25900 } })],
      vehiclesByKey,
    )
    expect(sale!.vehicleLabel).toBe('Honda Civic')
    expect(sale!.amount).toBe(25900)

    const [cancelled] = buildRecentActivity(
      [entry({ entity_type: 'sale', action: 'sale_cancelled', diff: { vehicle_id: 'veh-1', reason: 'Comprador desistiu' } })],
      vehiclesByKey,
    )
    expect(cancelled!.note).toBe('Comprador desistiu')
  })

  it('falls back to the raw action string when there is no known label', () => {
    const [activity] = buildRecentActivity([entry({ action: 'algo_novo', diff: null })], vehiclesByKey)
    expect(activity!.actionLabel).toBe('algo_novo')
    expect(activity!.vehicleLabel).toBeNull()
  })
})

describe('buildSalesHistoryView', () => {
  const now = new Date('2026-08-15T00:00:00')

  // Spans 2024-2026 so both single-year and multi-year label/range behavior can be exercised.
  const sales = [
    { sale_date: '2024-01-10', sale_value: 30000, commission_amount: 900 },
    { sale_date: '2024-06-05', sale_value: 40000, commission_amount: null },
    { sale_date: '2025-03-12', sale_value: 50000, commission_amount: 1500 },
    { sale_date: '2026-06-01', sale_value: 60000, commission_amount: 1800 },
    { sale_date: '2026-06-20', sale_value: 20000, commission_amount: null },
    { sale_date: '2026-08-05', sale_value: 90000, commission_amount: 2700 },
  ]

  it('builds exactly N real months for a preset, oldest first, zero-filling months with no sale', () => {
    const view = buildSalesHistoryView(sales, { kind: 'months', months: 6 }, now, '2024-01-10')
    expect(view.months).toHaveLength(6)
    expect(view.months[0]!.month).toBe('2026-03')
    expect(view.months.at(-1)!.month).toBe('2026-08')
    const march = view.months.find((m) => m.month === '2026-03')!
    expect(march.salesCount).toBe(0)
    expect(march.revenue).toBe(0)
    const june = view.months.find((m) => m.month === '2026-06')!
    expect(june.salesCount).toBe(2)
    expect(june.revenue).toBe(80000)
    expect(june.avgTicket).toBe(40000)
  })

  it('uses a plain month label within a single year and a "Mon/YY" label once the range spans years', () => {
    const sixMonths = buildSalesHistoryView(sales, { kind: 'months', months: 6 }, now, '2024-01-10')
    expect(sixMonths.months[0]!.label).toBe('Mar') // Mar-Ago 2026 only, single year
    const allTime = buildSalesHistoryView(sales, { kind: 'all' }, now, '2024-01-10')
    expect(allTime.months[0]!.label).toBe('Jan/24')
  })

  it('never fabricates a start before the first real sale for "all"', () => {
    const view = buildSalesHistoryView(sales, { kind: 'all' }, now, '2024-01-10')
    expect(view.months[0]!.month).toBe('2024-01')
    expect(view.months.at(-1)!.month).toBe('2026-08')
    expect(view.summary.salesCount).toBe(sales.length)
  })

  it('returns an empty view instead of guessing a range when there is no sale at all', () => {
    const view = buildSalesHistoryView([], { kind: 'all' }, now, null)
    expect(view.months).toEqual([])
    expect(view.summary.salesCount).toBe(0)
    expect(view.bestMonth).toBeNull()
  })

  it('selects a single calendar year, capped at "now" for the current year', () => {
    const view2024 = buildSalesHistoryView(sales, { kind: 'year', year: 2024 }, now, '2024-01-10')
    expect(view2024.months).toHaveLength(12)
    expect(view2024.summary.salesCount).toBe(2)
    expect(view2024.summary.revenue).toBe(70000)

    // 2026 is the "current" year relative to `now` (2026-08-15) — must stop at August, not run to December
    const view2026 = buildSalesHistoryView(sales, { kind: 'year', year: 2026 }, now, '2024-01-10')
    expect(view2026.months).toHaveLength(8)
    expect(view2026.months.at(-1)!.month).toBe('2026-08')
  })

  it('finds the best and worst month among months that actually had a sale', () => {
    const view = buildSalesHistoryView(sales, { kind: 'year', year: 2026 }, now, '2024-01-10')
    expect(view.bestMonth?.month).toBe('2026-08') // 90000, the single biggest month
    expect(view.worstMonth?.month).toBe('2026-06') // 80000 < 90000, but still > the untouched months (which are 0 and excluded)
  })

  it('computes monthly averages over every month in range, including zero months', () => {
    const view = buildSalesHistoryView(sales, { kind: 'months', months: 6 }, now, '2024-01-10')
    expect(view.avgMonthlySales).toBeCloseTo(3 / 6)
    expect(view.avgMonthlyRevenue).toBeCloseTo(170000 / 6)
  })

  it('compares against the equivalent previous period only when it has a real base', () => {
    // 2026: 170000 revenue, 3 sales. 2025: 50000 revenue, 1 sale.
    const view = buildSalesHistoryView(sales, { kind: 'year', year: 2026 }, now, '2024-01-10')
    expect(view.comparison.revenueDeltaPct).toBe(Math.round(((170000 - 50000) / 50000) * 100))
    expect(view.comparison.salesDeltaPct).toBe(Math.round(((3 - 1) / 1) * 100))

    // 2024 has no prior year in the dataset at all — no base, no comparison
    const view2024 = buildSalesHistoryView(sales, { kind: 'year', year: 2024 }, now, '2024-01-10')
    expect(view2024.comparison.revenueDeltaPct).toBeNull()
    expect(view2024.comparison.salesDeltaPct).toBeNull()
  })

  it('never computes a comparison for "all" — there is no equivalent previous period', () => {
    const view = buildSalesHistoryView(sales, { kind: 'all' }, now, '2024-01-10')
    expect(view.comparison).toEqual({ salesDeltaPct: null, revenueDeltaPct: null })
  })

  it('tracks known commission separately from unknown, never treating a missing value as zero revenue lost', () => {
    const view = buildSalesHistoryView(sales, { kind: 'year', year: 2026 }, now, '2024-01-10')
    // 3 sales in 2026: two with known commission (1800+2700), one without
    expect(view.summary.commission).toBe(1800 + 2700)
    expect(view.summary.commissionKnownCount).toBe(2)
  })
})
