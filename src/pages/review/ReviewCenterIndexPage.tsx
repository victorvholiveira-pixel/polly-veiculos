import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchInventoryCandidates } from '@/lib/data/inventoryReview'
import { fetchAmbiguousSales } from '@/lib/data/saleReview'
import { loadReviewFixture } from '@/lib/data/reviewFixture'

interface GroupCounts {
  p0: number
  p1: number
  p2: number
  p3: number
}

const GROUPS = [
  {
    key: 'p0' as const,
    to: '/mais/revisao/estoque',
    title: 'Estoque atual',
    description: 'Os carros que a planilha mostra no pátio agora. Confirme cada um antes que vire estoque oficial.',
    tone: 'primary' as const,
  },
  {
    key: 'p1' as const,
    to: '/mais/revisao/conflitos',
    title: 'Possíveis conflitos',
    description: 'A mesma placa apareceu em dois carros que parecem diferentes. Isso precisa de um olhar humano.',
    tone: 'danger' as const,
  },
  {
    key: 'p2' as const,
    to: '/mais/revisao/vendas-ambiguas',
    title: 'Vendas incertas',
    description: 'Parecem vendas, mas faltam detalhes. Nada aqui vira venda confirmada sozinho.',
    tone: 'warning' as const,
  },
  {
    key: 'p3' as const,
    to: '/mais/revisao/outros',
    title: 'Outros itens para revisar',
    description: 'Casos onde não temos certeza se é o mesmo carro em meses diferentes.',
    tone: 'neutral' as const,
  },
]

const toneClasses: Record<string, string> = {
  primary: 'border-slate-300 dark:border-slate-700',
  danger: 'border-red-300 dark:border-red-900',
  warning: 'border-amber-300 dark:border-amber-900',
  neutral: 'border-slate-200 dark:border-slate-800',
}

export function ReviewCenterIndexPage() {
  const [counts, setCounts] = useState<GroupCounts | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchInventoryCandidates(), fetchAmbiguousSales(), loadReviewFixture()])
      .then(([inventory, sales, fixture]) => {
        if (cancelled) return
        setCounts({
          p0: inventory.items.filter((i) => i.reviewDecision === 'pending').length,
          p1: fixture.summary.conflicts,
          p2: sales.items.filter((i) => i.reviewDecision === 'pending').length,
          p3: fixture.summary.otherReviewTotal,
        })
      })
      .catch(() => !cancelled && setError(true))
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Revisão da Migração</h1>
        <p className="text-slate-500 dark:text-slate-400">
          Antes de virar dado oficial, cada informação vinda da planilha antiga passa por aqui. Comece pelo que
          tem mais impacto no dia a dia.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Não foi possível carregar os números agora. Você ainda pode abrir cada área abaixo.
        </p>
      )}

      <div className="space-y-3">
        {GROUPS.map((group) => (
          <Link
            key={group.key}
            to={group.to}
            className={`block rounded-xl border bg-white p-4 dark:bg-slate-900 ${toneClasses[group.tone]}`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium text-slate-900 dark:text-slate-50">{group.title}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {counts ? counts[group.key] : '…'}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{group.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
