import { useEffect, useState } from 'react'
import { fetchDashboardStats, type DashboardStats } from '@/lib/data/dashboard'

function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function missingCommissionNote(count: number): string {
  return count === 1 ? '1 venda sem comissão informada' : `${count} vendas sem comissão informada`
}

function comparisonText(thisMonth: number, lastMonth: number): string {
  if (thisMonth === 0 && lastMonth === 0) return 'Sem vendas nos dois meses'
  if (lastMonth === 0) return 'Sem vendas no mês passado para comparar'
  const pct = Math.round(((thisMonth - lastMonth) / lastMonth) * 100)
  if (pct === 0) return 'Igual ao mês passado'
  return pct > 0 ? `▲ ${pct}% a mais que o mês passado` : `▼ ${Math.abs(pct)}% a menos que o mês passado`
}

export function HomePage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDashboardStats()
      .then(setStats)
      .catch(() => setError('Não foi possível carregar o painel agora. Confira a conexão e tente de novo.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Início</h1>
        <p className="text-slate-500 dark:text-slate-400">Resumo do estoque e das vendas deste mês.</p>
      </div>

      {loading && <p className="text-slate-500 dark:text-slate-400">Carregando…</p>}
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {stats && (
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Veículos em estoque" value={String(stats.vehiclesInStock)} />
          <Stat label="Valor do estoque" value={fmtBRL(stats.stockValue)} />
          <Stat label="Vendas do mês" value={String(stats.salesThisMonth)} />
          <Stat label="Faturamento do mês" value={fmtBRL(stats.revenueThisMonth)} />
          <Stat
            label="Comissão do mês"
            value={fmtBRL(stats.commissionThisMonth)}
            note={
              stats.commissionThisMonthKnownCount < stats.salesThisMonth
                ? missingCommissionNote(stats.salesThisMonth - stats.commissionThisMonthKnownCount)
                : undefined
            }
          />
          <Stat label="Comparado ao mês passado" value={comparisonText(stats.revenueThisMonth, stats.revenueLastMonth)} small />
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, note, small = false }: { label: string; value: string; note?: string; small?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={small ? 'text-sm font-semibold text-slate-900 dark:text-slate-50' : 'text-lg font-semibold text-slate-900 dark:text-slate-50'}>
        {value}
      </p>
      {note && <p className="mt-1 text-xs text-slate-400">{note}</p>}
    </div>
  )
}
