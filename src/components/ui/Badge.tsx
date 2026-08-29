import type { ReactNode } from 'react'

const TONES = {
  danger: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  neutral: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
} as const

export type BadgeTone = keyof typeof TONES

export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}>{children}</span>
}
