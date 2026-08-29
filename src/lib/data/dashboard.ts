import { supabase } from '@/lib/supabase'
import { withTimeout } from './withTimeout'

export interface DashboardStats {
  vehiclesInStock: number
  stockValue: number
  salesThisMonth: number
  revenueThisMonth: number
  commissionThisMonth: number
  commissionThisMonthKnownCount: number
  revenueLastMonth: number
}

function monthBounds(date: Date, monthsAgo: number): { start: string; end: string } {
  const start = new Date(date.getFullYear(), date.getMonth() - monthsAgo, 1)
  const end = new Date(date.getFullYear(), date.getMonth() - monthsAgo + 1, 1)
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}

/**
 * Os 6 indicadores aprovados (ROADMAP.md). Sem fallback de demonstração —
 * como em Estoque/Histórico, um número de faturamento ou comissão
 * inventado seria pior do que uma tela de erro honesta.
 */
export async function fetchDashboardStats(): Promise<DashboardStats> {
  const now = new Date()
  const thisMonth = monthBounds(now, 0)
  const lastMonth = monthBounds(now, 1)

  const [{ data: vehicles, error: vehiclesError }, { data: sales, error: salesError }] = await Promise.all([
    withTimeout(supabase.from('vehicles').select('asking_price').eq('status', 'available')),
    withTimeout(
      supabase
        .from('sales')
        .select('sale_date, sale_value, commission_amount')
        .eq('status', 'completed')
        .gte('sale_date', lastMonth.start)
        .lt('sale_date', thisMonth.end),
    ),
  ])
  if (vehiclesError) throw vehiclesError
  if (salesError) throw salesError

  const salesThisMonthRows = sales.filter((s) => s.sale_date >= thisMonth.start && s.sale_date < thisMonth.end)
  const salesLastMonthRows = sales.filter((s) => s.sale_date >= lastMonth.start && s.sale_date < lastMonth.end)
  const knownCommissions = salesThisMonthRows.filter((s) => s.commission_amount !== null)

  return {
    vehiclesInStock: vehicles.length,
    stockValue: vehicles.reduce((sum, v) => sum + (v.asking_price ?? 0), 0),
    salesThisMonth: salesThisMonthRows.length,
    revenueThisMonth: salesThisMonthRows.reduce((sum, s) => sum + s.sale_value, 0),
    commissionThisMonth: knownCommissions.reduce((sum, s) => sum + (s.commission_amount ?? 0), 0),
    commissionThisMonthKnownCount: knownCommissions.length,
    revenueLastMonth: salesLastMonthRows.reduce((sum, s) => sum + s.sale_value, 0),
  }
}
