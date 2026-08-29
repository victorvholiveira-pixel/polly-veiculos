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

/** Both sides treated as local midnight — `date` columns come back as plain
 * 'YYYY-MM-DD', with no timezone of their own. */
export function daysBetween(fromIso: string, to: Date): number {
  const from = new Date(`${fromIso}T00:00:00`)
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000)
}

function vehicleLabel(v: { brand: string; model: string } | undefined): string {
  return v ? [v.brand, v.model].filter(Boolean).join(' ') || 'Veículo' : 'Veículo'
}

// --- Performance (últimos N meses) --------------------------------------

export interface MonthlyPerformance {
  month: string // 'YYYY-MM'
  label: string // 'Ago'
  salesCount: number
  revenue: number
}

export function computeMonthlyPerformance(
  sales: Array<{ sale_date: string; sale_value: number }>,
  now: Date,
  monthsBack = 6,
): MonthlyPerformance[] {
  const buckets: MonthlyPerformance[] = []
  for (let i = monthsBack - 1; i >= 0; i--) {
    const { start, end } = monthBounds(now, i)
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const inBucket = sales.filter((s) => s.sale_date >= start && s.sale_date < end)
    buckets.push({
      month: start.slice(0, 7),
      label: capitalize(MONTH_LABELS[monthDate.getMonth()]!),
      salesCount: inBucket.length,
      revenue: inBucket.reduce((sum, s) => sum + s.sale_value, 0),
    })
  }
  return buckets
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
  entry_date: string | null
}

export interface Highlights {
  topModel: { brand: string; model: string; count: number } | null
  biggestSale: { vehicleLabel: string; value: number; date: string } | null
  fastestSale: { vehicleLabel: string; days: number; date: string } | null
}

export function computeHighlights(
  sales: Array<{ vehicle_id: string; sale_date: string; sale_value: number }>,
  vehiclesById: Map<string, HighlightVehicle>,
): Highlights {
  if (sales.length === 0) return { topModel: null, biggestSale: null, fastestSale: null }

  const modelCounts = new Map<string, { brand: string; model: string; count: number }>()
  for (const s of sales) {
    const v = vehiclesById.get(s.vehicle_id)
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
    vehicleLabel: vehicleLabel(vehiclesById.get(biggest.vehicle_id)),
    value: biggest.sale_value,
    date: biggest.sale_date,
  }

  let fastestSale: Highlights['fastestSale'] = null
  for (const s of sales) {
    const v = vehiclesById.get(s.vehicle_id)
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

export function buildRecentActivity(entries: AuditLogEntry[], vehiclesById: Map<string, HighlightVehicle>): RecentActivity[] {
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
        const v = vehiclesById.get(entry.entity_id)
        label = v ? vehicleLabel(v) : null
        break
      }
      case 'sale_registered': {
        const vehicleId = typeof diff?.vehicle_id === 'string' ? diff.vehicle_id : null
        label = vehicleId ? vehicleLabel(vehiclesById.get(vehicleId)) : null
        amount = typeof diff?.sale_value === 'number' ? diff.sale_value : null
        break
      }
      case 'sale_cancelled': {
        const vehicleId = typeof diff?.vehicle_id === 'string' ? diff.vehicle_id : null
        label = vehicleId ? vehicleLabel(vehiclesById.get(vehicleId)) : null
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

  // Performance
  monthlyPerformance: MonthlyPerformance[]

  // Estoque envelhecido
  agingVehicles: AgingVehicle[]
  agingOver30: number
  agingOver60: number

  // Destaques (mesma janela de 6 meses da performance)
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
  const windowStart = monthBounds(now, 5).start // 6-month window: this month + 5 previous

  const [{ data: activeVehicles, error: vehiclesError }, { data: windowSales, error: salesError }, auditEntries] = await Promise.all([
    withTimeout(
      supabase
        .from('vehicles')
        .select('id, brand, model, plate, asking_price, entry_date')
        .in('status', ['available', 'reserved']),
    ),
    withTimeout(
      supabase
        .from('sales')
        .select('vehicle_id, sale_date, sale_value, commission_amount')
        .eq('status', 'completed')
        .gte('sale_date', windowStart)
        .lt('sale_date', thisMonth.end),
    ),
    fetchAuditLog(5),
  ])
  if (vehiclesError) throw vehiclesError
  if (salesError) throw salesError

  // Vehicles referenced by a window sale or by a recent audit entry that
  // doesn't already embed brand/model (created_from_migration, sale_*) —
  // one batched lookup, same pattern as sales.ts's fetchSales().
  const neededIds = new Set(windowSales.map((s) => s.vehicle_id))
  for (const entry of auditEntries) {
    if (entry.action === 'created_from_migration') neededIds.add(entry.entity_id)
    if (entry.action === 'sale_registered' || entry.action === 'sale_cancelled') {
      const diff = entry.diff as { vehicle_id?: string } | null
      if (diff?.vehicle_id) neededIds.add(diff.vehicle_id)
    }
  }
  const idsToFetch = [...neededIds]
  const { data: referencedVehicles, error: referencedError } =
    idsToFetch.length > 0
      ? await withTimeout(supabase.from('vehicles').select('id, brand, model, plate, entry_date').in('id', idsToFetch))
      : { data: [], error: null }
  if (referencedError) throw referencedError
  const vehiclesById = new Map(referencedVehicles.map((v) => [v.id, v]))

  const salesThisMonth = windowSales.filter((s) => s.sale_date >= thisMonth.start && s.sale_date < thisMonth.end)
  const salesLastMonth = windowSales.filter((s) => s.sale_date >= lastMonth.start && s.sale_date < lastMonth.end)
  const revenueThisMonth = salesThisMonth.reduce((sum, s) => sum + s.sale_value, 0)
  const revenueLastMonth = salesLastMonth.reduce((sum, s) => sum + s.sale_value, 0)
  const knownCommissions = salesThisMonth.filter((s) => s.commission_amount !== null)

  const aging = computeAging(activeVehicles, now)
  const stockValue = activeVehicles.reduce((sum, v) => sum + (v.asking_price ?? 0), 0)
  const highlights = computeHighlights(windowSales, vehiclesById)

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

    monthlyPerformance: computeMonthlyPerformance(windowSales, now, 6),

    agingVehicles: aging.vehicles.slice(0, 5),
    agingOver30: aging.over30,
    agingOver60: aging.over60,

    topSellingModel: highlights.topModel,
    biggestSale: highlights.biggestSale,
    fastestSale: highlights.fastestSale,

    recentActivity: buildRecentActivity(auditEntries, vehiclesById),
  }
}
