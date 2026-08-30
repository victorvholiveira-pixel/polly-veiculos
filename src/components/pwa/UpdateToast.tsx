/** Discreet, non-blocking confirmation after a controlled auto-update reload — never the update mechanism itself. */
export function UpdateToast({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-30 flex justify-center px-4"
      style={{ top: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
    >
      <p
        role="status"
        className="pointer-events-auto rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-lg dark:bg-slate-50 dark:text-slate-900"
      >
        Polly atualizado ✓
      </p>
    </div>
  )
}
