import type { SaleWithDetails } from './sales'

/** Vendidos = sales realmente concluídas. Uma venda cancelada não é "o que já vendi" — fica só no Histórico. */
export function completedSales(sales: SaleWithDetails[]): SaleWithDetails[] {
  return sales.filter((s) => s.status === 'completed')
}

const MONTH_NAMES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const MONTH_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

/**
 * `calendarMonth` is a specific, steppable month (1-12) — the primary way
 * this screen expects to be browsed ("< Agosto de 2026 >"). The others are
 * rolling/aggregate ranges, offered as quick pills alongside it — arrows
 * only make sense for a discrete calendarMonth, not for "últimos 6 meses".
 */
export type SoldPeriodSelection =
  | { kind: 'calendarMonth'; year: number; month: number }
  | { kind: 'months'; months: 3 | 6 | 12 }
  | { kind: 'all' }
  | { kind: 'year'; year: number }

export function currentCalendarMonth(now: Date): { kind: 'calendarMonth'; year: number; month: number } {
  return { kind: 'calendarMonth', year: now.getFullYear(), month: now.getMonth() + 1 }
}

export function stepCalendarMonth(month: { year: number; month: number }, delta: number): { year: number; month: number } {
  const d = new Date(month.year, month.month - 1 + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

/** False once stepping forward would land in the future — a month with no sales yet isn't "navigable". */
export function canStepMonthForward(month: { year: number; month: number }, now: Date): boolean {
  const next = stepCalendarMonth(month, 1)
  return next.year < now.getFullYear() || (next.year === now.getFullYear() && next.month <= now.getMonth() + 1)
}

export function periodLabel(selection: SoldPeriodSelection): string {
  switch (selection.kind) {
    case 'calendarMonth': {
      const name = MONTH_NAMES[selection.month - 1]!
      return `${name.charAt(0).toUpperCase()}${name.slice(1)} de ${selection.year}`
    }
    case 'months':
      return `Últimos ${selection.months} meses`
    case 'year':
      return `Ano de ${selection.year}`
    case 'all':
      return 'Todo o período'
  }
}

export const SOLD_PERIOD_QUICK_OPTIONS: Array<{ label: string; selection: SoldPeriodSelection }> = [
  { label: '3 meses', selection: { kind: 'months', months: 3 } },
  { label: '6 meses', selection: { kind: 'months', months: 6 } },
  { label: '12 meses', selection: { kind: 'months', months: 12 } },
  { label: 'Tudo', selection: { kind: 'all' } },
]

export function sameSoldPeriod(a: SoldPeriodSelection, b: SoldPeriodSelection): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === 'months' && b.kind === 'months') return a.months === b.months
  if (a.kind === 'year' && b.kind === 'year') return a.year === b.year
  if (a.kind === 'calendarMonth' && b.kind === 'calendarMonth') return a.year === b.year && a.month === b.month
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
    case 'calendarMonth': {
      const start = new Date(selection.year, selection.month - 1, 1)
      return { start: iso(start), end: iso(addMonths(start, 1)) }
    }
    case 'months':
      return { start: iso(addMonths(nextMonthStart, -selection.months)), end: iso(nextMonthStart) }
    case 'year':
      return { start: iso(new Date(selection.year, 0, 1)), end: iso(new Date(selection.year + 1, 0, 1)) }
    case 'all':
      return null
  }
}

export type SoldCommissionFilter = 'all' | 'known' | 'unknown'

export interface SoldFilters {
  period: SoldPeriodSelection
  sellerId: string | 'all'
  channel: string | 'all'
  origin: 'all' | 'app' | 'migration'
  commission: SoldCommissionFilter
  vehicleYear: number | 'all'
  minValue: number | null
  maxValue: number | null
  query: string
}

/** Everything except `period` (which depends on "now" — see currentCalendarMonth) and `query`. */
export const DEFAULT_SOLD_FILTERS: Omit<SoldFilters, 'period' | 'query'> = {
  sellerId: 'all',
  channel: 'all',
  origin: 'all',
  commission: 'all',
  vehicleYear: 'all',
  minValue: null,
  maxValue: null,
}

/** Count of active *advanced* filters (not period/query, which are always-visible quick controls) — drives the "Filtros · N" badge. A value range counts once, not twice. */
export function countActiveAdvancedFilters(filters: SoldFilters): number {
  let n = 0
  if (filters.sellerId !== 'all') n++
  if (filters.channel !== 'all') n++
  if (filters.origin !== 'all') n++
  if (filters.commission !== 'all') n++
  if (filters.vehicleYear !== 'all') n++
  if (filters.minValue !== null || filters.maxValue !== null) n++
  return n
}

export function filterSoldSales(sales: SaleWithDetails[], filters: SoldFilters, now: Date): SaleWithDetails[] {
  const bounds = periodBounds(filters.period, now)
  const q = filters.query.trim().toLowerCase()

  return sales.filter((s) => {
    if (bounds && (s.sale_date < bounds.start || s.sale_date >= bounds.end)) return false
    if (filters.sellerId !== 'all' && s.seller_id !== filters.sellerId) return false
    if (filters.channel !== 'all' && s.channel !== filters.channel) return false
    if (filters.origin !== 'all' && s.origin !== filters.origin) return false
    if (filters.commission === 'known' && s.commission_amount === null) return false
    if (filters.commission === 'unknown' && s.commission_amount !== null) return false
    if (filters.vehicleYear !== 'all' && s.vehicle?.modelYear !== filters.vehicleYear) return false
    if (filters.minValue !== null && s.sale_value < filters.minValue) return false
    if (filters.maxValue !== null && s.sale_value > filters.maxValue) return false
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
  vehicleYears: number[]
}

/** Derived from every completed sale (not the currently-filtered subset) so picking one filter never makes another filter's own options disappear. */
export function deriveSoldFilterOptions(sales: SaleWithDetails[]): SoldFilterOptions {
  const sellerMap = new Map<string, string>()
  const channels = new Set<string>()
  const vehicleYears = new Set<number>()
  for (const s of sales) {
    if (s.seller_id && s.sellerName) sellerMap.set(s.seller_id, s.sellerName)
    if (s.channel) channels.add(s.channel)
    if (s.vehicle?.modelYear) vehicleYears.add(s.vehicle.modelYear)
  }
  return {
    sellers: [...sellerMap.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    channels: [...channels].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    vehicleYears: [...vehicleYears].sort((a, b) => b - a),
  }
}

export { MONTH_ABBR }
