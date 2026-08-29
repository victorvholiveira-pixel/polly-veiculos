import { useEffect, useState, type FormEvent } from 'react'
import { fetchAppSettings, updateDefaultCommissionPct } from '@/lib/data/settings'

export function SettingsPage() {
  const [pct, setPct] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetchAppSettings()
      .then((s) => setPct(s.default_commission_pct?.toString() ?? ''))
      .catch(() => setError('Não foi possível carregar as configurações agora.'))
      .finally(() => setLoading(false))
  }, [])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      await updateDefaultCommissionPct(pct.trim() ? Number(pct) : null)
      setSaved(true)
    } catch {
      setError('Não foi possível salvar agora. Confira a conexão e tente de novo.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-slate-500 dark:text-slate-400">Carregando…</p>

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Configurações</h1>
        <p className="text-slate-500 dark:text-slate-400">Ajustes gerais da loja.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Comissão padrão (%)
          <input
            type="number"
            step="0.01"
            value={pct}
            onChange={(e) => {
              setPct(e.target.value)
              setSaved(false)
            }}
            placeholder="Não configurado"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base font-normal text-slate-900 outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
          />
        </label>
        <p className="text-xs text-slate-400">
          Usado só para sugerir um valor de comissão ao registrar uma venda — nunca aplicado sozinho, e sempre editável
          venda a venda. Deixe em branco para não sugerir nada.
        </p>

        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {saved && !error && <p className="text-sm text-emerald-600 dark:text-emerald-400">Salvo.</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-slate-900 py-2.5 text-base font-medium text-white disabled:opacity-60 dark:bg-slate-50 dark:text-slate-900"
        >
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
      </form>
    </div>
  )
}
