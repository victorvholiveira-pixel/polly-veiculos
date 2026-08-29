import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HomePage } from '../HomePage'
import { fetchDashboardStats, type DashboardStats } from '@/lib/data/dashboard'

vi.mock('@/lib/data/dashboard', () => ({
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

  monthlyPerformance: [
    { month: '2026-03', label: 'Mar', salesCount: 0, revenue: 0 },
    { month: '2026-04', label: 'Abr', salesCount: 0, revenue: 0 },
    { month: '2026-05', label: 'Mai', salesCount: 0, revenue: 0 },
    { month: '2026-06', label: 'Jun', salesCount: 0, revenue: 0 },
    { month: '2026-07', label: 'Jul', salesCount: 0, revenue: 0 },
    { month: '2026-08', label: 'Ago', salesCount: 0, revenue: 0 },
  ],

  agingVehicles: [],
  agingOver30: 0,
  agingOver60: 0,

  topSellingModel: null,
  biggestSale: null,
  fastestSale: null,

  recentActivity: [],
}

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

  monthlyPerformance: [
    { month: '2026-03', label: 'Mar', salesCount: 1, revenue: 30000 },
    { month: '2026-04', label: 'Abr', salesCount: 0, revenue: 0 },
    { month: '2026-05', label: 'Mai', salesCount: 2, revenue: 70000 },
    { month: '2026-06', label: 'Jun', salesCount: 1, revenue: 35000 },
    { month: '2026-07', label: 'Jul', salesCount: 2, revenue: 100000 },
    { month: '2026-08', label: 'Ago', salesCount: 3, revenue: 120000 },
  ],

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
    { id: 'a1', createdAt: '2026-08-20T10:00:00Z', actionLabel: 'Venda registrada', vehicleLabel: 'Fiat Uno', amount: 25900, note: null },
    { id: 'a2', createdAt: '2026-08-19T10:00:00Z', actionLabel: 'Veículo editado', vehicleLabel: 'Honda Civic', amount: null, note: null },
  ],
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
  })

  it('renders the principal KPIs from real data', async () => {
    mockedFetch.mockResolvedValue(FULL_STATS)
    renderPage()

    expect(await screen.findByText('17')).toBeInTheDocument()
    expect(screen.getByText(/R\$\s*850\.000,00/)).toBeInTheDocument()
    expect(screen.getByText(/R\$\s*120\.000,00/)).toBeInTheDocument()
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

  it('toggles the performance chart between quantity and revenue', async () => {
    mockedFetch.mockResolvedValue(FULL_STATS)
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('Vendas nos últimos 6 meses')
    const chart = screen.getByText('Vendas nos últimos 6 meses').closest('section')!
    expect(within(chart).getByText('3')).toBeInTheDocument() // Aug bar label, count mode
    await user.click(within(chart).getByRole('button', { name: 'R$' }))
    expect(within(chart).getAllByText(/R\$/).length).toBeGreaterThan(0)
  })

  it('shows an empty state for the performance chart with no sales in the window', async () => {
    mockedFetch.mockResolvedValue(EMPTY_STATS)
    renderPage()

    expect(await screen.findByText('Nenhuma venda registrada nos últimos 6 meses ainda.')).toBeInTheDocument()
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
