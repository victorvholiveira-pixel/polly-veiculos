import { callApi } from '@/lib/api'

export interface DashboardStats {
  vehiclesInStock: number
  stockValue: number
  salesThisMonth: number
  revenueThisMonth: number
  commissionThisMonth: number
  commissionThisMonthKnownCount: number
  revenueLastMonth: number
}

/**
 * Os 6 indicadores aprovados (ROADMAP.md), calculados no backend (evita
 * mandar todo vehicles/sales só para somar no cliente). Sem fallback de
 * demonstração — como em Estoque/Histórico, um número de faturamento ou
 * comissão inventado seria pior do que uma tela de erro honesta.
 */
export async function fetchDashboardStats(): Promise<DashboardStats> {
  return callApi<DashboardStats>('fetchDashboardStats')
}
