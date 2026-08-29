import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { HistoryPage } from '@/pages/HistoryPage'
import { HomePage } from '@/pages/HomePage'
import { LoginPage } from '@/pages/LoginPage'
import { MorePage } from '@/pages/MorePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { SellPage } from '@/pages/SellPage'
import { StockPage } from '@/pages/StockPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/estoque', element: <StockPage /> },
      { path: '/vender', element: <SellPage /> },
      { path: '/historico', element: <HistoryPage /> },
      { path: '/mais', element: <MorePage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
