import type { ReactNode } from 'react'

/**
 * Painel deslizante do fundo da tela — para menus contextuais curtos em
 * mobile (ordenação, ações de um card) sem precisar de uma barra cheia de
 * selects nem de três botões grandes competindo por espaço. Fecha ao tocar
 * fora ou ao escolher uma opção.
 */
export function ActionSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Fechar" onClick={onClose} className="absolute inset-0 bg-slate-900/40" />
      <div
        className="relative w-full max-w-lg rounded-t-2xl border-t border-slate-200 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-900"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        {title && <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>}
        {children}
      </div>
    </div>
  )
}

export function ActionSheetItem({
  onClick,
  active,
  tone = 'default',
  children,
}: {
  onClick: () => void
  active?: boolean
  tone?: 'default' | 'danger'
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="menuitemradio"
      aria-checked={active}
      className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-medium ${
        tone === 'danger'
          ? 'text-red-600 dark:text-red-400'
          : active
            ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-50'
            : 'text-slate-700 dark:text-slate-200'
      }`}
    >
      {children}
      {active && <span aria-hidden="true">✓</span>}
    </button>
  )
}
