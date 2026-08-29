interface PagePlaceholderProps {
  title: string
  description: string
}

/**
 * Informative empty state for a section whose real feature ships in a later
 * wave (Onda 1 is foundation only — see ROADMAP.md). Not a "coming soon"
 * dead end: it tells the user exactly what this section is for.
 */
export function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">{title}</h1>
      <p className="text-slate-500 dark:text-slate-400">{description}</p>
    </div>
  )
}
