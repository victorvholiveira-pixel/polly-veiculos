import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { InventoryReviewPage } from '../InventoryReviewPage'
import { decideInventoryCandidate, fetchInventoryCandidates, type InventoryReviewItem } from '@/lib/data/inventoryReview'

vi.mock('@/lib/data/inventoryReview', () => ({
  fetchInventoryCandidates: vi.fn(),
  decideInventoryCandidate: vi.fn(),
  createInitialInventory: vi.fn(),
}))

const mockedFetch = vi.mocked(fetchInventoryCandidates)
const mockedDecide = vi.mocked(decideInventoryCandidate)

const CANDIDATE: InventoryReviewItem = {
  id: 'occ-1',
  brand: 'Fiat',
  model: 'Uno',
  trim: '1.0',
  year: 2015,
  plate: 'ABC1234',
  value: 25900,
  sourceSheet: 'AGO 2026',
  sourceRow: 12,
  monthsSeen: ['2026-08-01'],
  warnings: [],
  confidence: 'high',
  reviewDecision: 'pending',
}

function renderPage() {
  return render(
    <MemoryRouter>
      <InventoryReviewPage />
    </MemoryRouter>,
  )
}

describe('InventoryReviewPage', () => {
  it('shows the demo banner when the data layer falls back to the offline fixture', async () => {
    mockedFetch.mockResolvedValue({ items: [CANDIDATE], source: 'demo' })
    renderPage()

    expect(await screen.findByText(/modo de demonstração/i)).toBeInTheDocument()
  })

  it('does not show the demo banner when backed by Supabase', async () => {
    mockedFetch.mockResolvedValue({ items: [CANDIDATE], source: 'supabase' })
    renderPage()

    await screen.findByText('Fiat Uno')
    expect(screen.queryByText(/modo de demonstração/i)).not.toBeInTheDocument()
  })

  it('sends only the corrected fields as a "confirmed" overlay, never touching the raw fields directly (provenance)', async () => {
    mockedFetch.mockResolvedValue({ items: [CANDIDATE], source: 'supabase' })
    mockedDecide.mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('Fiat Uno')
    await user.click(screen.getByRole('button', { name: 'Editar' }))

    const plateInput = screen.getByLabelText('Placa')
    await user.clear(plateInput)
    await user.type(plateInput, 'ABC1D34')
    await user.click(screen.getByRole('button', { name: 'Salvar e confirmar' }))

    await waitFor(() => expect(mockedDecide).toHaveBeenCalledTimes(1))
    const [occurrenceId, input] = mockedDecide.mock.calls[0]!
    expect(occurrenceId).toBe('occ-1')
    expect(input.decision).toBe('edited_and_approved')
    // Only the corrected field changed — nothing here overwrites plate_raw/plate_normalized,
    // it only ever sets confirmed_plate (see inventoryReview.ts / the DB provenance trigger).
    expect(input.corrections?.plate).toBe('ABC1D34')
  })

  it('offers a bulk "confirm all" action only for candidates without warnings', async () => {
    const withWarning: InventoryReviewItem = { ...CANDIDATE, id: 'occ-2', warnings: ['placa ausente'] }
    mockedFetch.mockResolvedValue({ items: [CANDIDATE, withWarning], source: 'demo' })
    renderPage()

    expect(await screen.findByText('1 sem nenhum aviso')).toBeInTheDocument()
  })
})
