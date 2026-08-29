import { useEffect, useState } from 'react'
import { DemoBanner } from '@/components/review/DemoBanner'
import { loadReviewFixture, type FixtureReviewCandidate, type ReviewFixture } from '@/lib/data/reviewFixture'

function fmtBRL(n: number | null): string {
  return n === null ? 'Valor não informado' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function OtherReviewPage() {
  const [items, setItems] = useState<FixtureReviewCandidate[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadReviewFixture()
      .then((f: ReviewFixture) => {
        setItems(f.otherReview)
        setTotal(f.summary.otherReviewTotal)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-slate-500 dark:text-slate-400">Carregando…</p>

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Outros itens para revisar</h1>
        <p className="text-slate-500 dark:text-slate-400">
          {total} registro(s) onde não temos certeza se é o mesmo carro aparecendo em meses diferentes.
        </p>
      </div>

      <DemoBanner />

      {items.length < total && (
        <p className="text-xs text-slate-400">Mostrando {items.length} de {total} — o restante entra na próxima etapa de revisão.</p>
      )}

      <ul className="space-y-3">
        {items.map((entry, index) => (
          <li key={index} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="font-medium text-slate-900 dark:text-slate-50">
              {[entry.occurrence.brand, entry.occurrence.model].filter(Boolean).join(' ') || 'Não identificado'}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {entry.occurrence.plate ?? 'Sem placa'} · {fmtBRL(entry.occurrence.value)} · {entry.occurrence.period}
            </p>
            <p className="text-xs text-slate-400">{entry.occurrence.sourceSheet} linha {entry.occurrence.sourceRow}</p>
            {entry.reasonsFor.length > 0 && (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Parece com outro registro porque: {entry.reasonsFor.join('; ')}</p>
            )}
          </li>
        ))}
      </ul>

      {items.length === 0 && <p className="text-slate-500 dark:text-slate-400">Nada pendente por aqui.</p>}
    </div>
  )
}
