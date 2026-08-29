import { supabase } from '@/lib/supabase'
import { AUDIT_ACTION_LABELS, fetchAuditLog, type AuditLogEntry } from './audit'
import { withTimeout } from './withTimeout'

const MONTH_LABELS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function monthBounds(date: Date, monthsAgo: number): { start: string; end: string } {
  const start = new Date(date.getFullYear(), date.getMonth() - monthsAgo, 1)
  const end = new Date(date.getFullYear(), date.getMonth() - monthsAgo + 1, 1)
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

function minDate(a: Date, b: Date): Date {
  return a < b ? a : b
}

/** Both sides treated as local midnight — `date` columns come back as plain
 * 'YYYY-MM-DD', with no timezone of their own. */
export function daysBetween(fromIso: string, to: Date): number {
  const from = new Date(`${fromIso}T00:00:00`)
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000)
}

function vehicleLabel(v: { brand: string; model: string } | undefined): string {
  return v ? [v.brand, v.model].filter(Boolean).join(' ') || 'Veículo' : 'Veículo'
}

/** A sale is either origin='app' (real vehicle_id) or origin='migration'
 * (source_occurrence_id, no live vehicle — see 20260829001800). Both cases
 * resolve to the same kind of display label, just from a different table —
 * this key lets every lookup map share one Map regardless of which. */
function saleVehicleKey(sale: { vehicle_id: string | null; source_occurrence_id: string | null }): string | null {
  if (sale.vehicle_id) return `v:${sale.vehicle_id}`
  if (sale.source_occurrence_id) return `o:${sale.source_occurrence_id}`
  return null
}

// --- Estoque envelhecido -------------------------------------------------

export interface AgingVehicle {
  id: string
  brand: string
  model: string
  plate: string | null
  daysInStock: number
}

export interface AgingSummary {
  /** Sorted oldest first. Only vehicles with a known entry_date — never a fabricated one. */
  vehicles: AgingVehicle[]
  over30: number
  over60: number
  avgDays: number | null
  knownCount: number
  unknownCount: number
}

export function computeAging(
  activeVehicles: Array<{ id: string; brand: string; model: string; plate: string | null; entry_date: string | null }>,
  now: Date,
): AgingSummary {
  const withDate = activeVehicles.filter(
    (v): v is typeof activeVehicles[number] & { entry_date: string } => v.entry_date !== null,
  )
  const vehicles = withDate
    .map((v) => ({ id: v.id, brand: v.brand, model: v.model, plate: v.plate, daysInStock: daysBetween(v.entry_date, now) }))
    .sort((a, b) => b.daysInStock - a.daysInStock)

  return {
    vehicles,
    over30: vehicles.filter((v) => v.daysInStock >= 30).length,
    over60: vehicles.filter((v) => v.daysInStock >= 60).length,
    avgDays: vehicles.length > 0 ? Math.round(vehicles.reduce((sum, v) => sum + v.daysInStock, 0) / vehicles.length) : null,
    knownCount: withDate.length,
    unknownCount: activeVehicles.length - withDate.length,
  }
}

// --- Destaques do período -------------------------------------------------

interface HighlightVehicle {
  brand: string
  model: string
  plate: string | null
  /** Only ever set for a real vehicle (origin='app'). A legacy sale
   * (origin='migration') has no reliable "entered stock" date, so this is
   * always null for it — never estimated, per the product rule. */
  entry_date: string | null
}

export interface Highlights {
  topModel: { brand: string; model: string; count: number } | null
  biggestSale: { vehicleLabel: string; value: number; date: string } | null
  fastestSale: { vehicleLabel: string; days: number; date: string } | null
}

export function computeHighlights(
  sales: Array<{ vehicle_id: string | null; source_occurrence_id: string | null; sale_date: string; sale_value: number }>,
  vehiclesByKey: Map<string, HighlightVehicle>,
): Highlights {
  if (sales.length === 0) return { topModel: null, biggestSale: null, fastestSale: null }
  const lookup = (s: { vehicle_id: string | null; source_occurrence_id: string | null }) => {
    const key = saleVehicleKey(s)
    return key ? vehiclesByKey.get(key) : undefined
  }

  const modelCounts = new Map<string, { brand: string; model: string; count: number }>()
  for (const s of sales) {
    const v = lookup(s)
    if (!v) continue
    const key = `${v.brand}::${v.model}`
    const entry = modelCounts.get(key) ?? { brand: v.brand, model: v.model, count: 0 }
    entry.count += 1
    modelCounts.set(key, entry)
  }
  let topModel: Highlights['topModel'] = null
  for (const entry of modelCounts.values()) {
    if (!topModel || entry.count > topModel.count) topModel = entry
  }

  const biggest = sales.reduce((max, s) => (s.sale_value > max.sale_value ? s : max), sales[0]!)
  const biggestSale = {
    vehicleLabel: vehicleLabel(lookup(biggest)),
    value: biggest.sale_value,
    date: biggest.sale_date,
  }

  let fastestSale: Highlights['fastestSale'] = null
  for (const s of sales) {
    const v = lookup(s)
    if (!v?.entry_date) continue // never estimate a days-in-stock we don't have real data for
    const days = daysBetween(v.entry_date, new Date(`${s.sale_date}T00:00:00`))
    if (days < 0) continue // bad data (entry after sale) — skip rather than show something misleading
    if (!fastestSale || days < fastestSale.days) fastestSale = { vehicleLabel: vehicleLabel(v), days, date: s.sale_date }
  }

  return { topModel, biggestSale, fastestSale }
}

// --- Últimas movimentações -------------------------------------------------

export interface RecentActivity {
  id: string
  createdAt: string
  actionLabel: string
  vehicleLabel: string | null
  amount: number | null
  note: string | null
}

/**
 * audit_log is only ever written by the app's own RPCs (register_sale,
 * cancel_sale, create_vehicle, update_vehicle, create_initial_inventory) —
 * the legacy sales importer writes straight to `sales` and never touches
 * audit_log (a one-time backfill isn't an "activity"). So every entity_id/
 * diff.vehicle_id here is always a real vehicles.id — always looked up
 * with the `v:` key, never `o:`.
 */
export function buildRecentActivity(entries: AuditLogEntry[], vehiclesByKey: Map<string, HighlightVehicle>): RecentActivity[] {
  return entries.map((entry) => {
    const diff = entry.diff as Record<string, unknown> | null
    let label: string | null = null
    let amount: number | null = null
    let note: string | null = null

    switch (entry.action) {
      case 'vehicle_created': {
        const brand = typeof diff?.brand === 'string' ? diff.brand : null
        const model = typeof diff?.model === 'string' ? diff.model : null
        label = [brand, model].filter(Boolean).join(' ') || null
        break
      }
      case 'vehicle_updated': {
        const after = diff?.after as Record<string, unknown> | undefined
        const brand = typeof after?.brand === 'string' ? after.brand : null
        const model = typeof after?.model === 'string' ? after.model : null
        label = [brand, model].filter(Boolean).join(' ') || null
        break
      }
      case 'created_from_migration': {
        const v = vehiclesByKey.get(`v:${entry.entity_id}`)
        label = v ? vehicleLabel(v) : null
        break
      }
      case 'sale_registered': {
        const vehicleId = typeof diff?.vehicle_id === 'string' ? diff.vehicle_id : null
        label = vehicleId ? vehicleLabel(vehiclesByKey.get(`v:${vehicleId}`)) : null
        amount = typeof diff?.sale_value === 'number' ? diff.sale_value : null
        break
      }
      case 'sale_cancelled': {
        const vehicleId = typeof diff?.vehicle_id === 'string' ? diff.vehicle_id : null
        label = vehicleId ? vehicleLabel(vehiclesByKey.get(`v:${vehicleId}`)) : null
        note = typeof diff?.reason === 'string' ? diff.reason : null
        break
      }
    }

    return {
      id: entry.id,
      createdAt: entry.created_at,
      actionLabel: AUDIT_ACTION_LABELS[entry.action] ?? entry.action,
      vehicleLabel: label,
      amount,
      note,
    }
  })
}

// --- Histórico de vendas ----------------------------------------------------

export type SalesRangeSelection = { kind: 'months'; months: 6 | 12 | 24 } | { kind: 'all' } | { kind: 'year'; year: number }

export interface SalesHistoryMonth {
  month: string // 'YYYY-MM'
  label: string // 'Ago', or 'Ago/25' when the range spans more than one year
  salesCount: number
  revenue: number
  avgTicket: number | null
  commission: number
  commissionKnownCount: number
}

export interface SalesHistorySummary {
  salesCount: number
  revenue: number
  avgTicket: number | null
  commission: number
  commissionKnownCount: number
}

export interface SalesHistoryView {
  /** Real months only, oldest first — a month genuinely without a sale
   * appears as zero; a month outside the real data span never appears. */
  months: SalesHistoryMonth[]
  summary: SalesHistorySummary
  /** Both null unless the equivalent previous period has a real base to
   * compare against ("all" never has a meaningful previous period). */
  comparison: { salesDeltaPct: number | null; revenueDeltaPct: number | null }
  bestMonth: SalesHistoryMonth | null
  /** Worst month AMONG months that had at least one sale — a silent month
   * isn't a "worst month", it's a gap. */
  worstMonth: SalesHistoryMonth | null
  avgMonthlySales: number | null
  avgMonthlyRevenue: number | null
}

type RawSale = { sale_date: string; sale_value: number; commission_amount: number | null }

function aggregateRange(sales: RawSale[], start: Date, end: Date): { salesCount: number; revenue: number } {
  const startIso = start.toISOString().slice(0, 10)
  const endIso = end.toISOString().slice(0, 10)
  const inRange = sales.filter((s) => s.sale_date >= startIso && s.sale_date < endIso)
  return { salesCount: inRange.length, revenue: inRange.reduce((sum, s) => sum + s.sale_value, 0) }
}

function buildMonthBucket(sales: RawSale[], start: Date, end: Date, spansYears: boolean): SalesHistoryMonth {
  const startIso = start.toISOString().slice(0, 10)
  const endIso = end.toISOString().slice(0, 10)
  const inBucket = sales.filter((s) => s.sale_date >= startIso && s.sale_date < endIso)
  const revenue = inBucket.reduce((sum, s) => sum + s.sale_value, 0)
  const known = inBucket.filter((s) => s.commission_amount !== null)
  const monthLabel = capitalize(MONTH_LABELS[start.getMonth()]!)
  return {
    month: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
    label: spansYears ? `${monthLabel}/${String(start.getFullYear()).slice(2)}` : monthLabel,
    salesCount: inBucket.length,
    revenue,
    avgTicket: inBucket.length > 0 ? revenue / inBucket.length : null,
    commission: known.reduce((sum, s) => sum + (s.commission_amount ?? 0), 0),
    commissionKnownCount: known.length,
  }
}

function summarize(months: SalesHistoryMonth[]): SalesHistorySummary {
  const salesCount = months.reduce((sum, m) => sum + m.salesCount, 0)
  const revenue = months.reduce((sum, m) => sum + m.revenue, 0)
  const commission = months.reduce((sum, m) => sum + m.commission, 0)
  const commissionKnownCount = months.reduce((sum, m) => sum + m.commissionKnownCount, 0)
  return { salesCount, revenue, avgTicket: salesCount > 0 ? revenue / salesCount : null, commission, commissionKnownCount }
}

function resolveRangeBounds(selection: SalesRangeSelection, now: Date, earliestSaleDate: string | null): { start: Date; end: Date } | null {
  const nextMonthStart = addMonths(new Date(now.getFullYear(), now.getMonth(), 1), 1)

  if (selection.kind === 'months') {
    return { start: addMonths(nextMonthStart, -selection.months), end: nextMonthStart }
  }
  if (selection.kind === 'year') {
    return { start: new Date(selection.year, 0, 1), end: minDate(new Date(selection.year + 1, 0, 1), nextMonthStart) }
  }
  // kind === 'all' — bounded by the earliest real sale, never a made-up start
  if (!earliestSaleDate) return null
  const [y, m] = earliestSaleDate.split('-').map(Number)
  return { start: new Date(y!, m! - 1, 1), end: nextMonthStart }
}

function computeComparison(
  sales: RawSale[],
  start: Date,
  end: Date,
  selection: SalesRangeSelection,
): { salesDeltaPct: number | null; revenueDeltaPct: number | null } {
  if (selection.kind === 'all') return { salesDeltaPct: null, revenueDeltaPct: null }

  const periodLengthMonths = selection.kind === 'year' ? 12 : selection.months
  const prevStart = addMonths(start, -periodLengthMonths)
  const prevEnd = start

  const current = aggregateRange(sales, start, end)
  const previous = aggregateRange(sales, prevStart, prevEnd)
  return {
    salesDeltaPct: previous.salesCount > 0 ? Math.round(((current.salesCount - previous.salesCount) / previous.salesCount) * 100) : null,
    revenueDeltaPct: previous.revenue > 0 ? Math.round(((current.revenue - previous.revenue) / previous.revenue) * 100) : null,
  }
}

export function buildSalesHistoryView(sales: RawSale[], selection: SalesRangeSelection, now: Date, earliestSaleDate: string | null): SalesHistoryView {
  const bounds = resolveRangeBounds(selection, now, earliestSaleDate)
  if (!bounds || bounds.start >= bounds.end) {
    return {
      months: [],
      summary: { salesCount: 0, revenue: 0, avgTicket: null, commission: 0, commissionKnownCount: 0 },
      comparison: { salesDeltaPct: null, revenueDeltaPct: null },
      bestMonth: null,
      worstMonth: null,
      avgMonthlySales: null,
      avgMonthlyRevenue: null,
    }
  }
  const { start, end } = bounds
  const spansYears = start.getFullYear() !== addMonths(end, -1).getFullYear()

  const months: SalesHistoryMonth[] = []
  for (let cursor = start; cursor < end; cursor = addMonths(cursor, 1)) {
    months.push(buildMonthBucket(sales, cursor, addMonths(cursor, 1), spansYears))
  }

  const summary = summarize(months)
  const withSales = months.filter((m) => m.salesCount > 0)
  const bestMonth = withSales.length > 0 ? withSales.reduce((a, b) => (b.revenue > a.revenue ? b : a)) : null
  const worstMonth = withSales.length > 0 ? withSales.reduce((a, b) => (b.revenue < a.revenue ? b : a)) : null

  return {
    months,
    summary,
    comparison: computeComparison(sales, start, end, selection),
    bestMonth,
    worstMonth,
    avgMonthlySales: months.length > 0 ? summary.salesCount / months.length : null,
    avgMonthlyRevenue: months.length > 0 ? summary.revenue / months.length : null,
  }
}

// --- Orquestração ----------------------------------------------------------

export interface DashboardStats {
  // KPIs principais
  vehiclesInStock: number
  stockValue: number
  salesThisMonth: number
  revenueThisMonth: number
  salesLastMonth: number
  revenueLastMonth: number

  // KPIs secundários
  avgSaleTicket: number | null
  commissionThisMonth: number
  commissionThisMonthKnownCount: number
  avgStockTicket: number | null
  avgDaysInStock: number | null
  vehiclesInStockWithEntryDate: number
  vehiclesInStockMissingEntryDate: number

  // Histórico de vendas — dado bruto completo (todas as vendas concluídas,
  // de qualquer origem/período); a Home monta a visão do período
  // selecionado com buildSalesHistoryView() no cliente, sem nova ida à rede
  // a cada troca de período/ano.
  salesHistorySales: RawSale[]
  salesHistoryAvailableYears: number[]
  salesHistoryEarliestDate: string | null

  // Estoque envelhecido
  agingVehicles: AgingVehicle[]
  agingOver30: number
  agingOver60: number

  // Destaques (últimos 6 meses)
  topSellingModel: Highlights['topModel']
  biggestSale: Highlights['biggestSale']
  fastestSale: Highlights['fastestSale']

  // Últimas movimentações
  recentActivity: RecentActivity[]
}

/**
 * Todo indicador vem de vehicles/sales/audit_log — nenhuma tabela nova,
 * nenhuma view materializada, nenhum job. Sem fallback de demonstração —
 * como em Estoque/Histórico, um número inventado seria pior do que uma
 * tela de erro honesta.
 */
export async function fetchDashboardStats(): Promise<DashboardStats> {
  const now = new Date()
  const thisMonth = monthBounds(now, 0)
  const lastMonth = monthBounds(now, 1)
  const sixMonthsAgoStart = monthBounds(now, 5).start

  const [{ data: activeVehicles, error: vehiclesError }, { data: allSales, error: salesError }, auditEntries] = await Promise.all([
    withTimeout(
      supabase
        .from('vehicles')
        .select('id, brand, model, plate, asking_price, entry_date')
        .in('status', ['available', 'reserved']),
    ),
    withTimeout(
      supabase
        .from('sales')
        .select('vehicle_id, source_occurrence_id, sale_date, sale_value, commission_amount')
        .eq('status', 'completed'),
    ),
    fetchAuditLog(5),
  ])
  if (vehiclesError) throw vehiclesError
  if (salesError) throw salesError

  const windowSales = allSales.filter((s) => s.sale_date >= sixMonthsAgoStart && s.sale_date < thisMonth.end)

  // Vehicles/occurrences referenced by a window sale or by a recent audit
  // entry that doesn't already embed brand/model — one batched lookup each,
  // same pattern as sales.ts's fetchSales().
  const neededVehicleIds = new Set<string>()
  const neededOccurrenceIds = new Set<string>()
  for (const s of windowSales) {
    if (s.vehicle_id) neededVehicleIds.add(s.vehicle_id)
    else if (s.source_occurrence_id) neededOccurrenceIds.add(s.source_occurrence_id)
  }
  for (const entry of auditEntries) {
    if (entry.action === 'created_from_migration') neededVehicleIds.add(entry.entity_id)
    if (entry.action === 'sale_registered' || entry.action === 'sale_cancelled') {
      const diff = entry.diff as { vehicle_id?: string } | null
      if (diff?.vehicle_id) neededVehicleIds.add(diff.vehicle_id)
    }
  }

  const [{ data: referencedVehicles, error: referencedError }, { data: referencedOccurrences, error: occurrencesError }] = await Promise.all([
    neededVehicleIds.size > 0
      ? withTimeout(supabase.from('vehicles').select('id, brand, model, plate, entry_date').in('id', [...neededVehicleIds]))
      : Promise.resolve({ data: [], error: null }),
    neededOccurrenceIds.size > 0
      ? withTimeout(
          supabase
            .from('vehicle_occurrences')
            .select('id, confirmed_brand, confirmed_model, confirmed_plate, parsed_brand, parsed_model, plate_normalized')
            .in('id', [...neededOccurrenceIds]),
        )
      : Promise.resolve({ data: [], error: null }),
  ])
  if (referencedError) throw referencedError
  if (occurrencesError) throw occurrencesError

  const vehiclesByKey = new Map<string, HighlightVehicle>()
  for (const v of referencedVehicles) vehiclesByKey.set(`v:${v.id}`, { brand: v.brand, model: v.model, plate: v.plate, entry_date: v.entry_date })
  for (const o of referencedOccurrences) {
    vehiclesByKey.set(`o:${o.id}`, {
      brand: o.confirmed_brand ?? o.parsed_brand ?? 'Não identificado',
      model: o.confirmed_model ?? o.parsed_model ?? 'Não identificado',
      plate: o.confirmed_plate ?? o.plate_normalized,
      entry_date: null, // never known for a legacy occurrence — see HighlightVehicle
    })
  }

  const salesThisMonth = allSales.filter((s) => s.sale_date >= thisMonth.start && s.sale_date < thisMonth.end)
  const salesLastMonth = allSales.filter((s) => s.sale_date >= lastMonth.start && s.sale_date < lastMonth.end)
  const revenueThisMonth = salesThisMonth.reduce((sum, s) => sum + s.sale_value, 0)
  const revenueLastMonth = salesLastMonth.reduce((sum, s) => sum + s.sale_value, 0)
  const knownCommissions = salesThisMonth.filter((s) => s.commission_amount !== null)

  const aging = computeAging(activeVehicles, now)
  const stockValue = activeVehicles.reduce((sum, v) => sum + (v.asking_price ?? 0), 0)
  const highlights = computeHighlights(windowSales, vehiclesByKey)

  const salesHistorySales: RawSale[] = allSales.map((s) => ({ sale_date: s.sale_date, sale_value: s.sale_value, commission_amount: s.commission_amount }))
  const salesHistoryAvailableYears = [...new Set(allSales.map((s) => Number(s.sale_date.slice(0, 4))))].sort((a, b) => b - a)
  const salesHistoryEarliestDate = allSales.reduce<string | null>((min, s) => (min === null || s.sale_date < min ? s.sale_date : min), null)

  return {
    vehiclesInStock: activeVehicles.length,
    stockValue,
    salesThisMonth: salesThisMonth.length,
    revenueThisMonth,
    salesLastMonth: salesLastMonth.length,
    revenueLastMonth,

    avgSaleTicket: salesThisMonth.length > 0 ? revenueThisMonth / salesThisMonth.length : null,
    commissionThisMonth: knownCommissions.reduce((sum, s) => sum + (s.commission_amount ?? 0), 0),
    commissionThisMonthKnownCount: knownCommissions.length,
    avgStockTicket: activeVehicles.length > 0 ? stockValue / activeVehicles.length : null,
    avgDaysInStock: aging.avgDays,
    vehiclesInStockWithEntryDate: aging.knownCount,
    vehiclesInStockMissingEntryDate: aging.unknownCount,

    salesHistorySales,
    salesHistoryAvailableYears,
    salesHistoryEarliestDate,

    agingVehicles: aging.vehicles.slice(0, 5),
    agingOver30: aging.over30,
    agingOver60: aging.over60,

    topSellingModel: highlights.topModel,
    biggestSale: highlights.biggestSale,
    fastestSale: highlights.fastestSale,

    recentActivity: buildRecentActivity(auditEntries, vehiclesByKey),
  }
}
