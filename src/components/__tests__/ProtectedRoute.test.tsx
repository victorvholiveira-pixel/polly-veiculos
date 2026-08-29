import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { useAuth } from '@/context/AuthContext'

vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(),
}))

const mockedUseAuth = vi.mocked(useAuth)

function renderProtected(initialPath = '/estoque') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<p>Tela de login</p>} />
        <Route
          path="/estoque"
          element={
            <ProtectedRoute>
              <p>Conteúdo protegido</p>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ProtectedRoute', () => {
  it('redirects to /login when there is no session', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      login: vi.fn(),
      signOut: vi.fn(),
    })

    renderProtected()

    expect(screen.getByText('Tela de login')).toBeInTheDocument()
    expect(screen.queryByText('Conteúdo protegido')).not.toBeInTheDocument()
  })

  it('renders the protected content when a session exists', () => {
    mockedUseAuth.mockReturnValue({
      user: { name: 'Victor' },
      login: vi.fn(),
      signOut: vi.fn(),
    })

    renderProtected()

    expect(screen.getByText('Conteúdo protegido')).toBeInTheDocument()
  })
})
