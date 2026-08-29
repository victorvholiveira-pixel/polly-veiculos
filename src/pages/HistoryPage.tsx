import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadReviewFixture, type ReviewFixture } from '@/lib/data/reviewFixture'

function fmtPeriod(iso: string | null): string {
  if (!iso) return '—'
  const [year, month] = iso.split('-')
  return `${month}/${year}`
}

export function HistoryPage() {
  const [sales, setSales] = useState<ReviewFixture['sales'] | null>(null)

  useEffect(() => {
    loadReviewFixture()
      .then((f) => setSales(f.sales))
      .catch(() => setSales(null))
  }, [])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Histórico em validação</h1>
        <p className="text-slate-500 dark:text-slate-400">
          O histórico da planilha antiga ainda não virou dado oficial do sistema. Nada aqui é uma venda
          confirmada até passar pela revisão.
        </p>
      </div>

      {sales && (
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Período da planilha" value={`${fmtPeriod(sales.periodFrom)} – ${fmtPeriod(sales.periodTo)}`} />
          <Stat label="Vendas com data confiável" value={String(sales.validDate)} />
          <Stat label="Data pendente de revisão" value={String(sales.invalidDate)} />
          <Stat label="Ainda incertas" value={String(sales.ambiguous)} />
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          As vendas com data confiável são as mais próximas de virar histórico oficial, mas a importação
          completa ainda não aconteceu — é uma decisão separada, feita com calma, depois que a revisão
          terminar.
        </p>
      </div>

      <Link
        to="/mais/revisao/vendas-ambiguas"
        className="block rounded-lg border border-slate-300 py-2.5 text-center text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
      >
        Ajudar a revisar vendas incertas
      </Link>
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
