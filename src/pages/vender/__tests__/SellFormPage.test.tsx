import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SellFormPage } from '../SellFormPage'
import { fetchActiveSellers, registerSale } from '@/lib/data/sales'
import { fetchVehicle, type Vehicle } from '@/lib/data/vehicles'

vi.mock('@/lib/data/sales', () => ({
  fetchActiveSellers: vi.fn(),
  createSeller: vi.fn(),
  registerSale: vi.fn(),
}))
vi.mock('@/lib/data/vehicles', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/data/vehicles')>()),
  fetchVehicle: vi.fn(),
}))

const mockedFetchVehicle = vi.mocked(fetchVehicle)
const mockedFetchSellers = vi.mocked(fetchActiveSellers)
const mockedRegisterSale = vi.mocked(registerSale)

const AVAILABLE_VEHICLE: Vehicle = {
  id: 'v1',
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
}

function renderPage(vehicleId = 'v1') {
  return render(
    <MemoryRouter initialEntries={[`/vender/${vehicleId}`]}>
      <Routes>
        <Route path="/vender/:vehicleId" element={<SellFormPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('SellFormPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('pre-fills the sale value with the asking price and registers the sale on submit', async () => {
    mockedFetchVehicle.mockResolvedValue(AVAILABLE_VEHICLE)
    mockedFetchSellers.mockResolvedValue([])
    mockedRegisterSale.mockResolvedValue({} as never)
    const user = userEvent.setup()

    renderPage()

    await screen.findByText('Vender Fiat Uno')
    expect(screen.getByLabelText(/Valor da venda/)).toHaveValue(25900)

    await user.type(screen.getByLabelText(/Comprador/), 'Maria Teste')
    await user.click(screen.getByRole('button', { name: 'Confirmar venda' }))

    await waitFor(() => expect(mockedRegisterSale).toHaveBeenCalledTimes(1))
    const input = mockedRegisterSale.mock.calls[0]![0]
    expect(input.vehicleId).toBe('v1')
    expect(input.saleValue).toBe(25900)
    expect(input.customerName).toBe('Maria Teste')
  })

  it('blocks the sale flow when the vehicle is no longer available', async () => {
    mockedFetchVehicle.mockResolvedValue({ ...AVAILABLE_VEHICLE, status: 'sold' })
    mockedFetchSellers.mockResolvedValue([])

    renderPage()

    expect(await screen.findByText(/não está mais disponível/i)).toBeInTheDocument()
    expect(mockedRegisterSale).not.toHaveBeenCalled()
  })
})
