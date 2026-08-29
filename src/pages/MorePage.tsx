import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export function MorePage() {
  const { user, signOut } = useAuth()
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    setSigningOut(true)
    await signOut()
    // No manual navigation needed: losing the session makes ProtectedRoute
    // redirect to /login on its own.
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Mais</h1>
        <p className="text-slate-500 dark:text-slate-400">Configurações, revisão da migração e sua conta.</p>
      </div>

      <Link
        to="/mais/revisao"
        className="block rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
      >
        <p className="font-medium text-slate-900 dark:text-slate-50">Revisão da Migração</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">Confirme o estoque e resolva pendências vindas da planilha antiga.</p>
      </Link>

      <Link
        to="/mais/configuracoes"
        className="block rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
      >
        <p className="font-medium text-slate-900 dark:text-slate-50">Configurações</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">Comissão padrão sugerida e outros ajustes da loja.</p>
      </Link>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm text-slate-500 dark:text-slate-400">Conectado como</p>
        <p className="font-medium text-slate-900 dark:text-slate-50">{user?.email}</p>
      </div>

      <button
        type="button"
        onClick={handleSignOut}
        disabled={signingOut}
        className="w-full rounded-lg border border-red-200 py-2.5 text-base font-medium text-red-600 disabled:opacity-60 dark:border-red-900 dark:text-red-400"
      >
        {signingOut ? 'Saindo…' : 'Sair'}
      </button>
    </div>
  )
}
