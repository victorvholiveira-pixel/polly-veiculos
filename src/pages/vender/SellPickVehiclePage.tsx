import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchVehicles, searchVehicles, type Vehicle } from '@/lib/data/vehicles'

function fmtBRL(n: number | null): string {
  return n === null ? 'Sem preço' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Passo 1 do fluxo Vender: escolher qual veículo disponível será vendido. */
export function SellPickVehiclePage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchVehicles('available')
      .then(setVehicles)
      .catch(() => setError('Não foi possível carregar o estoque agora. Confira a conexão e tente de novo.'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => searchVehicles(vehicles, query), [vehicles, query])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Vender</h1>
        <p className="text-slate-500 dark:text-slate-400">Escolha o veículo para registrar a venda.</p>
      </div>

      <input
        type="search"
        placeholder="Buscar por placa, marca ou modelo"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
      />

      {loading && <p className="text-slate-500 dark:text-slate-400">Carregando…</p>}
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {!loading && !error && filtered.length === 0 && (
        <p className="text-slate-500 dark:text-slate-400">
          {vehicles.length === 0 ? 'Nenhum veículo disponível para vender agora.' : 'Nada encontrado para essa busca.'}
        </p>
      )}

      <ul className="space-y-3">
        {filtered.map((v) => (
          <li key={v.id}>
            <Link
              to={`/vender/${v.id}`}
              className="block rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
            >
              <p className="font-medium text-slate-900 dark:text-slate-50">
                {v.brand} {v.model}
              </p>
              {v.trim && <p className="text-sm text-slate-500 dark:text-slate-400">{v.trim}</p>}
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {v.model_year ?? 'Ano não informado'} · {v.plate ?? 'Placa não informada'}
              </p>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-50">{fmtBRL(v.asking_price)}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
