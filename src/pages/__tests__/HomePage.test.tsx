import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HomePage } from '../HomePage'
import { fetchDashboardStats, type DashboardStats } from '@/lib/data/dashboard'

vi.mock('@/lib/data/dashboard', () => ({
  fetchDashboardStats: vi.fn(),
}))

const mockedFetch = vi.mocked(fetchDashboardStats)

const BASE_STATS: DashboardStats = {
  vehiclesInStock: 17,
  stockValue: 850000,
  salesThisMonth: 3,
  revenueThisMonth: 120000,
  commissionThisMonth: 2000,
  commissionThisMonthKnownCount: 2,
  revenueLastMonth: 100000,
}

describe('HomePage', () => {
  it('renders the 6 approved indicators from real data', async () => {
    mockedFetch.mockResolvedValue(BASE_STATS)
    render(<HomePage />)

    expect(await screen.findByText('17')).toBeInTheDocument()
    expect(screen.getByText(/R\$\s*850\.000,00/)).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText(/R\$\s*120\.000,00/)).toBeInTheDocument()
    expect(screen.getByText('▲ 20% a mais que o mês passado')).toBeInTheDocument()
    expect(screen.getByText('1 venda sem comissão informada')).toBeInTheDocument()
  })

  it('shows a plain message instead of a percentage when there is nothing to compare', async () => {
    mockedFetch.mockResolvedValue({ ...BASE_STATS, revenueLastMonth: 0 })
    render(<HomePage />)

    expect(await screen.findByText('Sem vendas no mês passado para comparar')).toBeInTheDocument()
  })

  it('shows a real error instead of fabricated numbers when the backend is unreachable', async () => {
    mockedFetch.mockRejectedValue(new Error('offline'))
    render(<HomePage />)

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar/i)
  })
})
