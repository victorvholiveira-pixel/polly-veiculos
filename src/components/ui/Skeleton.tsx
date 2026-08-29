/** Bloco de loading compartilhado — mesma textura em toda tela com skeleton. */
export function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800 ${className}`} />
}
