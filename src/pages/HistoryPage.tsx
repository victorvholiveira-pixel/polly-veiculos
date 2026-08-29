import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { cancelSale, fetchSales, type SaleWithDetails } from '@/lib/data/sales'
import { loadReviewFixture, type ReviewFixture } from '@/lib/data/reviewFixture'

function fmtBRL(n: number | null): string {
  return n === null ? 'Valor não informado' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDate(iso: string): string {
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}

function fmtPeriod(iso: string | null): string {
  if (!iso) return '—'
  const [year, month] = iso.split('-')
  return `${month}/${year}`
}

function matchesQuery(sale: SaleWithDetails, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [sale.vehicle?.brand, sale.vehicle?.model, sale.vehicle?.plate, sale.customer_name].some((field) =>
    field?.toLowerCase().includes(q),
  )
}

export function HistoryPage() {
  const [sales, setSales] = useState<SaleWithDetails[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cancelingId, setCancelingId] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [migrationSummary, setMigrationSummary] = useState<ReviewFixture['sales'] | null>(null)

  const load = () => {
    fetchSales()
      .then(setSales)
      .catch(() => setError('Não foi possível carregar o histórico agora. Confira a conexão e tente de novo.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    loadReviewFixture()
      .then((f) => setMigrationSummary(f.sales))
      .catch(() => setMigrationSummary(null))
  }, [])

  const filtered = useMemo(() => sales.filter((s) => matchesQuery(s, query)), [sales, query])

  const confirmCancel = async (saleId: string) => {
    if (!reason.trim()) return
    setBusyId(saleId)
    try {
      await cancelSale(saleId, reason.trim())
      setCancelingId(null)
      setReason('')
      load()
    } catch {
      setError('Não foi possível cancelar essa venda agora.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Histórico</h1>
        <p className="text-slate-500 dark:text-slate-400">Vendas registradas no app, da mais recente para a mais antiga.</p>
      </div>

      <input
        type="search"
        placeholder="Buscar por comprador, placa, marca ou modelo"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
      />

      {loading && <p className="text-slate-500 dark:text-slate-400">Carregando…</p>}
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {!loading && !error && filtered.length === 0 && (
        <p className="text-slate-500 dark:text-slate-400">
          {sales.length === 0 ? 'Nenhuma venda registrada ainda.' : 'Nada encontrado para essa busca.'}
        </p>
      )}

      <ul className="space-y-3">
        {filtered.map((sale) => (
          <li key={sale.id} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-50">
                  {sale.vehicle ? `${sale.vehicle.brand} ${sale.vehicle.model}` : 'Veículo removido'}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {sale.vehicle?.plate ?? 'Placa não informada'} · {fmtDate(sale.sale_date)}
                </p>
              </div>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-50">{fmtBRL(sale.sale_value)}</p>
            </div>

            {sale.customer_name && (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Comprador: {sale.customer_name}</p>
            )}
            {sale.sellerName && <p className="text-sm text-slate-500 dark:text-slate-400">Vendedor: {sale.sellerName}</p>}
            {sale.commission_amount !== null && (
              <p className="text-sm text-slate-500 dark:text-slate-400">Comissão: {fmtBRL(sale.commission_amount)}</p>
            )}

            {sale.status === 'cancelled' ? (
              <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">
                Venda cancelada{sale.cancelled_reason ? ` — ${sale.cancelled_reason}` : ''}
              </p>
            ) : cancelingId === sale.id ? (
              <div className="mt-3 space-y-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Motivo do cancelamento
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCancelingId(null)
                      setReason('')
                    }}
                    className="rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={() => confirmCancel(sale.id)}
                    disabled={!reason.trim() || busyId === sale.id}
                    className="rounded-lg bg-red-600 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    Confirmar cancelamento
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCancelingId(sale.id)}
                className="mt-3 w-full rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
              >
                Cancelar venda
              </button>
            )}
          </li>
        ))}
      </ul>

      {migrationSummary && (
        <details className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <summary className="cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-300">
            Período em validação (planilha antiga)
          </summary>
          <div className="mt-3 space-y-3">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              O histórico da planilha antiga ainda não virou dado oficial do sistema — nada aqui aparece misturado
              com as vendas acima até passar pela revisão.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Período da planilha" value={`${fmtPeriod(migrationSummary.periodFrom)} – ${fmtPeriod(migrationSummary.periodTo)}`} />
              <Stat label="Vendas com data confiável" value={String(migrationSummary.validDate)} />
              <Stat label="Data pendente de revisão" value={String(migrationSummary.invalidDate)} />
              <Stat label="Ainda incertas" value={String(migrationSummary.ambiguous)} />
            </div>
            <Link
              to="/mais/revisao/vendas-ambiguas"
              className="block rounded-lg border border-slate-300 py-2.5 text-center text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
            >
              Ajudar a revisar vendas incertas
            </Link>
          </div>
        </details>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-lg font-semibold text-slate-900 dark:text-slate-50">{value}</p>
    </div>
  )
}
