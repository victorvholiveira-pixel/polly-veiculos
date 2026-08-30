import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SOLD_FILTERS,
  availableSoldYears,
  canStepMonthForward,
  completedSales,
  computeSoldSummary,
  countActiveAdvancedFilters,
  currentCalendarMonth,
  deriveSoldFilterOptions,
  filterSoldSales,
  periodLabel,
  sameSoldPeriod,
  sortSoldSales,
  stepCalendarMonth,
  type SoldFilters,
} from '../soldSales'
import type { SaleWithDetails } from '../sales'

function sale(overrides: Partial<SaleWithDetails>): SaleWithDetails {
  return {
    id: 'sale-1',
    vehicle_id: 'v1',
    seller_id: null,
    sale_date: '2026-08-10',
    customer_name: 'Maria Teste',
    customer_phone: null,
    sale_value: 30000,
    deal_type: null,
    trade_in_description: null,
    channel: null,
    commission_amount: 1000,
    commission_percentage: null,
    commission_rule_snapshot: null,
    observations: null,
    status: 'completed',
    cancelled_reason: null,
    cancelled_at: null,
    source_occurrence_id: null,
    created_by: null,
    origin: 'app',
    created_at: '2026-08-10T00:00:00Z',
    updated_at: '2026-08-10T00:00:00Z',
    vehicle: { brand: 'Fiat', model: 'Uno', trim: null, modelYear: 2020, plate: 'ABC1234' },
    sellerName: null,
    ...overrides,
  }
}

function baseFilters(period: SoldFilters['period'], overrides: Partial<SoldFilters> = {}): SoldFilters {
  return { period, query: '', ...DEFAULT_SOLD_FILTERS, ...overrides }
}

describe('completedSales', () => {
  it('keeps only status completed — a cancelled sale is not "sold"', () => {
    const sales = [sale({ id: 's1', status: 'completed' }), sale({ id: 's2', status: 'cancelled' })]
    expect(completedSales(sales).map((s) => s.id)).toEqual(['s1'])
  })
})

describe('currentCalendarMonth / stepCalendarMonth / canStepMonthForward', () => {
  it('reads the current month from "now"', () => {
    expect(currentCalendarMonth(new Date('2026-08-30T12:00:00'))).toEqual({ kind: 'calendarMonth', year: 2026, month: 8 })
  })

  it('steps forward and backward, rolling over year boundaries', () => {
    expect(stepCalendarMonth({ year: 2026, month: 8 }, 1)).toEqual({ year: 2026, month: 9 })
    expect(stepCalendarMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 })
    expect(stepCalendarMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 })
  })

  it('refuses to step into a future month — a sale cannot exist there yet', () => {
    const now = new Date('2026-08-30T12:00:00')
    expect(canStepMonthForward({ year: 2026, month: 7 }, now)).toBe(true)
    expect(canStepMonthForward({ year: 2026, month: 8 }, now)).toBe(false)
    expect(canStepMonthForward({ year: 2025, month: 12 }, now)).toBe(true)
  })
})

describe('periodLabel', () => {
  it('describes each period kind in plain Portuguese', () => {
    expect(periodLabel({ kind: 'calendarMonth', year: 2026, month: 8 })).toBe('Agosto de 2026')
    expect(periodLabel({ kind: 'months', months: 6 })).toBe('Últimos 6 meses')
    expect(periodLabel({ kind: 'year', year: 2025 })).toBe('Ano de 2025')
    expect(periodLabel({ kind: 'all' })).toBe('Todo o período')
  })
})

describe('availableSoldYears', () => {
  it('returns real years present in the data, newest first, no duplicates', () => {
    const sales = [sale({ sale_date: '2025-01-10' }), sale({ sale_date: '2026-08-10' }), sale({ sale_date: '2025-06-01' })]
    expect(availableSoldYears(sales)).toEqual([2026, 2025])
  })
})

describe('filterSoldSales — period', () => {
  const now = new Date('2026-08-30T12:00:00Z')
  const sales = [
    sale({ id: 'this-month', sale_date: '2026-08-05' }),
    sale({ id: 'two-months-ago', sale_date: '2026-06-15' }),
    sale({ id: 'last-year', sale_date: '2025-03-01' }),
  ]

  it('a specific calendar month keeps only sales in that exact month', () => {
    const result = filterSoldSales(sales, baseFilters({ kind: 'calendarMonth', year: 2026, month: 8 }), now)
    expect(result.map((s) => s.id)).toEqual(['this-month'])
  })

  it('a month with zero sales returns an empty (not missing) result — it is still a valid, navigable month', () => {
    const result = filterSoldSales(sales, baseFilters({ kind: 'calendarMonth', year: 2026, month: 5 }), now)
    expect(result).toEqual([])
  })

  it('"3 meses" is a rolling window, not a calendar quarter', () => {
    const result = filterSoldSales(sales, baseFilters({ kind: 'months', months: 3 }), now)
    expect(result.map((s) => s.id).sort()).toEqual(['this-month', 'two-months-ago'])
  })

  it('a specific year keeps only sales in that calendar year', () => {
    const result = filterSoldSales(sales, baseFilters({ kind: 'year', year: 2025 }), now)
    expect(result.map((s) => s.id)).toEqual(['last-year'])
  })

  it('"Tudo" never excludes a sale by date', () => {
    const result = filterSoldSales(sales, baseFilters({ kind: 'all' }), now)
    expect(result).toHaveLength(3)
  })
})

describe('filterSoldSales — seller/channel/origin/commission/vehicleYear/value range/query, combined', () => {
  const now = new Date('2026-08-30T12:00:00Z')
  const all: SoldFilters['period'] = { kind: 'all' }
  const sales = [
    sale({
      id: 'app-joao',
      seller_id: 'sel-1',
      sellerName: 'João',
      channel: 'Indicação',
      origin: 'app',
      commission_amount: 500,
      sale_value: 20000,
      vehicle: { brand: 'Fiat', model: 'Uno', trim: null, modelYear: 2020, plate: 'ABC1234' },
    }),
    sale({
      id: 'migration-ana',
      seller_id: null,
      sellerName: null,
      channel: 'Loja física',
      origin: 'migration',
      commission_amount: null,
      sale_value: 90000,
      vehicle: { brand: 'Honda', model: 'Civic', trim: null, modelYear: 2018, plate: 'DEF5678' },
    }),
  ]

  it('filters by seller', () => {
    expect(filterSoldSales(sales, baseFilters(all, { sellerId: 'sel-1' }), now).map((s) => s.id)).toEqual(['app-joao'])
  })

  it('filters by channel', () => {
    expect(filterSoldSales(sales, baseFilters(all, { channel: 'Loja física' }), now).map((s) => s.id)).toEqual(['migration-ana'])
  })

  it('filters by origin', () => {
    expect(filterSoldSales(sales, baseFilters(all, { origin: 'migration' }), now).map((s) => s.id)).toEqual(['migration-ana'])
  })

  it('filters by commission known/unknown', () => {
    expect(filterSoldSales(sales, baseFilters(all, { commission: 'known' }), now).map((s) => s.id)).toEqual(['app-joao'])
    expect(filterSoldSales(sales, baseFilters(all, { commission: 'unknown' }), now).map((s) => s.id)).toEqual(['migration-ana'])
  })

  it('filters by vehicle model year', () => {
    expect(filterSoldSales(sales, baseFilters(all, { vehicleYear: 2018 }), now).map((s) => s.id)).toEqual(['migration-ana'])
  })

  it('filters by value range', () => {
    expect(filterSoldSales(sales, baseFilters(all, { minValue: 50000 }), now).map((s) => s.id)).toEqual(['migration-ana'])
    expect(filterSoldSales(sales, baseFilters(all, { maxValue: 50000 }), now).map((s) => s.id)).toEqual(['app-joao'])
  })

  it('searches by brand/model/plate/customer', () => {
    expect(filterSoldSales(sales, baseFilters(all, { query: 'civic' }), now).map((s) => s.id)).toEqual(['migration-ana'])
    expect(filterSoldSales(sales, baseFilters(all, { query: 'ABC1234' }), now).map((s) => s.id)).toEqual(['app-joao'])
  })

  it('combines month + seller', () => {
    const month: SoldFilters['period'] = { kind: 'calendarMonth', year: 2026, month: 8 }
    expect(filterSoldSales(sales, baseFilters(month, { sellerId: 'sel-1' }), now).map((s) => s.id)).toEqual(['app-joao'])
    expect(filterSoldSales(sales, baseFilters(month, { sellerId: 'sel-1' }), now).length).toBeGreaterThanOrEqual(0)
  })

  it('combines month + origin', () => {
    const month: SoldFilters['period'] = { kind: 'calendarMonth', year: 2026, month: 8 }
    expect(filterSoldSales(sales, baseFilters(month, { origin: 'migration' }), now).map((s) => s.id)).toEqual(['migration-ana'])
  })

  it('combines search, seller, channel, origin, and period all together', () => {
    const result = filterSoldSales(sales, baseFilters(all, { sellerId: 'sel-1', channel: 'Indicação', origin: 'app', query: 'Fiat' }), now)
    expect(result.map((s) => s.id)).toEqual(['app-joao'])

    const noMatch = filterSoldSales(sales, baseFilters(all, { sellerId: 'sel-1', channel: 'Indicação', origin: 'migration', query: 'Fiat' }), now)
    expect(noMatch).toHaveLength(0)
  })
})

describe('sortSoldSales', () => {
  const sales = [
    sale({ id: 'a', sale_date: '2026-08-01', sale_value: 20000 }),
    sale({ id: 'b', sale_date: '2026-08-15', sale_value: 50000 }),
    sale({ id: 'c', sale_date: '2026-07-01', sale_value: 30000 }),
  ]

  it('newest first by sale_date', () => {
    expect(sortSoldSales(sales, 'newest').map((s) => s.id)).toEqual(['b', 'a', 'c'])
  })
  it('oldest first by sale_date', () => {
    expect(sortSoldSales(sales, 'oldest').map((s) => s.id)).toEqual(['c', 'a', 'b'])
  })
  it('highest value first', () => {
    expect(sortSoldSales(sales, 'value_desc').map((s) => s.id)).toEqual(['b', 'c', 'a'])
  })
  it('lowest value first', () => {
    expect(sortSoldSales(sales, 'value_asc').map((s) => s.id)).toEqual(['a', 'c', 'b'])
  })
})

describe('computeSoldSummary', () => {
  it('never invents a missing commission — sums only known ones and counts the rest separately', () => {
    const sales = [
      sale({ id: 'a', sale_value: 20000, commission_amount: 1000 }),
      sale({ id: 'b', sale_value: 30000, commission_amount: null }),
      sale({ id: 'c', sale_value: 50000, commission_amount: 2500 }),
    ]
    const summary = computeSoldSummary(sales)
    expect(summary.count).toBe(3)
    expect(summary.revenue).toBe(100000)
    expect(summary.avgTicket).toBeCloseTo(33333.33, 1)
    expect(summary.commissionKnown).toBe(3500)
    expect(summary.commissionUnknownCount).toBe(1)
  })

  it('reflects whatever set it is given — a filtered summary is just the summary of the filtered list', () => {
    const sales = [sale({ id: 'a', sale_value: 20000 }), sale({ id: 'b', sale_value: 30000 })]
    const filtered = filterSoldSales(sales, baseFilters({ kind: 'all' }, { minValue: 25000 }), new Date('2026-08-30'))
    expect(computeSoldSummary(filtered).count).toBe(1)
    expect(computeSoldSummary(filtered).revenue).toBe(30000)
  })

  it('returns a null average ticket for an empty list instead of dividing by zero', () => {
    expect(computeSoldSummary([]).avgTicket).toBeNull()
  })
})

describe('deriveSoldFilterOptions', () => {
  it('lists distinct sellers, channels, and vehicle years actually present, sorted', () => {
    const sales = [
      sale({ seller_id: 'sel-2', sellerName: 'Zeca', channel: 'Loja', vehicle: { brand: 'Fiat', model: 'Uno', trim: null, modelYear: 2019, plate: 'A' } }),
      sale({ seller_id: 'sel-1', sellerName: 'Ana', channel: 'Indicação', vehicle: { brand: 'Fiat', model: 'Uno', trim: null, modelYear: 2021, plate: 'B' } }),
      sale({ seller_id: 'sel-1', sellerName: 'Ana', channel: 'Loja', vehicle: { brand: 'Fiat', model: 'Uno', trim: null, modelYear: 2019, plate: 'C' } }),
      sale({ seller_id: null, sellerName: null, channel: null, vehicle: null }),
    ]
    const options = deriveSoldFilterOptions(sales)
    expect(options.sellers).toEqual([
      { id: 'sel-1', name: 'Ana' },
      { id: 'sel-2', name: 'Zeca' },
    ])
    expect(options.channels).toEqual(['Indicação', 'Loja'])
    expect(options.vehicleYears).toEqual([2021, 2019])
  })
})

describe('countActiveAdvancedFilters', () => {
  it('is 0 for the defaults and counts each active dimension once', () => {
    const base = baseFilters({ kind: 'all' })
    expect(countActiveAdvancedFilters(base)).toBe(0)
    expect(countActiveAdvancedFilters({ ...base, sellerId: 'sel-1' })).toBe(1)
    expect(countActiveAdvancedFilters({ ...base, sellerId: 'sel-1', origin: 'app' })).toBe(2)
    // a value range (min and/or max) counts once, not twice
    expect(countActiveAdvancedFilters({ ...base, minValue: 1000, maxValue: 5000 })).toBe(1)
    expect(countActiveAdvancedFilters({ ...base, minValue: 1000 })).toBe(1)
  })

  it('never counts period or query — those are quick controls, not "advanced" filters', () => {
    const base = baseFilters({ kind: 'calendarMonth', year: 2026, month: 1 }, { query: 'civic' })
    expect(countActiveAdvancedFilters(base)).toBe(0)
  })
})

describe('sameSoldPeriod', () => {
  it('compares period selections structurally, including calendarMonth', () => {
    expect(sameSoldPeriod({ kind: 'calendarMonth', year: 2026, month: 8 }, { kind: 'calendarMonth', year: 2026, month: 8 })).toBe(true)
    expect(sameSoldPeriod({ kind: 'calendarMonth', year: 2026, month: 8 }, { kind: 'calendarMonth', year: 2026, month: 7 })).toBe(false)
    expect(sameSoldPeriod({ kind: 'months', months: 6 }, { kind: 'months', months: 6 })).toBe(true)
    expect(sameSoldPeriod({ kind: 'months', months: 6 }, { kind: 'months', months: 3 })).toBe(false)
    expect(sameSoldPeriod({ kind: 'all' }, { kind: 'all' })).toBe(true)
  })
})
