import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

interface NavItem {
  to: string
  label: string
  icon: ReactNode
}

// Minimal hand-drawn icons — no icon library needed for five glyphs.
const icons = {
  home: (
    <path d="M3 11.5 12 4l9 7.5M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
  ),
  stock: <path d="M4 7l8-4 8 4-8 4-8-4Zm0 0v10l8 4 8-4V7M4 7l8 4m0 0 8-4m-8 4v10" />,
  sell: <path d="M12 5v14M5 12h14" />,
  history: <path d="M3 12a9 9 0 1 0 3-6.7M3 12V6m0 6h6M12 7v5l3 3" />,
  more: <path d="M5 12h.01M12 12h.01M19 12h.01" />,
} as const

const items: NavItem[] = [
  { to: '/', label: 'Início', icon: icons.home },
  { to: '/estoque', label: 'Estoque', icon: icons.stock },
  { to: '/vender', label: 'Vender', icon: icons.sell },
  { to: '/historico', label: 'Histórico', icon: icons.history },
  { to: '/mais', label: 'Mais', icon: icons.more },
]

export function BottomNav() {
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-lg">
        {items.map((item) => (
          <li key={item.to} className="flex-1">
            <NavLink
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium ${
                  isActive
                    ? 'text-slate-900 dark:text-slate-50'
                    : 'text-slate-400 dark:text-slate-500'
                }`
              }
            >
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {item.icon}
              </svg>
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
