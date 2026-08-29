import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Página não encontrada</h1>
      <Link to="/" className="text-slate-600 underline dark:text-slate-300">
        Voltar para o início
      </Link>
    </div>
  )
}
