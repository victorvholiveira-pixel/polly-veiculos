import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SoldVehiclesView } from '../SoldVehiclesView'
import { fetchSaleDetail, fetchSales, type SaleWithDetails } from '@/lib/data/sales'

vi.mock('@/lib/data/sales', () => ({
  fetchSales: vi.fn(),
  fetchSaleDetail: vi.fn(),
  cancelSale: vi.fn(),
}))

const mockedFetchSales = vi.mocked(fetchSales)
const mockedFetchSaleDetail = vi.mocked(fetchSaleDetail)

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
    vehicle: { brand: 'Fiat', model: 'Uno', trim: 'LXR 1.4', modelYear: 2020, plate: 'ABC1234' },
    sellerName: null,
    ...overrides,
  }
}

function renderView() {
  return render(
    <MemoryRouter>
      <SoldVehiclesView />
    </MemoryRouter>,
  )
}

describe('SoldVehiclesView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-08-30T12:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('opens on the current month by default, labelled in plain language', async () => {
    mockedFetchSales.mockResolvedValue([sale({})])
    renderView()
    expect(await screen.findByText('Agosto de 2026')).toBeInTheDocument()
  })

  it('lists only completed sales — a cancelled sale never appears in Vendidos', async () => {
    mockedFetchSales.mockResolvedValue([
      sale({ id: 's-completed', status: 'completed' }),
      sale({ id: 's-cancelled', status: 'cancelled', vehicle: { brand: 'Honda', model: 'Civic', trim: null, modelYear: 2018, plate: 'DEF5678' } }),
    ])
    renderView()

    expect(await screen.findByText('Fiat Uno')).toBeInTheDocument()
    expect(screen.queryByText('Honda Civic')).not.toBeInTheDocument()
  })

  it('shows the fields a sold-vehicle card should: brand/model/trim/year/plate/date/value/customer/seller/commission', async () => {
    mockedFetchSales.mockResolvedValue([sale({ sellerName: 'João Vendedor' })])
    renderView()

    await screen.findByText('Fiat Uno')
    const card = screen.getByRole('button', { name: /Fiat Uno/ })
    expect(within(card).getByText('LXR 1.4')).toBeInTheDocument()
    expect(within(card).getByText(/2020/)).toBeInTheDocument()
    expect(within(card).getByText(/ABC1234/)).toBeInTheDocument()
    expect(within(card).getByText('R$ 30.000,00')).toBeInTheDocument()
    expect(within(card).getByText(/Maria Teste/)).toBeInTheDocument()
    expect(within(card).getByText(/João Vendedor/)).toBeInTheDocument()
    expect(within(card).getByText(/Comissão R\$ 1\.000,00/)).toBeInTheDocument()
  })

  it('marks a migration sale as "Histórico importado" and never a plain app sale', async () => {
    mockedFetchSales.mockResolvedValue([
      sale({ id: 's-app', origin: 'app' }),
      sale({ id: 's-legacy', origin: 'migration', vehicle_id: null, source_occurrence_id: 'occ-1', vehicle: { brand: 'Honda', model: 'Civic', trim: null, modelYear: 2018, plate: 'DEF5678' } }),
    ])
    renderView()

    await screen.findByText('Fiat Uno')
    expect(screen.getAllByText('Histórico importado')).toHaveLength(1)
  })

  it('opens the shared SaleDetailsSheet when a sold item is tapped — no separate detail implementation', async () => {
    mockedFetchSales.mockResolvedValue([sale({})])
    mockedFetchSaleDetail.mockResolvedValue({ ...sale({}), vehicle: { brand: 'Fiat', model: 'Uno', trim: null, modelYear: 2020, plate: 'ABC1234' }, sellerName: null })
    const user = userEvent.setup({ delay: null })
    renderView()

    await user.click(await screen.findByRole('button', { name: /Fiat Uno/ }))
    expect(mockedFetchSaleDetail).toHaveBeenCalledWith('sale-1')
    expect(await screen.findByRole('link', { name: 'Ver veículo' })).toBeInTheDocument()
  })

  describe('navegação de mês', () => {
    it('steps to the previous month and filters to it', async () => {
      mockedFetchSales.mockResolvedValue([
        sale({ id: 'aug', sale_date: '2026-08-05', vehicle: { brand: 'Fiat', model: 'Uno', trim: null, modelYear: 2020, plate: 'ABC1234' } }),
        sale({ id: 'jul', sale_date: '2026-07-05', vehicle: { brand: 'Honda', model: 'Civic', trim: null, modelYear: 2018, plate: 'DEF5678' } }),
      ])
      const user = userEvent.setup({ delay: null })
      renderView()

      await screen.findByText('Fiat Uno')
      await user.click(screen.getByRole('button', { name: 'Mês anterior' }))

      expect(await screen.findByText('Julho de 2026')).toBeInTheDocument()
      expect(screen.getByText('Honda Civic')).toBeInTheDocument()
      expect(screen.queryByText('Fiat Uno')).not.toBeInTheDocument()
    })

    it('does not allow stepping into a future month', async () => {
      mockedFetchSales.mockResolvedValue([sale({})])
      renderView()
      await screen.findByText('Fiat Uno')
      expect(screen.getByRole('button', { name: 'Próximo mês' })).toBeDisabled()
    })

    it('jumps to a specific month/year via the month picker, including changing year', async () => {
      mockedFetchSales.mockResolvedValue([
        sale({ id: 'aug26', sale_date: '2026-08-05', vehicle: { brand: 'Fiat', model: 'Uno', trim: null, modelYear: 2020, plate: 'ABC1234' } }),
        sale({ id: 'mar25', sale_date: '2025-03-10', vehicle: { brand: 'Honda', model: 'Civic', trim: null, modelYear: 2018, plate: 'DEF5678' } }),
      ])
      const user = userEvent.setup({ delay: null })
      renderView()

      await screen.findByText('Fiat Uno')
      await user.click(screen.getByRole('button', { name: 'Agosto de 2026' }))
      await user.click(screen.getByRole('button', { name: 'Ano anterior' }))
      await user.click(screen.getByRole('button', { name: 'Mar' }))

      expect(await screen.findByText('Março de 2025')).toBeInTheDocument()
      expect(screen.getByText('Honda Civic')).toBeInTheDocument()
      expect(screen.queryByText('Fiat Uno')).not.toBeInTheDocument()
    })

    it('shows an honest empty state for a real month with zero sales, without hiding or skipping it', async () => {
      mockedFetchSales.mockResolvedValue([sale({ sale_date: '2026-08-05' })])
      const user = userEvent.setup({ delay: null })
      renderView()

      await screen.findByText('Fiat Uno')
      await user.click(screen.getByRole('button', { name: 'Mês anterior' }))

      expect(await screen.findByText('Julho de 2026')).toBeInTheDocument()
      expect(await screen.findByText(/Nenhuma venda em julho de 2026/)).toBeInTheDocument()
    })
  })

  it('never invents a missing commission in the summary — shows the known total and a count of unknowns', async () => {
    mockedFetchSales.mockResolvedValue([
      sale({ id: 'a', sale_date: '2026-08-01', commission_amount: 1000 }),
      sale({ id: 'b', sale_date: '2026-08-02', commission_amount: null }),
    ])
    renderView()

    await screen.findByText('R$ 1.000,00') // comissão conhecida
    expect(screen.getByText('1 venda sem comissão informada')).toBeInTheDocument()
  })

  it('resumo reflects the currently active filters, not the whole dataset', async () => {
    mockedFetchSales.mockResolvedValue([
      sale({ id: 'a', sale_date: '2026-08-01', sale_value: 10000, vehicle: { brand: 'Fiat', model: 'Uno', trim: null, modelYear: 2020, plate: 'ABC1234' } }),
      sale({ id: 'b', sale_date: '2026-08-02', sale_value: 90000, vehicle: { brand: 'Honda', model: 'Civic', trim: null, modelYear: 2018, plate: 'DEF5678' } }),
    ])
    const user = userEvent.setup({ delay: null })
    renderView()

    await screen.findByText('Fiat Uno')
    await user.click(screen.getByRole('button', { name: 'Tudo' }))
    await user.click(screen.getByRole('button', { name: /Filtros/ }))
    const minInput = screen.getByLabelText('De R$', { selector: 'input' }) ?? screen.getByPlaceholderText('0')
    await user.type(minInput, '50000')
    await user.click(screen.getByRole('button', { name: /Ver \d+ venda/ }))

    // revenue, avg ticket, and the single remaining card's value are all R$ 90.000,00
    expect(screen.getAllByText('R$ 90.000,00').length).toBeGreaterThan(0)
    expect(screen.queryByText('R$ 10.000,00')).not.toBeInTheDocument()
    expect(screen.getByText('Honda Civic')).toBeInTheDocument()
    expect(screen.queryByText('Fiat Uno')).not.toBeInTheDocument()
  })

  describe('filtros avançados', () => {
    const sales = [
      sale({
        id: 's-app',
        seller_id: 'sel-1',
        sellerName: 'Ana',
        channel: 'Indicação',
        origin: 'app',
        commission_amount: 500,
        sale_date: '2026-08-05',
        vehicle: { brand: 'Fiat', model: 'Uno', trim: null, modelYear: 2020, plate: 'ABC1234' },
      }),
      sale({
        id: 's-legacy',
        seller_id: null,
        sellerName: null,
        channel: 'Loja física',
        origin: 'migration',
        commission_amount: null,
        sale_date: '2026-08-06',
        vehicle_id: null,
        source_occurrence_id: 'occ-1',
        vehicle: { brand: 'Honda', model: 'Civic', trim: null, modelYear: 2018, plate: 'DEF5678' },
      }),
    ]

    it('combines month + seller', async () => {
      mockedFetchSales.mockResolvedValue(sales)
      const user = userEvent.setup({ delay: null })
      renderView()

      await screen.findByText('Fiat Uno')
      await user.click(screen.getByRole('button', { name: /Filtros/ }))
      await user.click(screen.getByRole('button', { name: 'Ana' }))
      await user.click(screen.getByRole('button', { name: /Ver \d+ venda/ }))

      expect(screen.getByText('Fiat Uno')).toBeInTheDocument()
      expect(screen.queryByText('Honda Civic')).not.toBeInTheDocument()
    })

    it('combines month + origin, and shows an active-filter count on the Filtros button', async () => {
      mockedFetchSales.mockResolvedValue(sales)
      const user = userEvent.setup({ delay: null })
      renderView()

      await screen.findByText('Fiat Uno')
      await user.click(screen.getByRole('button', { name: /Filtros/ }))
      await user.click(screen.getByRole('button', { name: 'Histórico importado' }))
      await user.click(screen.getByRole('button', { name: /Ver \d+ venda/ }))

      expect(screen.getByText('Honda Civic')).toBeInTheDocument()
      expect(screen.queryByText('Fiat Uno')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Filtros/ })).toHaveTextContent('1')
    })

    it('filters by commission known/unknown', async () => {
      mockedFetchSales.mockResolvedValue(sales)
      const user = userEvent.setup({ delay: null })
      renderView()

      await screen.findByText('Fiat Uno')
      await user.click(screen.getByRole('button', { name: /Filtros/ }))
      await user.click(screen.getByRole('button', { name: 'Não informada' }))
      await user.click(screen.getByRole('button', { name: /Ver \d+ venda/ }))

      expect(screen.getByText('Honda Civic')).toBeInTheDocument()
      expect(screen.queryByText('Fiat Uno')).not.toBeInTheDocument()
    })

    it('clears advanced filters without resetting the selected month', async () => {
      mockedFetchSales.mockResolvedValue(sales)
      const user = userEvent.setup({ delay: null })
      renderView()

      await screen.findByText('Fiat Uno')
      await user.click(screen.getByRole('button', { name: /Filtros/ }))
      await user.click(screen.getByRole('button', { name: 'Ana' }))
      await user.click(screen.getByRole('button', { name: /Ver \d+ venda/ }))
      expect(screen.queryByText('Honda Civic')).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /Filtros/ }))
      await user.click(screen.getByRole('button', { name: 'Limpar' }))
      await user.click(screen.getByRole('button', { name: /Ver \d+ venda/ }))

      expect(screen.getByText('Fiat Uno')).toBeInTheDocument()
      expect(screen.getByText('Honda Civic')).toBeInTheDocument()
      expect(screen.getByText('Agosto de 2026')).toBeInTheDocument()
    })
  })

  it('searches by brand/model/plate/customer', async () => {
    mockedFetchSales.mockResolvedValue([
      sale({ id: 'a', sale_date: '2026-08-01', vehicle: { brand: 'Fiat', model: 'Uno', trim: null, modelYear: 2020, plate: 'ABC1234' } }),
      sale({ id: 'b', sale_date: '2026-08-02', vehicle: { brand: 'Honda', model: 'Civic', trim: null, modelYear: 2018, plate: 'DEF5678' } }),
    ])
    const user = userEvent.setup({ delay: null })
    renderView()

    await screen.findByText('Fiat Uno')
    await user.type(screen.getByPlaceholderText('Marca, modelo, placa ou cliente'), 'civic')

    expect(screen.getByText('Honda Civic')).toBeInTheDocument()
    expect(screen.queryByText('Fiat Uno')).not.toBeInTheDocument()
  })

  it('sorts by highest value first when chosen', async () => {
    mockedFetchSales.mockResolvedValue([
      sale({ id: 'low', sale_date: '2026-08-01', sale_value: 10000, vehicle: { brand: 'Fiat', model: 'Uno', trim: null, modelYear: 2020, plate: 'ABC1234' } }),
      sale({ id: 'high', sale_date: '2026-08-02', sale_value: 90000, vehicle: { brand: 'Honda', model: 'Civic', trim: null, modelYear: 2018, plate: 'DEF5678' } }),
    ])
    const user = userEvent.setup({ delay: null })
    renderView()

    await screen.findByText('Fiat Uno')
    await user.click(screen.getByRole('button', { name: 'Ordenar' }))
    await user.click(screen.getByRole('menuitemradio', { name: 'Maior valor' }))

    const items = screen.getAllByRole('listitem').map((li) => li.textContent)
    expect(items[0]).toMatch(/Honda Civic/)
  })

  it('shows an honest empty state when there are no completed sales at all', async () => {
    mockedFetchSales.mockResolvedValue([])
    renderView()
    expect(await screen.findByText('Nenhuma venda concluída ainda.')).toBeInTheDocument()
  })

  it('handles the real-scale legacy dataset (542 migration sales) without breaking filters or the summary', async () => {
    const legacy: SaleWithDetails[] = Array.from({ length: 542 }, (_, i) =>
      sale({
        id: `legacy-${i}`,
        origin: 'migration',
        vehicle_id: null,
        source_occurrence_id: `occ-${i}`,
        sale_date: `202${5 + (i % 2)}-${String((i % 12) + 1).padStart(2, '0')}-10`,
        sale_value: 10000 + i,
        commission_amount: i % 3 === 0 ? null : 500,
        vehicle: { brand: 'Fiat', model: `Modelo ${i}`, trim: null, modelYear: 2015 + (i % 10), plate: `PLT${i}` },
      }),
    )
    mockedFetchSales.mockResolvedValue(legacy)
    const user = userEvent.setup({ delay: null })
    renderView()

    await user.click(await screen.findByRole('button', { name: 'Tudo' }))
    expect(await screen.findByText('542')).toBeInTheDocument()
    expect(screen.getAllByText('Histórico importado')).toHaveLength(542)
  })
})
