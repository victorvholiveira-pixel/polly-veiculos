import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsPage } from '../SettingsPage'
import { fetchSales } from '@/lib/data/sales'
import { fetchAppSettings, updateDefaultCommissionPct } from '@/lib/data/settings'
import { fetchVehicles } from '@/lib/data/vehicles'
import { exportVehiclesCSV } from '@/lib/export'

vi.mock('@/lib/data/settings', () => ({
  fetchAppSettings: vi.fn(),
  updateDefaultCommissionPct: vi.fn(),
}))
vi.mock('@/lib/data/vehicles', () => ({
  fetchVehicles: vi.fn(),
}))
vi.mock('@/lib/data/sales', () => ({
  fetchSales: vi.fn(),
}))
vi.mock('@/lib/export', () => ({
  exportVehiclesCSV: vi.fn(),
  exportVehiclesJSON: vi.fn(),
  exportSalesCSV: vi.fn(),
  exportSalesJSON: vi.fn(),
}))

const mockedFetch = vi.mocked(fetchAppSettings)
const mockedUpdate = vi.mocked(updateDefaultCommissionPct)
const mockedFetchVehicles = vi.mocked(fetchVehicles)
const mockedFetchSales = vi.mocked(fetchSales)
const mockedExportVehiclesCSV = vi.mocked(exportVehiclesCSV)

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads the current default commission and saves a new one', async () => {
    mockedFetch.mockResolvedValue({ id: 'true', default_commission_pct: 2, store_name: 'Polly Veículos', cnpj: null, updated_at: '' })
    mockedUpdate.mockResolvedValue({ id: 'true', default_commission_pct: 3, store_name: 'Polly Veículos', cnpj: null, updated_at: '' })
    const user = userEvent.setup()

    render(<SettingsPage />)

    const input = await screen.findByLabelText(/Comissão padrão/)
    expect(input).toHaveValue(2)

    await user.clear(input)
    await user.type(input, '3')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(mockedUpdate).toHaveBeenCalledWith(3))
    expect(await screen.findByText('Salvo.')).toBeInTheDocument()
  })

  it('sends null when the field is cleared, instead of inventing a value', async () => {
    mockedFetch.mockResolvedValue({ id: 'true', default_commission_pct: 2, store_name: 'Polly Veículos', cnpj: null, updated_at: '' })
    mockedUpdate.mockResolvedValue({ id: 'true', default_commission_pct: null, store_name: 'Polly Veículos', cnpj: null, updated_at: '' })
    const user = userEvent.setup()

    render(<SettingsPage />)

    const input = await screen.findByLabelText(/Comissão padrão/)
    await user.clear(input)
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(mockedUpdate).toHaveBeenCalledWith(null))
  })

  it('exports the full vehicle list (not just what a filtered screen shows) as CSV', async () => {
    mockedFetch.mockResolvedValue({ id: 'true', default_commission_pct: null, store_name: 'Polly Veículos', cnpj: null, updated_at: '' })
    mockedFetchVehicles.mockResolvedValue([])
    const user = userEvent.setup()

    render(<SettingsPage />)
    await screen.findByLabelText(/Comissão padrão/)

    await user.click(screen.getByRole('button', { name: 'Estoque (CSV)' }))

    await waitFor(() => expect(mockedFetchVehicles).toHaveBeenCalledWith('all'))
    expect(mockedExportVehiclesCSV).toHaveBeenCalledWith([])
  })

  it('shows a real error instead of a broken download when the export fetch fails', async () => {
    mockedFetch.mockResolvedValue({ id: 'true', default_commission_pct: null, store_name: 'Polly Veículos', cnpj: null, updated_at: '' })
    mockedFetchSales.mockRejectedValue(new Error('offline'))
    const user = userEvent.setup()

    render(<SettingsPage />)
    await screen.findByLabelText(/Comissão padrão/)

    await user.click(screen.getByRole('button', { name: 'Histórico (JSON)' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível gerar o arquivo/i)
  })
})
