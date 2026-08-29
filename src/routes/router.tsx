import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AuditLogPage } from '@/pages/AuditLogPage'
import { HistoryPage } from '@/pages/HistoryPage'
import { HomePage } from '@/pages/HomePage'
import { LoginPage } from '@/pages/LoginPage'
import { MorePage } from '@/pages/MorePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { StockListPage } from '@/pages/estoque/StockListPage'
import { VehicleDetailPage } from '@/pages/estoque/VehicleDetailPage'
import { VehicleFormPage } from '@/pages/estoque/VehicleFormPage'
import { AmbiguousSalesReviewPage } from '@/pages/review/AmbiguousSalesReviewPage'
import { ConflictsReviewPage } from '@/pages/review/ConflictsReviewPage'
import { InventoryReviewPage } from '@/pages/review/InventoryReviewPage'
import { OtherReviewPage } from '@/pages/review/OtherReviewPage'
import { ReviewCenterIndexPage } from '@/pages/review/ReviewCenterIndexPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { SellFormPage } from '@/pages/vender/SellFormPage'
import { SellPickVehiclePage } from '@/pages/vender/SellPickVehiclePage'

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
      { path: '/estoque', element: <StockListPage /> },
      { path: '/estoque/novo', element: <VehicleFormPage /> },
      { path: '/estoque/:id', element: <VehicleDetailPage /> },
      { path: '/estoque/:id/editar', element: <VehicleFormPage /> },
      { path: '/vender', element: <SellPickVehiclePage /> },
      { path: '/vender/:vehicleId', element: <SellFormPage /> },
      { path: '/historico', element: <HistoryPage /> },
      { path: '/mais', element: <MorePage /> },
      { path: '/mais/configuracoes', element: <SettingsPage /> },
      { path: '/mais/auditoria', element: <AuditLogPage /> },
      { path: '/mais/revisao', element: <ReviewCenterIndexPage /> },
      { path: '/mais/revisao/estoque', element: <InventoryReviewPage /> },
      { path: '/mais/revisao/conflitos', element: <ConflictsReviewPage /> },
      { path: '/mais/revisao/vendas-ambiguas', element: <AmbiguousSalesReviewPage /> },
      { path: '/mais/revisao/outros', element: <OtherReviewPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
