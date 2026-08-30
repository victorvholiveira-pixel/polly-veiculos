import type { SaleWithDetails } from './sales'

/** Vendidos = sales realmente concluídas. Uma venda cancelada não é "o que já vendi" — fica só no Histórico. */
export function completedSales(sales: SaleWithDetails[]): SaleWithDetails[] {
  return sales.filter((s) => s.status === 'completed')
}

export type SoldPeriodSelection = { kind: 'month' } | { kind: 'months'; months: 3 | 6 | 12 } | { kind: 'all' } | { kind: 'year'; year: number }

export const SOLD_PERIOD_OPTIONS: Array<{ label: string; selection: SoldPeriodSelection }> = [
  { label: 'Este mês', selection: { kind: 'month' } },
  { label: '3 meses', selection: { kind: 'months', months: 3 } },
  { label: '6 meses', selection: { kind: 'months', months: 6 } },
  { label: '12 meses', selection: { kind: 'months', months: 12 } },
  { label: 'Tudo', selection: { kind: 'all' } },
]

export function sameSoldPeriod(a: SoldPeriodSelection, b: SoldPeriodSelection): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === 'months' && b.kind === 'months') return a.months === b.months
  if (a.kind === 'year' && b.kind === 'year') return a.year === b.year
  return true
}

/** Real years present in the data, newest first — never a year with no sale in it. */
export function availableSoldYears(sales: SaleWithDetails[]): number[] {
  const years = new Set(sales.map((s) => Number(s.sale_date.slice(0, 4))))
  return [...years].sort((a, b) => b - a)
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, d.getDate())
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function periodBounds(selection: SoldPeriodSelection, now: Date): { start: string; end: string } | null {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const nextMonthStart = addMonths(monthStart, 1)
  switch (selection.kind) {
    case 'month':
      return { start: iso(monthStart), end: iso(nextMonthStart) }
    case 'months':
      return { start: iso(addMonths(nextMonthStart, -selection.months)), end: iso(nextMonthStart) }
    case 'year':
      return { start: iso(new Date(selection.year, 0, 1)), end: iso(new Date(selection.year + 1, 0, 1)) }
    case 'all':
      return null
  }
}

export interface SoldFilters {
  period: SoldPeriodSelection
  sellerId: string | 'all'
  channel: string | 'all'
  origin: 'all' | 'app' | 'migration'
  query: string
}

export const DEFAULT_SOLD_FILTERS: SoldFilters = { period: { kind: 'months', months: 6 }, sellerId: 'all', channel: 'all', origin: 'all', query: '' }

export function isDefaultSoldFilters(filters: SoldFilters): boolean {
  return sameSoldPeriod(filters.period, DEFAULT_SOLD_FILTERS.period) && filters.sellerId === 'all' && filters.channel === 'all' && filters.origin === 'all'
}

export function filterSoldSales(sales: SaleWithDetails[], filters: SoldFilters, now: Date): SaleWithDetails[] {
  const bounds = periodBounds(filters.period, now)
  const q = filters.query.trim().toLowerCase()

  return sales.filter((s) => {
    if (bounds && (s.sale_date < bounds.start || s.sale_date >= bounds.end)) return false
    if (filters.sellerId !== 'all' && s.seller_id !== filters.sellerId) return false
    if (filters.channel !== 'all' && s.channel !== filters.channel) return false
    if (filters.origin !== 'all' && s.origin !== filters.origin) return false
    if (q) {
      const haystack = [s.vehicle?.brand, s.vehicle?.model, s.vehicle?.plate, s.customer_name].filter(Boolean).join(' ').toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })
}

export type SoldSortKey = 'newest' | 'oldest' | 'value_desc' | 'value_asc'

export const SOLD_SORT_OPTIONS: Array<{ key: SoldSortKey; label: string }> = [
  { key: 'newest', label: 'Venda mais recente' },
  { key: 'oldest', label: 'Venda mais antiga' },
  { key: 'value_desc', label: 'Maior valor' },
  { key: 'value_asc', label: 'Menor valor' },
]

export function sortSoldSales(sales: SaleWithDetails[], key: SoldSortKey): SaleWithDetails[] {
  const list = [...sales]
  switch (key) {
    case 'newest':
      return list.sort((a, b) => b.sale_date.localeCompare(a.sale_date))
    case 'oldest':
      return list.sort((a, b) => a.sale_date.localeCompare(b.sale_date))
    case 'value_desc':
      return list.sort((a, b) => b.sale_value - a.sale_value)
    case 'value_asc':
      return list.sort((a, b) => a.sale_value - b.sale_value)
  }
}

export interface SoldSummary {
  count: number
  revenue: number
  avgTicket: number | null
  commissionKnown: number
  commissionUnknownCount: number
}

/** Nunca inventa comissão: soma só o que é conhecido, e conta à parte quantas vendas não têm comissão registrada. */
export function computeSoldSummary(sales: SaleWithDetails[]): SoldSummary {
  const count = sales.length
  const revenue = sales.reduce((sum, s) => sum + s.sale_value, 0)
  const known = sales.filter((s) => s.commission_amount !== null)
  return {
    count,
    revenue,
    avgTicket: count > 0 ? revenue / count : null,
    commissionKnown: known.reduce((sum, s) => sum + (s.commission_amount ?? 0), 0),
    commissionUnknownCount: count - known.length,
  }
}

export interface SoldFilterOptions {
  sellers: Array<{ id: string; name: string }>
  channels: string[]
}

/** Derived from every completed sale (not the currently-filtered subset) so picking one filter never makes another filter's own options disappear. */
export function deriveSoldFilterOptions(sales: SaleWithDetails[]): SoldFilterOptions {
  const sellerMap = new Map<string, string>()
  const channels = new Set<string>()
  for (const s of sales) {
    if (s.seller_id && s.sellerName) sellerMap.set(s.seller_id, s.sellerName)
    if (s.channel) channels.add(s.channel)
  }
  return {
    sellers: [...sellerMap.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    channels: [...channels].sort((a, b) => a.localeCompare(b, 'pt-BR')),
  }
}
