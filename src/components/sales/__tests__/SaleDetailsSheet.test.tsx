import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SaleDetailsSheet } from '../SaleDetailsSheet'
import { cancelSale, fetchSaleDetail, type SaleDetail } from '@/lib/data/sales'

vi.mock('@/lib/data/sales', () => ({
  fetchSaleDetail: vi.fn(),
  cancelSale: vi.fn(),
}))

const mockedFetchSaleDetail = vi.mocked(fetchSaleDetail)
const mockedCancelSale = vi.mocked(cancelSale)

const APP_SALE: SaleDetail = {
  id: 'sale-app-1',
  vehicle_id: 'v1',
  seller_id: 'seller-1',
  sale_date: '2026-08-20',
  customer_name: 'Maria Teste',
  customer_phone: '11999990000',
  sale_value: 25900,
  deal_type: null,
  trade_in_description: 'Fiat Palio 2015 na troca',
  channel: 'Indicação de cliente',
  commission_amount: 500,
  commission_percentage: null,
  commission_rule_snapshot: null,
  observations: 'Cliente pagou à vista.',
  status: 'completed',
  cancelled_reason: null,
  cancelled_at: null,
  source_occurrence_id: null,
  created_by: 'user-1',
  origin: 'app',
  created_at: '2026-08-20T00:00:00Z',
  updated_at: '2026-08-20T00:00:00Z',
  vehicle: { brand: 'Fiat', model: 'Uno', trim: 'LXR 1.4', modelYear: 2020, plate: 'ABC1234' },
  sellerName: 'João Vendedor',
}

const MIGRATION_SALE: SaleDetail = {
  ...APP_SALE,
  id: 'sale-legacy-1',
  vehicle_id: null,
  seller_id: null,
  source_occurrence_id: 'occ-1',
  origin: 'migration',
  customer_phone: null,
  trade_in_description: null,
  channel: null,
  observations: null,
  commission_amount: null,
  vehicle: { brand: 'Honda', model: 'Civic', trim: null, modelYear: null, plate: 'DEF5678' },
  sellerName: null,
}

function renderSheet(saleId: string | null, extraProps: Partial<React.ComponentProps<typeof SaleDetailsSheet>> = {}) {
  return render(
    <MemoryRouter>
      <SaleDetailsSheet saleId={saleId} onClose={vi.fn()} {...extraProps} />
    </MemoryRouter>,
  )
}

describe('SaleDetailsSheet', () => {
  beforeEach(() => {
    mockedFetchSaleDetail.mockReset()
    mockedCancelSale.mockReset()
  })

  it('renders nothing when no sale is selected', () => {
    renderSheet(null)
    expect(mockedFetchSaleDetail).not.toHaveBeenCalled()
    expect(screen.queryByText('R$', { exact: false })).not.toBeInTheDocument()
  })

  it('opens an app sale and shows real vehicle data, with the option to view the vehicle and cancel', async () => {
    mockedFetchSaleDetail.mockResolvedValue(APP_SALE)
    renderSheet('sale-app-1')

    expect(await screen.findByText('R$ 25.900,00')).toBeInTheDocument()
    expect(screen.getByText('Fiat Uno')).toBeInTheDocument()
    expect(screen.getByText(/LXR 1\.4/)).toBeInTheDocument()
    expect(screen.getByText(/2020/)).toBeInTheDocument()
    expect(screen.getByText(/ABC1234/)).toBeInTheDocument()
    expect(screen.getByText('Maria Teste')).toBeInTheDocument()
    expect(screen.getByText('11999990000')).toBeInTheDocument()
    expect(screen.getByText('João Vendedor')).toBeInTheDocument()
    expect(screen.getByText('R$ 500,00')).toBeInTheDocument()

    // origin displayed correctly: an app sale is not flagged as imported
    expect(screen.queryByText('Histórico importado')).not.toBeInTheDocument()

    expect(screen.getByRole('link', { name: 'Ver veículo' })).toHaveAttribute('href', '/estoque/v1')
    expect(screen.getByRole('button', { name: 'Cancelar venda' })).toBeInTheDocument()
  })

  it('opens a migration sale hydrated from vehicle_occurrences, flagged as imported and read-only', async () => {
    mockedFetchSaleDetail.mockResolvedValue(MIGRATION_SALE)
    renderSheet('sale-legacy-1')

    expect(await screen.findByText('Honda Civic')).toBeInTheDocument()
    expect(screen.getByText('Histórico importado')).toBeInTheDocument()

    // no fake vehicle: never a "Ver veículo" link when there's no real vehicle_id
    expect(screen.queryByRole('link', { name: 'Ver veículo' })).not.toBeInTheDocument()
    // read-only by default: no cancel action for a migration sale
    expect(screen.queryByRole('button', { name: 'Cancelar venda' })).not.toBeInTheDocument()
    // "Fechar" appears twice: the sheet's own backdrop dismiss button (aria-label) and this explicit footer action.
    expect(screen.getAllByRole('button', { name: 'Fechar' })).toHaveLength(2)
  })

  it('never invents a vehicle for a migration sale with no source_occurrence_id match', async () => {
    mockedFetchSaleDetail.mockResolvedValue({ ...MIGRATION_SALE, vehicle: null })
    renderSheet('sale-legacy-2')

    expect(await screen.findByText('Veículo não informado')).toBeInTheDocument()
    expect(screen.queryByText('Honda Civic')).not.toBeInTheDocument()
  })

  it('omits fields that are missing instead of inventing them', async () => {
    mockedFetchSaleDetail.mockResolvedValue({
      ...APP_SALE,
      customer_name: null,
      customer_phone: null,
      channel: null,
      trade_in_description: null,
      observations: null,
    })
    renderSheet('sale-app-2')

    await screen.findByText('R$ 25.900,00')
    expect(screen.queryByText('Comprador')).not.toBeInTheDocument()
    expect(screen.queryByText('Telefone')).not.toBeInTheDocument()
    expect(screen.queryByText('Canal')).not.toBeInTheDocument()
    expect(screen.queryByText('Troca')).not.toBeInTheDocument()
    expect(screen.queryByText('Observações')).not.toBeInTheDocument()
  })

  it('shows commission as known when present and as "Não informada" when unknown', async () => {
    mockedFetchSaleDetail.mockResolvedValue(APP_SALE)
    renderSheet('sale-app-1')
    expect(await screen.findByText('R$ 500,00')).toBeInTheDocument()

    mockedFetchSaleDetail.mockResolvedValue({ ...APP_SALE, commission_amount: null })
    renderSheet('sale-app-3')
    expect(await screen.findByText('Não informada')).toBeInTheDocument()
  })

  it('shows a cancelled sale as read-only, with no cancel action offered again', async () => {
    mockedFetchSaleDetail.mockResolvedValue({ ...APP_SALE, status: 'cancelled', cancelled_reason: 'Cliente desistiu' })
    renderSheet('sale-app-cancelled')

    expect(await screen.findByText(/Venda cancelada — Cliente desistiu/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancelar venda' })).not.toBeInTheDocument()
  })

  it('cancels an app sale through the sheet, requiring a reason, and notifies the caller', async () => {
    mockedFetchSaleDetail.mockResolvedValue(APP_SALE)
    mockedCancelSale.mockResolvedValue({ ...APP_SALE, status: 'cancelled', cancelled_reason: 'Cliente desistiu' })
    const onSaleChanged = vi.fn()
    const user = userEvent.setup()

    renderSheet('sale-app-1', { onSaleChanged })
    await screen.findByText('R$ 25.900,00')

    await user.click(screen.getByRole('button', { name: 'Cancelar venda' }))
    const confirmButton = screen.getByRole('button', { name: 'Confirmar cancelamento' })
    expect(confirmButton).toBeDisabled()

    await user.type(screen.getByLabelText('Motivo do cancelamento'), 'Cliente desistiu')
    expect(confirmButton).toBeEnabled()
    await user.click(confirmButton)

    await waitFor(() => expect(mockedCancelSale).toHaveBeenCalledWith('sale-app-1', 'Cliente desistiu'))
    await waitFor(() => expect(onSaleChanged).toHaveBeenCalled())
  })
})
