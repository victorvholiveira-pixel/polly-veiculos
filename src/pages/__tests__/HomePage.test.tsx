import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HomePage } from '../HomePage'
import { fetchDashboardStats, type DashboardStats } from '@/lib/data/dashboard'

vi.mock('@/lib/data/dashboard', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/data/dashboard')>()),
  fetchDashboardStats: vi.fn(),
}))

const mockedFetch = vi.mocked(fetchDashboardStats)

const EMPTY_STATS: DashboardStats = {
  vehiclesInStock: 0,
  stockValue: 0,
  salesThisMonth: 0,
  revenueThisMonth: 0,
  salesLastMonth: 0,
  revenueLastMonth: 0,

  avgSaleTicket: null,
  commissionThisMonth: 0,
  commissionThisMonthKnownCount: 0,
  avgStockTicket: null,
  avgDaysInStock: null,
  vehiclesInStockWithEntryDate: 0,
  vehiclesInStockMissingEntryDate: 0,

  salesHistorySales: [],
  salesHistoryAvailableYears: [],
  salesHistoryEarliestDate: null,

  agingVehicles: [],
  agingOver30: 0,
  agingOver60: 0,

  topSellingModel: null,
  biggestSale: null,
  fastestSale: null,

  recentActivity: [],
}

// Every date below is real (2026 is "now" in this test suite — see the
// system-time freeze below), so the default 6-month window (Mar-Ago 2026)
// lines up with the same monthly totals the previous fixture used.
const SIX_MONTH_SALES: DashboardStats['salesHistorySales'] = [
  { sale_date: '2026-03-10', sale_value: 30000, commission_amount: null },
  { sale_date: '2026-05-05', sale_value: 30000, commission_amount: null },
  { sale_date: '2026-05-20', sale_value: 40000, commission_amount: null },
  { sale_date: '2026-06-15', sale_value: 35000, commission_amount: null },
  { sale_date: '2026-07-05', sale_value: 40000, commission_amount: null },
  { sale_date: '2026-07-25', sale_value: 60000, commission_amount: null },
  { sale_date: '2026-08-05', sale_value: 30000, commission_amount: 500 },
  { sale_date: '2026-08-15', sale_value: 40000, commission_amount: null },
  { sale_date: '2026-08-25', sale_value: 50000, commission_amount: 1500 },
]

const FULL_STATS: DashboardStats = {
  ...EMPTY_STATS,
  vehiclesInStock: 17,
  stockValue: 850000,
  salesThisMonth: 3,
  revenueThisMonth: 120000,
  salesLastMonth: 2,
  revenueLastMonth: 100000,

  avgSaleTicket: 40000,
  commissionThisMonth: 2000,
  commissionThisMonthKnownCount: 2,
  avgStockTicket: 50000,
  avgDaysInStock: 22,
  vehiclesInStockWithEntryDate: 10,
  vehiclesInStockMissingEntryDate: 7,

  salesHistorySales: SIX_MONTH_SALES,
  salesHistoryAvailableYears: [2026],
  salesHistoryEarliestDate: '2026-03-10',

  agingVehicles: [
    { id: 'v-old', brand: 'Fiat', model: 'Uno', plate: 'ABC1234', daysInStock: 75 },
    { id: 'v-mid', brand: 'Honda', model: 'Civic', plate: null, daysInStock: 35 },
  ],
  agingOver30: 2,
  agingOver60: 1,

  topSellingModel: { brand: 'Fiat', model: 'Uno', count: 4 },
  biggestSale: { vehicleLabel: 'Jeep Renegade', value: 95000, date: '2026-08-10' },
  fastestSale: { vehicleLabel: 'Honda Civic', days: 5, date: '2026-08-05' },

  recentActivity: [
    { id: 'a1', createdAt: '2026-08-20T10:00:00Z', actionLabel: 'Venda registrada', vehicleLabel: 'Fiat Uno', amount: 25900, note: null, saleId: 'sale-1' },
    { id: 'a2', createdAt: '2026-08-19T10:00:00Z', actionLabel: 'Veículo editado', vehicleLabel: 'Honda Civic', amount: null, note: null, saleId: null },
  ],
}

// Adds two prior years so the year selector and "Tudo" range have something
// real to show beyond the 6-month window.
const MULTI_YEAR_STATS: DashboardStats = {
  ...FULL_STATS,
  salesHistorySales: [
    ...SIX_MONTH_SALES,
    { sale_date: '2024-02-10', sale_value: 20000, commission_amount: null },
    { sale_date: '2025-05-15', sale_value: 45000, commission_amount: null },
  ],
  salesHistoryAvailableYears: [2026, 2025, 2024],
  salesHistoryEarliestDate: '2024-02-10',
}

function renderPage() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  )
}

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Only Date is mocked — setTimeout/setInterval stay real, so
    // findBy*/waitFor (which poll via real timers) keep working normally.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-08-29T12:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the principal KPIs from real data', async () => {
    mockedFetch.mockResolvedValue(FULL_STATS)
    renderPage()

    expect(await screen.findByText('17')).toBeInTheDocument()
    expect(screen.getByText(/R\$\s*850\.000,00/)).toBeInTheDocument()
    const revenueCard = screen.getByText('Faturamento do mês').closest('div')!
    expect(within(revenueCard).getByText(/R\$\s*120\.000,00/)).toBeInTheDocument()
    const salesCard = screen.getByText('Vendas do mês').closest('div')!
    expect(within(salesCard).getByText('3')).toBeInTheDocument()
  })

  it('shows a month-over-month delta only when there is a real base to compare', async () => {
    mockedFetch.mockResolvedValue(FULL_STATS)
    renderPage()

    expect(await screen.findByText(/▲ 20% vs\. mês passado/)).toBeInTheDocument()
  })

  it('omits the delta badge when last month has no sales to compare against', async () => {
    mockedFetch.mockResolvedValue({ ...FULL_STATS, revenueLastMonth: 0, salesLastMonth: 0 })
    renderPage()

    await screen.findByText('17')
    expect(screen.queryByText(/vs\. mês passado/)).not.toBeInTheDocument()
  })

  it('shows secondary KPIs with the missing-commission note', async () => {
    mockedFetch.mockResolvedValue(FULL_STATS)
    renderPage()

    expect(await screen.findByText('1 venda sem comissão informada')).toBeInTheDocument()
    expect(screen.getByText(/R\$\s*40\.000,00/)).toBeInTheDocument() // avg sale ticket
  })

  it('shows the sales-history period summary for the default 6-month range', async () => {
    mockedFetch.mockResolvedValue(FULL_STATS)
    renderPage()

    await screen.findByText('Histórico de vendas')
    const card = screen.getByText('Histórico de vendas').closest('section')!
    // 9 sales across Mar-Ago: 30000+70000+35000+100000+120000 = 355000
    expect(within(card).getByText('9')).toBeInTheDocument()
    expect(within(card).getByText(/R\$\s*355\.000,00/)).toBeInTheDocument()
  })

  it('toggles the sales-history chart between quantity and revenue', async () => {
    mockedFetch.mockResolvedValue(FULL_STATS)
    const user = userEvent.setup({ delay: null })
    renderPage()

    await screen.findByText('Histórico de vendas')
    const card = screen.getByText('Histórico de vendas').closest('section')!
    expect(within(card).getByText('3')).toBeInTheDocument() // Aug bar label, count mode
    await user.click(within(card).getByRole('button', { name: 'R$' }))
    expect(within(card).getAllByText(/R\$/).length).toBeGreaterThan(0)
  })

  it('shows a month detail on tap, with quantity, revenue, average ticket and known commission', async () => {
    mockedFetch.mockResolvedValue(FULL_STATS)
    const user = userEvent.setup({ delay: null })
    renderPage()

    await screen.findByText('Histórico de vendas')
    const card = screen.getByText('Histórico de vendas').closest('section')!
    await user.click(within(card).getByText('Ago'))

    const detail = within(card).getByText('3 vendas').closest('div')!
    expect(within(detail).getByText('3 vendas')).toBeInTheDocument()
    expect(within(detail).getByText(/R\$\s*120\.000,00/)).toBeInTheDocument()
    expect(within(detail).getByText(/Ticket médio/)).toBeInTheDocument()
    expect(within(detail).getByText(/Comissão: R\$\s*2\.000,00/)).toBeInTheDocument()
  })

  it('switches range with the preset pills, expanding beyond the 6-month window', async () => {
    mockedFetch.mockResolvedValue(MULTI_YEAR_STATS)
    const user = userEvent.setup({ delay: null })
    renderPage()

    await screen.findByText('Histórico de vendas')
    const card = screen.getByText('Histórico de vendas').closest('section')!
    await user.click(within(card).getByRole('button', { name: 'Tudo' }))

    // Tudo spans 2024-2026 now — the 2024 sale (20000) must show up in the total
    expect(within(card).getByText('11')).toBeInTheDocument() // 9 + 2 legacy sales
  })

  it('offers a year selector once more than one year is available', async () => {
    mockedFetch.mockResolvedValue(MULTI_YEAR_STATS)
    renderPage()
    await screen.findByText('Histórico de vendas')
    expect(screen.getByLabelText('Selecionar ano')).toBeInTheDocument()
  })

  it('does not offer a year selector for a single-year history', async () => {
    mockedFetch.mockResolvedValue(FULL_STATS)
    renderPage()
    await screen.findByText('Histórico de vendas')
    expect(screen.queryByLabelText('Selecionar ano')).not.toBeInTheDocument()
  })

  it('shows an empty state for the sales history within the default range', async () => {
    mockedFetch.mockResolvedValue(EMPTY_STATS)
    renderPage()

    expect(await screen.findByText('Nenhuma venda registrada nesse período.')).toBeInTheDocument()
  })

  it('shows a distinct empty state for "Tudo" when there has never been a sale', async () => {
    mockedFetch.mockResolvedValue(EMPTY_STATS)
    const user = userEvent.setup({ delay: null })
    renderPage()

    const card = await screen.findByText('Histórico de vendas').then((el) => el.closest('section')!)
    await user.click(within(card).getByRole('button', { name: 'Tudo' }))
    expect(within(card).getByText('Ainda não há vendas para mostrar histórico.')).toBeInTheDocument()
  })

  it('lists aging stock with +30/+60 day highlights and a link to the vehicle', async () => {
    mockedFetch.mockResolvedValue(FULL_STATS)
    renderPage()

    await screen.findByText('Estoque envelhecido')
    const aging = screen.getByText('Estoque envelhecido').closest('section')!
    expect(within(aging).getByText('Fiat Uno')).toBeInTheDocument()
    expect(within(aging).getByText('75 dias')).toBeInTheDocument()
    expect(within(aging).getByText('1 +60d')).toBeInTheDocument()
    expect(within(aging).getByText('2 +30d')).toBeInTheDocument()
    expect(within(aging).getByRole('link', { name: /Fiat Uno/ })).toHaveAttribute('href', '/estoque/v-old')
  })

  it('shows a plain-language empty state for aging when no vehicle has a known entry date', async () => {
    mockedFetch.mockResolvedValue(EMPTY_STATS)
    renderPage()

    expect(await screen.findByText(/Nenhum veículo em estoque tem data de entrada registrada/)).toBeInTheDocument()
  })

  it('shows highlights when there is enough sales data', async () => {
    mockedFetch.mockResolvedValue(FULL_STATS)
    renderPage()

    expect(await screen.findByText('Modelo mais vendido')).toBeInTheDocument()
    expect(screen.getByText('Jeep Renegade')).toBeInTheDocument()
    expect(screen.getByText('5 dias em estoque')).toBeInTheDocument()
  })

  it('shows an empty state for highlights with no sales yet', async () => {
    mockedFetch.mockResolvedValue(EMPTY_STATS)
    renderPage()

    expect(await screen.findByText('Ainda não há vendas suficientes para mostrar destaques.')).toBeInTheDocument()
  })

  it('lists recent activity with a link to Histórico', async () => {
    mockedFetch.mockResolvedValue(FULL_STATS)
    renderPage()

    await screen.findByText('Venda registrada')
    const recent = screen.getByText('Últimas movimentações').closest('section')!
    expect(within(recent).getByText(/Fiat Uno/)).toBeInTheDocument()
    expect(within(recent).getByRole('link', { name: 'Ver histórico' })).toHaveAttribute('href', '/historico')
  })

  it('shows a real error instead of fabricated numbers when the backend is unreachable', async () => {
    mockedFetch.mockRejectedValue(new Error('offline'))
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar/i)
  })
})
