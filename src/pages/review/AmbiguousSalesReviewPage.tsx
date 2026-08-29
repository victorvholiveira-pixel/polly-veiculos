import { useEffect, useState } from 'react'
import { DemoBanner } from '@/components/review/DemoBanner'
import { decideSale, fetchAmbiguousSales, type AmbiguousSaleItem } from '@/lib/data/saleReview'

const PAGE_SIZE = 30

function fmtBRL(n: number | null): string {
  return n === null ? 'Valor não informado' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function AmbiguousSalesReviewPage() {
  const [items, setItems] = useState<AmbiguousSaleItem[]>([])
  const [source, setSource] = useState<'live' | 'demo' | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Rendering all pending items at once got visibly slow past a couple
  // hundred cards — not a network issue, a DOM-size one. Simple "load more"
  // instead of a virtualized list: this screen is meant to be worked through
  // a page at a time anyway, not scanned all at once.
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  // `loading` starts `true` (see useState above); reloads after a decision
  // just refresh `items` in place, no full-page loading flash needed.
  const load = () => {
    fetchAmbiguousSales()
      .then((result) => {
        setItems(result.items)
        setSource(result.source)
      })
      .catch(() => setError('Não foi possível carregar as vendas incertas agora.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const decide = async (item: AmbiguousSaleItem, decision: 'approved' | 'rejected' | 'needs_followup') => {
    if (source !== 'live') {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, reviewDecision: decision } : i)))
      return
    }
    setBusyId(item.id)
    try {
      await decideSale(item.id, decision)
      load()
    } catch {
      setError('Não foi possível salvar essa decisão agora.')
    } finally {
      setBusyId(null)
    }
  }

  const pending = items.filter((i) => i.reviewDecision === 'pending')
  const visibleItems = items.slice(0, visibleCount)

  if (loading) return <p className="text-slate-500 dark:text-slate-400">Carregando…</p>

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Vendas incertas</h1>
        <p className="text-slate-500 dark:text-slate-400">
          Parecem vendas, mas a planilha não trouxe todos os detalhes. Nenhuma delas vira venda confirmada
          automaticamente — {pending.length} ainda esperando sua decisão.
        </p>
      </div>

      {source === 'demo' && <DemoBanner />}
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {items.length > PAGE_SIZE && (
        <p className="text-xs text-slate-400">Mostrando {visibleItems.length} de {items.length}</p>
      )}

      <ul className="space-y-3">
        {visibleItems.map((item) => (
          <li key={item.id} className="rounded-xl border border-amber-200 bg-white p-4 dark:border-amber-900 dark:bg-slate-900">
            <p className="font-medium text-slate-900 dark:text-slate-50">
              {[item.brand, item.model].filter(Boolean).join(' ') || 'Veículo não identificado'}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {item.plate ?? 'Sem placa'} · {fmtBRL(item.value)} · {item.period}
            </p>
            {item.buyer && <p className="text-sm text-slate-500 dark:text-slate-400">Comprador anotado: {item.buyer}</p>}
            <p className="text-xs text-slate-400">{item.sourceSheet} linha {item.sourceRow}</p>

            {item.warnings.length > 0 && (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">Por que ficou incerto: {item.warnings.join('; ')}</p>
            )}

            {item.reviewDecision === 'pending' ? (
              <div className="mt-3 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => decide(item, 'approved')}
                  disabled={busyId === item.id}
                  className="rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
                >
                  Confirmar venda
                </button>
                <button
                  type="button"
                  onClick={() => decide(item, 'rejected')}
                  disabled={busyId === item.id}
                  className="rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
                >
                  Não é venda
                </button>
                <button
                  type="button"
                  onClick={() => decide(item, 'needs_followup')}
                  disabled={busyId === item.id}
                  className="rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
                >
                  Deixar pendente
                </button>
              </div>
            ) : (
              <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">
                Decisão registrada: {item.reviewDecision === 'approved' ? 'venda confirmada' : item.reviewDecision === 'rejected' ? 'não é venda' : 'pendente para depois'}
              </p>
            )}
          </li>
        ))}
      </ul>

      {visibleCount < items.length && (
        <button
          type="button"
          onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
          className="w-full rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
        >
          Carregar mais ({items.length - visibleCount} restantes)
        </button>
      )}

      {items.length === 0 && <p className="text-slate-500 dark:text-slate-400">Nenhuma venda incerta encontrada.</p>}
    </div>
  )
}
