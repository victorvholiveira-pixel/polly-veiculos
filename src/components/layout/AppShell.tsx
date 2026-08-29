import { Outlet } from 'react-router-dom'
import { BottomNav } from '@/components/layout/BottomNav'

export function AppShell() {
  return (
    <div className="min-h-screen bg-slate-50 pb-20 dark:bg-slate-950">
      <main className="mx-auto max-w-lg px-4 py-6">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
