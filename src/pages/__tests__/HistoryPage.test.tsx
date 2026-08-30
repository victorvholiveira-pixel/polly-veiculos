import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HistoryPage } from '../HistoryPage'
import { fetchSaleDetail, fetchSales, type SaleWithDetails } from '@/lib/data/sales'
import { loadReviewFixture } from '@/lib/data/reviewFixture'

vi.mock('@/lib/data/sales', () => ({
  fetchSales: vi.fn(),
  fetchSaleDetail: vi.fn(),
  cancelSale: vi.fn(),
}))
vi.mock('@/lib/data/reviewFixture', () => ({
  loadReviewFixture: vi.fn(),
}))

const mockedFetchSales = vi.mocked(fetchSales)
const mockedFetchSaleDetail = vi.mocked(fetchSaleDetail)
const mockedLoadFixture = vi.mocked(loadReviewFixture)

const ACTIVE_SALE: SaleWithDetails = {
  id: 'sale-1',
  vehicle_id: 'v1',
  seller_id: null,
  sale_date: '2026-08-20',
  customer_name: 'Maria Teste',
  customer_phone: null,
  sale_value: 25900,
  deal_type: null,
  trade_in_description: null,
  channel: null,
  commission_amount: 500,
  commission_percentage: null,
  commission_rule_snapshot: null,
  observations: null,
  status: 'completed',
  cancelled_reason: null,
  cancelled_at: null,
  source_occurrence_id: null,
  created_by: null,
  origin: 'app',
  created_at: '2026-08-20T00:00:00Z',
  updated_at: '2026-08-20T00:00:00Z',
  vehicle: { brand: 'Fiat', model: 'Uno', trim: null, plate: 'ABC1234' },
  sellerName: null,
}

function renderPage() {
  return render(
    <MemoryRouter>
      <HistoryPage />
    </MemoryRouter>,
  )
}

describe('HistoryPage', () => {
  beforeEach(() => {
    mockedLoadFixture.mockResolvedValue({
      summary: { reviewQueueTotal: 0, conflicts: 0, ambiguousSalesTotal: 0, otherReviewTotal: 0 },
      sales: { periodFrom: '2025-01-01', periodTo: '2026-08-01', validDate: 602, invalidDate: 23, ambiguous: 263 },
      currentInventory: [],
      conflicts: [],
      ambiguousSales: [],
      otherReview: [],
    } as never)
  })

  it('renders a real sale row', async () => {
    mockedFetchSales.mockResolvedValue([ACTIVE_SALE])
    renderPage()

    await screen.findByText('Fiat Uno')
    expect(screen.getByText('Maria Teste', { exact: false })).toBeInTheDocument()
  })

  it('marks a legacy (pre-app) sale distinctly, with vehicle info resolved from the migration record', async () => {
    mockedFetchSales.mockResolvedValue([
      {
        ...ACTIVE_SALE,
        id: 'sale-legacy',
        vehicle_id: null,
        source_occurrence_id: 'occ-1',
        origin: 'migration',
        vehicle: { brand: 'Honda', model: 'Civic', trim: 'LXR', plate: 'DEF5678' },
      },
    ])

    renderPage()

    expect(await screen.findByText('Honda Civic')).toBeInTheDocument()
    expect(screen.getByText('Antes do app')).toBeInTheDocument()
  })

  it('does not label a real app sale as legacy', async () => {
    mockedFetchSales.mockResolvedValue([ACTIVE_SALE])
    renderPage()

    await screen.findByText('Fiat Uno')
    expect(screen.queryByText('Antes do app')).not.toBeInTheDocument()
  })

  it('shows a cancelled sale as read-only in the list, with its reason', async () => {
    mockedFetchSales.mockResolvedValue([
      { ...ACTIVE_SALE, status: 'cancelled', cancelled_reason: 'Negócio desfeito', cancelled_at: '2026-08-21T00:00:00Z' },
    ])

    renderPage()

    expect(await screen.findByText(/Venda cancelada — Negócio desfeito/)).toBeInTheDocument()
  })

  it('opens the sale detail sheet when a sale is tapped', async () => {
    mockedFetchSales.mockResolvedValue([ACTIVE_SALE])
    mockedFetchSaleDetail.mockResolvedValue({ ...ACTIVE_SALE, vehicle: { brand: 'Fiat', model: 'Uno', trim: null, modelYear: 2020, plate: 'ABC1234' }, sellerName: null })
    const user = userEvent.setup()

    renderPage()

    await user.click(await screen.findByRole('button', { name: /Fiat Uno/ }))

    expect(mockedFetchSaleDetail).toHaveBeenCalledWith('sale-1')
    expect(await screen.findByRole('link', { name: 'Ver veículo' })).toBeInTheDocument()
  })
})
