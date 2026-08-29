import type { SaleWithDetails } from '@/lib/data/sales'
import type { Vehicle } from '@/lib/data/vehicles'

/**
 * Exportação de dados (ROADMAP.md P1 — "os dados pertencem à loja"). CSV
 * usa `;` como separador porque é o que o Excel em pt-BR espera por padrão
 * (a mesma planilha que este produto está substituindo).
 */
function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value)
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function toCSV<T extends object>(rows: T[], columns: Array<{ key: keyof T; header: string }>): string {
  const headerLine = columns.map((c) => csvEscape(c.header)).join(';')
  const lines = rows.map((row) => columns.map((c) => csvEscape(row[c.key])).join(';'))
  return [headerLine, ...lines].join('\r\n')
}

function downloadFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const VEHICLE_COLUMNS: Array<{ key: keyof Vehicle; header: string }> = [
  { key: 'brand', header: 'Marca' },
  { key: 'model', header: 'Modelo' },
  { key: 'trim', header: 'Versão' },
  { key: 'model_year', header: 'Ano modelo' },
  { key: 'manufacture_year', header: 'Ano fabricação' },
  { key: 'plate', header: 'Placa' },
  { key: 'asking_price', header: 'Valor anunciado' },
  { key: 'status', header: 'Status' },
  { key: 'origin', header: 'Origem' },
  { key: 'entry_date', header: 'Data de entrada' },
  { key: 'observations', header: 'Observações' },
]

export function exportVehiclesCSV(vehicles: Vehicle[]): void {
  downloadFile(`estoque-${todayStamp()}.csv`, toCSV(vehicles, VEHICLE_COLUMNS), 'text/csv;charset=utf-8')
}

export function exportVehiclesJSON(vehicles: Vehicle[]): void {
  downloadFile(`estoque-${todayStamp()}.json`, JSON.stringify(vehicles, null, 2), 'application/json')
}

interface SaleExportRow extends Record<string, unknown> {
  sale_date: string
  brand: string
  model: string
  plate: string
  customer_name: string
  customer_phone: string
  sale_value: number
  sellerName: string
  commission_amount: number | null
  status: string
  cancelled_reason: string | null
}

const SALE_COLUMNS: Array<{ key: keyof SaleExportRow; header: string }> = [
  { key: 'sale_date', header: 'Data' },
  { key: 'brand', header: 'Marca' },
  { key: 'model', header: 'Modelo' },
  { key: 'plate', header: 'Placa' },
  { key: 'customer_name', header: 'Comprador' },
  { key: 'customer_phone', header: 'Telefone' },
  { key: 'sale_value', header: 'Valor' },
  { key: 'sellerName', header: 'Vendedor' },
  { key: 'commission_amount', header: 'Comissão' },
  { key: 'status', header: 'Status' },
  { key: 'cancelled_reason', header: 'Motivo do cancelamento' },
]

function toSaleExportRow(s: SaleWithDetails): SaleExportRow {
  return {
    sale_date: s.sale_date,
    brand: s.vehicle?.brand ?? '',
    model: s.vehicle?.model ?? '',
    plate: s.vehicle?.plate ?? '',
    customer_name: s.customer_name ?? '',
    customer_phone: s.customer_phone ?? '',
    sale_value: s.sale_value,
    sellerName: s.sellerName ?? '',
    commission_amount: s.commission_amount,
    status: s.status,
    cancelled_reason: s.cancelled_reason,
  }
}

export function exportSalesCSV(sales: SaleWithDetails[]): void {
  downloadFile(`historico-${todayStamp()}.csv`, toCSV(sales.map(toSaleExportRow), SALE_COLUMNS), 'text/csv;charset=utf-8')
}

export function exportSalesJSON(sales: SaleWithDetails[]): void {
  downloadFile(`historico-${todayStamp()}.json`, JSON.stringify(sales, null, 2), 'application/json')
}

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10)
}
