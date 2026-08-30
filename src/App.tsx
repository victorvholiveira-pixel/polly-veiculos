import { RouterProvider } from 'react-router-dom'
import { UpdateToast } from '@/components/pwa/UpdateToast'
import { AuthProvider } from '@/context/AuthContext'
import { useAppUpdate } from '@/lib/pwa/useAppUpdate'
import { router } from '@/routes/router'

export function App() {
  const { showUpdatedToast } = useAppUpdate()
  return (
    <AuthProvider>
      <RouterProvider router={router} />
      <UpdateToast show={showUpdatedToast} />
    </AuthProvider>
  )
}
