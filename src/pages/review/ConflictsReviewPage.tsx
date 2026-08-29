import { useEffect, useState } from 'react'
import { DemoBanner } from '@/components/review/DemoBanner'
import { loadReviewFixture, type FixtureConflict } from '@/lib/data/reviewFixture'

type Decision = 'pending' | 'same_vehicle' | 'different_vehicles'

function fmtBRL(n: number | null): string {
  return n === null ? 'Valor não informado' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function ConflictsReviewPage() {
  const [conflicts, setConflicts] = useState<FixtureConflict[]>([])
  const [decisions, setDecisions] = useState<Record<number, Decision>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadReviewFixture()
      .then((f) => setConflicts(f.conflicts))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-slate-500 dark:text-slate-400">Carregando…</p>

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Possíveis conflitos</h1>
        <p className="text-slate-500 dark:text-slate-400">
          A mesma placa apareceu em dois registros que parecem ser carros diferentes. Nunca juntamos os dois
          sozinhos — decida você.
        </p>
      </div>

      <DemoBanner />

      <p className="text-sm text-slate-500 dark:text-slate-400">
        Sua decisão aqui será aplicada quando o histórico completo for importado, numa próxima etapa — por
        enquanto, nada é salvo.
      </p>

      <ul className="space-y-4">
        {conflicts.map((conflict, index) => {
          const decision = decisions[index] ?? 'pending'
          return (
            <li key={index} className="rounded-xl border border-red-200 bg-white p-4 dark:border-red-900 dark:bg-slate-900">
              <p className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                Placa em comum, marcas diferentes
              </p>

              <div className="space-y-3">
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                  <p className="font-medium text-slate-900 dark:text-slate-50">
                    {[conflict.occurrenceA.brand, conflict.occurrenceA.model].filter(Boolean).join(' ') || 'Não identificado'}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {conflict.occurrenceA.plate ?? 'Sem placa'} · {fmtBRL(conflict.occurrenceA.value)} · {conflict.occurrenceA.period}
                  </p>
                  <p className="text-xs text-slate-400">{conflict.occurrenceA.sourceSheet} linha {conflict.occurrenceA.sourceRow}</p>
                </div>

                <p className="text-center text-xs uppercase tracking-wide text-slate-400">e também</p>

                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                  <p className="text-sm text-slate-500 dark:text-slate-400">Outro registro com a mesma placa (ocorrência: {conflict.occurrenceBKey})</p>
                </div>
              </div>

              <div className="mt-3 space-y-1">
                {conflict.reasonsAgainst.map((reason, i) => (
                  <p key={i} className="text-xs text-red-700 dark:text-red-400">
                    ⚠ {reason}
                  </p>
                ))}
              </div>

              {decision === 'pending' ? (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDecisions((d) => ({ ...d, [index]: 'different_vehicles' }))}
                    className="flex-1 rounded-lg bg-slate-900 py-2 text-sm font-medium text-white dark:bg-slate-50 dark:text-slate-900"
                  >
                    São carros diferentes
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecisions((d) => ({ ...d, [index]: 'same_vehicle' }))}
                    className="flex-1 rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
                  >
                    É o mesmo carro
                  </button>
                </div>
              ) : (
                <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">
                  Marcado como: {decision === 'same_vehicle' ? 'mesmo carro' : 'carros diferentes'}
                </p>
              )}
            </li>
          )
        })}
      </ul>

      {conflicts.length === 0 && <p className="text-slate-500 dark:text-slate-400">Nenhum conflito encontrado.</p>}
    </div>
  )
}
