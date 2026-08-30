import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StockListPage } from '../StockListPage'
import { fetchVehicles, type Vehicle } from '@/lib/data/vehicles'
import { fetchSales } from '@/lib/data/sales'

vi.mock('@/lib/data/vehicles', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/data/vehicles')>()),
  fetchVehicles: vi.fn(),
}))

// The "Vendidos" tab (SoldVehiclesView) is always mounted (just hidden via
// CSS, so switching tabs is instant) — it fetches sales on its own, which
// needs mocking here too even though these tests only exercise "Em estoque".
vi.mock('@/lib/data/sales', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/data/sales')>()),
  fetchSales: vi.fn(),
}))

const mockedFetch = vi.mocked(fetchVehicles)
const mockedFetchSales = vi.mocked(fetchSales)

function vehicle(overrides: Partial<Vehicle>): Vehicle {
  return {
    id: 'id',
    brand: 'Fiat',
    model: 'Uno',
    trim: null,
    model_year: 2015,
    manufacture_year: null,
    plate: 'ABC1234',
    plate_format: 'old',
    asking_price: 25900,
    entry_date: null,
    origin: 'manual',
    status: 'available',
    observations: null,
    founding_occurrence_id: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

// "Agora" congelado em 2026-08-29 — as datas de entrada abaixo caem em
// faixas conhecidas: Corolla=10d (normal), HR-V=42d (+30), Renegade=75d (+60).
const CAR_NORMAL = vehicle({ id: '1', brand: 'Toyota', model: 'Corolla', trim: 'XEi 2.0', model_year: 2020, plate: 'ABC1D23', asking_price: 94900, status: 'available', entry_date: '2026-08-19' })
const CAR_WARNING = vehicle({ id: '2', brand: 'Honda', model: 'HR-V', trim: 'EX CVT', model_year: 2021, plate: 'DEF4G56', asking_price: 118500, status: 'available', entry_date: '2026-07-18' })
const CAR_CRITICAL_RESERVED = vehicle({ id: '3', brand: 'Jeep', model: 'Renegade', trim: 'Longitude', model_year: 2019, plate: 'HIJ7K89', asking_price: 79900, status: 'reserved', entry_date: '2026-06-15' })
const CAR_NO_ENTRY_DATE = vehicle({ id: '4', brand: 'Fiat', model: 'Toro', trim: 'Volcano', model_year: 2022, plate: 'KLM3N45', asking_price: 142900, status: 'available', entry_date: null })
const CAR_SOLD = vehicle({ id: '5', brand: 'VW', model: 'Gol', status: 'sold', asking_price: 39900 })

const ALL_VEHICLES = [CAR_NORMAL, CAR_WARNING, CAR_CRITICAL_RESERVED, CAR_NO_ENTRY_DATE, CAR_SOLD]

function renderPage() {
  return render(
    <MemoryRouter>
      <StockListPage />
    </MemoryRouter>,
  )
}

describe('StockListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedFetchSales.mockResolvedValue([])
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-08-29T12:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows a loading skeleton before data arrives', () => {
    mockedFetch.mockReturnValue(new Promise(() => {}))
    const { container } = renderPage()
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument()
  })

  it('renders an honest error state when the fetch fails, with no fabricated data', async () => {
    mockedFetch.mockRejectedValue(new Error('network down'))
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar/i)
  })

  describe('with real data', () => {
    beforeEach(() => {
      mockedFetch.mockResolvedValue(ALL_VEHICLES)
    })

    it('computes the executive summary — count, total value and averages exclude sold vehicles', async () => {
      renderPage()
      expect(await screen.findByText('4')).toBeInTheDocument() // 4 active vehicles, sold one excluded
      // 94900 + 118500 + 79900 + 142900 = 436200
      expect(screen.getByText(/R\$\s*436\.200,00/)).toBeInTheDocument()
      expect(screen.getByText('+30 dias')).toBeInTheDocument()
      expect(screen.getByText('+60 dias')).toBeInTheDocument()
    })

    it('renders every card with brand, model, price, status and days in stock', async () => {
      renderPage()
      await screen.findByText(/Toyota Corolla/)
      expect(screen.getByText(/R\$\s*94\.900,00/)).toBeInTheDocument()
      expect(screen.getByText(/10 dias em estoque/)).toBeInTheDocument()
      expect(screen.getByText(/42 dias em estoque/)).toBeInTheDocument()
      expect(screen.getByText(/75 dias em estoque/)).toBeInTheDocument()
    })

    it('never invents an age for a vehicle without entry_date', async () => {
      renderPage()
      await screen.findByText(/Fiat Toro/)
      const card = screen.getByText(/Fiat Toro/).closest('li')!
      expect(within(card).getByText('Data de entrada não informada')).toBeInTheDocument()
      expect(within(card).queryByText(/dias em estoque/)).not.toBeInTheDocument()
    })

    it('never shows a sold vehicle in Estoque', async () => {
      renderPage()
      await screen.findByText(/Toyota Corolla/)
      expect(screen.queryByText(/Gol/)).not.toBeInTheDocument()
    })

    it('filters instantly by search across brand/model/trim/plate', async () => {
      const user = userEvent.setup({ delay: null })
      renderPage()
      await screen.findByText(/Toyota Corolla/)

      await user.type(screen.getByPlaceholderText(/buscar por marca/i), 'HR-V')
      expect(screen.getByText(/Honda HR-V/)).toBeInTheDocument()
      expect(screen.queryByText(/Toyota Corolla/)).not.toBeInTheDocument()
    })

    it('shows a friendly empty state for a search with no matches, with a way to clear it', async () => {
      const user = userEvent.setup({ delay: null })
      renderPage()
      await screen.findByText(/Toyota Corolla/)

      await user.type(screen.getByPlaceholderText(/buscar por marca/i), 'zzz-nao-existe')
      expect(await screen.findByText(/Nenhum veículo encontrado para "zzz-nao-existe"/)).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /limpar busca/i }))
      expect(await screen.findByText(/Toyota Corolla/)).toBeInTheDocument()
    })

    it('filters by chip (Reservados) and combines with search', async () => {
      const user = userEvent.setup({ delay: null })
      renderPage()
      await screen.findByText(/Toyota Corolla/)

      await user.click(screen.getByRole('button', { name: /Reservados · 1/ }))
      expect(screen.getByText(/Jeep Renegade/)).toBeInTheDocument()
      expect(screen.queryByText(/Toyota Corolla/)).not.toBeInTheDocument()
    })

    it('the +30/+60 chips carry the real count and a positively-framed empty state when zero', async () => {
      const user = userEvent.setup({ delay: null })
      renderPage()
      await screen.findByText(/Toyota Corolla/)

      expect(screen.getByRole('button', { name: /\+30 dias · 2/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /\+60 dias · 1/ })).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /\+60 dias · 1/ }))
      expect(screen.getByText(/Jeep Renegade/)).toBeInTheDocument()
      expect(screen.queryByText(/Toyota Corolla/)).not.toBeInTheDocument()
    })

    it('hides the +30/+60 dias filter chips entirely when nothing qualifies (não poluir) — the hero summary still shows the metric at zero', async () => {
      mockedFetch.mockResolvedValue([CAR_NORMAL])
      renderPage()
      await screen.findByText(/Toyota Corolla/)
      expect(screen.queryByRole('button', { name: /\+30 dias/ })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /\+60 dias/ })).not.toBeInTheDocument()
      // A Home mostra "Tempo médio em estoque" mesmo em 0 — o resumo do
      // Estoque segue o mesmo princípio para +30/+60 dias.
      expect(screen.getByText('+30 dias')).toBeInTheDocument()
      expect(screen.getByText('+60 dias')).toBeInTheDocument()
    })

    it('sorts by price via the sort sheet', async () => {
      const user = userEvent.setup({ delay: null })
      renderPage()
      await screen.findByText(/Toyota Corolla/)

      await user.click(screen.getByRole('button', { name: /ordenar/i }))
      await user.click(screen.getByText('Maior preço'))

      const names = screen.getAllByText(/Toyota Corolla|Honda HR-V|Jeep Renegade|Fiat Toro/).map((el) => el.textContent)
      // Fiat Toro (142.900) > Honda HR-V (118.500) > Toyota Corolla (94.900) > Jeep Renegade (79.900)
      expect(names[0]).toMatch(/Fiat Toro/)
      expect(names.at(-1)).toMatch(/Jeep Renegade/)
    })

    it('opens the per-card action menu with Ver detalhes/Editar, and Vender only when available', async () => {
      const user = userEvent.setup({ delay: null })
      renderPage()
      await screen.findByText(/Jeep Renegade/)

      await user.click(screen.getByRole('button', { name: /mais ações para jeep renegade/i }))
      expect(screen.getByText('Ver detalhes')).toBeInTheDocument()
      expect(screen.getByText('Editar')).toBeInTheDocument()
      // Reservado -> não pode vender
      expect(screen.queryByText('Vender')).not.toBeInTheDocument()
    })

    it('shows Vender in the action menu for an available vehicle', async () => {
      const user = userEvent.setup({ delay: null })
      renderPage()
      await screen.findByText(/Toyota Corolla/)

      await user.click(screen.getByRole('button', { name: /mais ações para toyota corolla/i }))
      expect(screen.getByText('Vender')).toBeInTheDocument()
    })
  })

  it('shows a call-to-action empty state when there are no vehicles at all', async () => {
    mockedFetch.mockResolvedValue([])
    renderPage()
    expect(await screen.findByText('Nenhum veículo cadastrado ainda.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /cadastrar veículo/i })).toBeInTheDocument()
  })

  describe('Em estoque / Vendidos toggle', () => {
    it('starts on Em estoque and switches to Vendidos without losing the stock view underneath', async () => {
      mockedFetch.mockResolvedValue(ALL_VEHICLES)
      mockedFetchSales.mockResolvedValue([])
      const user = userEvent.setup({ delay: null })
      renderPage()

      await screen.findByText(/Toyota Corolla/)
      expect(screen.getByRole('tab', { name: 'Em estoque' })).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByRole('link', { name: '+ Adicionar' })).toBeInTheDocument()

      await user.click(screen.getByRole('tab', { name: 'Vendidos' }))
      expect(screen.getByRole('tab', { name: 'Vendidos' })).toHaveAttribute('aria-selected', 'true')
      // "+ Adicionar" only makes sense for Em estoque
      expect(screen.queryByRole('link', { name: '+ Adicionar' })).not.toBeInTheDocument()
      expect(mockedFetchSales).toHaveBeenCalled()

      await user.click(screen.getByRole('tab', { name: 'Em estoque' }))
      // switching back doesn't need to refetch — the stock list is still there
      expect(await screen.findByText(/Toyota Corolla/)).toBeInTheDocument()
    })
  })
})
