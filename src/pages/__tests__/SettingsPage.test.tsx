import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsPage } from '../SettingsPage'
import { fetchAppSettings, updateDefaultCommissionPct } from '@/lib/data/settings'

vi.mock('@/lib/data/settings', () => ({
  fetchAppSettings: vi.fn(),
  updateDefaultCommissionPct: vi.fn(),
}))

const mockedFetch = vi.mocked(fetchAppSettings)
const mockedUpdate = vi.mocked(updateDefaultCommissionPct)

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads the current default commission and saves a new one', async () => {
    mockedFetch.mockResolvedValue({ id: true, default_commission_pct: 2, store_name: 'Polly Veículos', cnpj: null, updated_at: '' })
    mockedUpdate.mockResolvedValue({ id: true, default_commission_pct: 3, store_name: 'Polly Veículos', cnpj: null, updated_at: '' })
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
    mockedFetch.mockResolvedValue({ id: true, default_commission_pct: 2, store_name: 'Polly Veículos', cnpj: null, updated_at: '' })
    mockedUpdate.mockResolvedValue({ id: true, default_commission_pct: null, store_name: 'Polly Veículos', cnpj: null, updated_at: '' })
    const user = userEvent.setup()

    render(<SettingsPage />)

    const input = await screen.findByLabelText(/Comissão padrão/)
    await user.clear(input)
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(mockedUpdate).toHaveBeenCalledWith(null))
  })
})
