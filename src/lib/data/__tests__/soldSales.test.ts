import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SOLD_FILTERS,
  availableSoldYears,
  completedSales,
  computeSoldSummary,
  deriveSoldFilterOptions,
  filterSoldSales,
  isDefaultSoldFilters,
  sameSoldPeriod,
  sortSoldSales,
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

describe('completedSales', () => {
  it('keeps only status completed — a cancelled sale is not "sold"', () => {
    const sales = [sale({ id: 's1', status: 'completed' }), sale({ id: 's2', status: 'cancelled' })]
    expect(completedSales(sales).map((s) => s.id)).toEqual(['s1'])
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

  it('"Este mês" keeps only sales in the current calendar month', () => {
    const result = filterSoldSales(sales, { ...DEFAULT_SOLD_FILTERS, period: { kind: 'month' } }, now)
    expect(result.map((s) => s.id)).toEqual(['this-month'])
  })

  it('"3 meses" is a rolling window, not a calendar quarter', () => {
    const result = filterSoldSales(sales, { ...DEFAULT_SOLD_FILTERS, period: { kind: 'months', months: 3 } }, now)
    expect(result.map((s) => s.id).sort()).toEqual(['this-month', 'two-months-ago'])
  })

  it('a specific year keeps only sales in that calendar year', () => {
    const result = filterSoldSales(sales, { ...DEFAULT_SOLD_FILTERS, period: { kind: 'year', year: 2025 } }, now)
    expect(result.map((s) => s.id)).toEqual(['last-year'])
  })

  it('"Tudo" never excludes a sale by date', () => {
    const result = filterSoldSales(sales, { ...DEFAULT_SOLD_FILTERS, period: { kind: 'all' } }, now)
    expect(result).toHaveLength(3)
  })
})

describe('filterSoldSales — seller/channel/origin/query, combined', () => {
  const now = new Date('2026-08-30T12:00:00Z')
  const base: SoldFilters = { ...DEFAULT_SOLD_FILTERS, period: { kind: 'all' } }
  const sales = [
    sale({ id: 'app-joao', seller_id: 'sel-1', sellerName: 'João', channel: 'Indicação', origin: 'app', vehicle: { brand: 'Fiat', model: 'Uno', trim: null, modelYear: 2020, plate: 'ABC1234' } }),
    sale({ id: 'migration-ana', seller_id: null, sellerName: null, channel: 'Loja física', origin: 'migration', vehicle: { brand: 'Honda', model: 'Civic', trim: null, modelYear: 2018, plate: 'DEF5678' } }),
  ]

  it('filters by seller', () => {
    expect(filterSoldSales(sales, { ...base, sellerId: 'sel-1' }, now).map((s) => s.id)).toEqual(['app-joao'])
  })

  it('filters by channel', () => {
    expect(filterSoldSales(sales, { ...base, channel: 'Loja física' }, now).map((s) => s.id)).toEqual(['migration-ana'])
  })

  it('filters by origin', () => {
    expect(filterSoldSales(sales, { ...base, origin: 'migration' }, now).map((s) => s.id)).toEqual(['migration-ana'])
  })

  it('searches by brand/model/plate/customer', () => {
    expect(filterSoldSales(sales, { ...base, query: 'civic' }, now).map((s) => s.id)).toEqual(['migration-ana'])
    expect(filterSoldSales(sales, { ...base, query: 'ABC1234' }, now).map((s) => s.id)).toEqual(['app-joao'])
  })

  it('combines search, seller, channel, origin, and period all together', () => {
    const result = filterSoldSales(sales, { period: { kind: 'all' }, sellerId: 'sel-1', channel: 'Indicação', origin: 'app', query: 'Fiat' }, now)
    expect(result.map((s) => s.id)).toEqual(['app-joao'])

    const noMatch = filterSoldSales(sales, { period: { kind: 'all' }, sellerId: 'sel-1', channel: 'Indicação', origin: 'migration', query: 'Fiat' }, now)
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

  it('returns a null average ticket for an empty list instead of dividing by zero', () => {
    expect(computeSoldSummary([]).avgTicket).toBeNull()
  })
})

describe('deriveSoldFilterOptions', () => {
  it('lists distinct sellers and channels actually present, sorted', () => {
    const sales = [
      sale({ seller_id: 'sel-2', sellerName: 'Zeca', channel: 'Loja' }),
      sale({ seller_id: 'sel-1', sellerName: 'Ana', channel: 'Indicação' }),
      sale({ seller_id: 'sel-1', sellerName: 'Ana', channel: 'Loja' }),
      sale({ seller_id: null, sellerName: null, channel: null }),
    ]
    const options = deriveSoldFilterOptions(sales)
    expect(options.sellers).toEqual([
      { id: 'sel-1', name: 'Ana' },
      { id: 'sel-2', name: 'Zeca' },
    ])
    expect(options.channels).toEqual(['Indicação', 'Loja'])
  })
})

describe('sameSoldPeriod / isDefaultSoldFilters', () => {
  it('compares period selections structurally', () => {
    expect(sameSoldPeriod({ kind: 'months', months: 6 }, { kind: 'months', months: 6 })).toBe(true)
    expect(sameSoldPeriod({ kind: 'months', months: 6 }, { kind: 'months', months: 3 })).toBe(false)
    expect(sameSoldPeriod({ kind: 'year', year: 2025 }, { kind: 'year', year: 2026 })).toBe(false)
    expect(sameSoldPeriod({ kind: 'all' }, { kind: 'all' })).toBe(true)
  })

  it('recognizes the default filter set and any deviation from it', () => {
    expect(isDefaultSoldFilters(DEFAULT_SOLD_FILTERS)).toBe(true)
    expect(isDefaultSoldFilters({ ...DEFAULT_SOLD_FILTERS, sellerId: 'sel-1' })).toBe(false)
    expect(isDefaultSoldFilters({ ...DEFAULT_SOLD_FILTERS, period: { kind: 'all' } })).toBe(false)
  })
})
