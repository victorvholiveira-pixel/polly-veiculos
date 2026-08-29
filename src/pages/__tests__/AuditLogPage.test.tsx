import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AuditLogPage } from '../AuditLogPage'
import { fetchAuditLog, type AuditLogEntry } from '@/lib/data/audit'

vi.mock('@/lib/data/audit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/data/audit')>()),
  fetchAuditLog: vi.fn(),
}))

const mockedFetch = vi.mocked(fetchAuditLog)

const ENTRY: AuditLogEntry = {
  id: 'log-1',
  entity_type: 'sale',
  entity_id: 'sale-1',
  action: 'sale_registered',
  actor: 'user-1',
  diff: { vehicle_id: 'v1', sale_value: 25900 },
  created_at: '2026-08-20T10:00:00Z',
}

describe('AuditLogPage', () => {
  it('renders a plain-language label for a known action and entity', async () => {
    mockedFetch.mockResolvedValue([ENTRY])
    render(<AuditLogPage />)

    expect(await screen.findByText('Venda registrada')).toBeInTheDocument()
    expect(screen.getByText('Venda')).toBeInTheDocument()
  })

  it('falls back to the raw action string for an unmapped action', async () => {
    mockedFetch.mockResolvedValue([{ ...ENTRY, action: 'algo_novo' }])
    render(<AuditLogPage />)

    expect(await screen.findByText('algo_novo')).toBeInTheDocument()
  })

  it('shows a real error instead of an empty screen when the fetch fails', async () => {
    mockedFetch.mockRejectedValue(new Error('offline'))
    render(<AuditLogPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar a auditoria/i)
  })
})
