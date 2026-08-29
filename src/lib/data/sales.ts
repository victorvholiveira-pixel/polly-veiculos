import { callApi } from '@/lib/api'
import type { Sale, SaleWithDetails, Seller } from '@/types/api'

export type { Sale, SaleWithDetails, Seller }

/** Histórico real de vendas, já com veículo/vendedor resolvidos pelo backend. */
export async function fetchSales(): Promise<SaleWithDetails[]> {
  return callApi<SaleWithDetails[]>('fetchSales')
}

export async function fetchActiveSellers(): Promise<Seller[]> {
  return callApi<Seller[]>('fetchActiveSellers')
}

/** Creates a seller on the fly from the sale form's "novo vendedor" field. */
export async function createSeller(name: string): Promise<Seller> {
  return callApi<Seller>('createSeller', { name })
}

export interface RegisterSaleInput {
  vehicleId: string
  saleDate: string
  saleValue: number
  customerName?: string
  customerPhone?: string
  sellerId?: string
  dealType?: string
  tradeInDescription?: string
  channel?: string
  commissionAmount?: number
  commissionPercentage?: number
  observations?: string
}

/** Registrar venda (Onda 4 §4) — o único jeito de um veículo virar 'sold'. */
export async function registerSale(input: RegisterSaleInput): Promise<Sale> {
  return callApi<Sale>('registerSale', input)
}

/** Cancelamento de venda (Onda 4 §5) — soft cancel, reverte o veículo para disponível. */
export async function cancelSale(saleId: string, reason: string): Promise<Sale> {
  return callApi<Sale>('cancelSale', { saleId, reason })
}
