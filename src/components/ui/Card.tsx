import type { ReactNode } from 'react'

/**
 * Wrapper visual compartilhado por Home e Estoque — mesma linguagem visual
 * (raio, borda, sombra) em todo o app. Extraído da Home (Onda 9) quando o
 * Estoque passou a precisar do mesmo padrão (Onda 12).
 */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}>
      {children}
    </section>
  )
}
