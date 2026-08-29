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
  it('shows a loading state while the session is being recovered', () => {
    mockedUseAuth.mockReturnValue({
      session: null,
      user: null,
      loading: true,
      signOut: vi.fn(),
    })

    renderProtected()

    expect(screen.getByText(/carregando/i)).toBeInTheDocument()
  })

  it('redirects to /login when there is no session', () => {
    mockedUseAuth.mockReturnValue({
      session: null,
      user: null,
      loading: false,
      signOut: vi.fn(),
    })

    renderProtected()

    expect(screen.getByText('Tela de login')).toBeInTheDocument()
    expect(screen.queryByText('Conteúdo protegido')).not.toBeInTheDocument()
  })

  it('renders the protected content when a session exists', () => {
    // Only the fields ProtectedRoute actually reads (`session`, `loading`) matter here;
    // a full Session/User object isn't worth constructing for this test.
    mockedUseAuth.mockReturnValue({
      session: { user: { id: 'u1' } },
      user: { id: 'u1' },
      loading: false,
      signOut: vi.fn(),
    } as unknown as ReturnType<typeof useAuth>)

    renderProtected()

    expect(screen.getByText('Conteúdo protegido')).toBeInTheDocument()
  })
})
