import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { BottomNav } from '@/components/layout/BottomNav'

describe('BottomNav', () => {
  it('renders all five navigation sections', () => {
    render(
      <MemoryRouter>
        <BottomNav />
      </MemoryRouter>,
    )

    for (const label of ['Início', 'Estoque', 'Vender', 'Histórico', 'Mais']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
    }
  })

  it('marks the current section as active', () => {
    render(
      <MemoryRouter initialEntries={['/estoque']}>
        <BottomNav />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Estoque' })).toHaveClass('text-slate-900')
    expect(screen.getByRole('link', { name: 'Início' })).not.toHaveClass('text-slate-900')
  })
})
