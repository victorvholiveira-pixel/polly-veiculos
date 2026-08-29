import { useEffect, useMemo, useState } from 'react'
import { DemoBanner } from '@/components/review/DemoBanner'
import {
  createInitialInventory,
  decideInventoryCandidate,
  fetchInventoryCandidates,
  type InventoryReviewItem,
} from '@/lib/data/inventoryReview'

function fmtBRL(n: number | null): string {
  if (n === null) return 'Valor não informado'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function vehicleTitle(item: InventoryReviewItem): string {
  const parts = [item.brand, item.model].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : 'Veículo não identificado'
}

interface EditState {
  brand: string
  model: string
  trim: string
  year: string
  plate: string
  value: string
}

function toEditState(item: InventoryReviewItem): EditState {
  return {
    brand: item.brand ?? '',
    model: item.model ?? '',
    trim: item.trim ?? '',
    year: item.year?.toString() ?? '',
    plate: item.plate ?? '',
    value: item.value?.toString() ?? '',
  }
}

export function InventoryReviewPage() {
  const [items, setItems] = useState<InventoryReviewItem[]>([])
  const [source, setSource] = useState<'supabase' | 'demo' | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [batchBusy, setBatchBusy] = useState(false)
  const [batchResult, setBatchResult] = useState<string | null>(null)

  // `loading` starts `true` (see useState above); reloads after a decision
  // just refresh `items` in place, no full-page loading flash needed.
  const load = () => {
    fetchInventoryCandidates()
      .then((result) => {
        setItems(result.items)
        setSource(result.source)
        setError(null)
      })
      .catch((err: unknown) =>
        setError(
          err instanceof Error
            ? `Não foi possível carregar os candidatos de estoque: ${err.message}`
            : 'Não foi possível carregar os candidatos de estoque agora.',
        ),
      )
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const pending = items.filter((i) => i.reviewDecision === 'pending')
  const decided = items.filter((i) => i.reviewDecision !== 'pending')
  const safeForBulk = useMemo(() => pending.filter((i) => i.warnings.length === 0), [pending])

  const applyDecision = async (item: InventoryReviewItem, decision: 'approved' | 'rejected' | 'edited_and_approved', corrections?: EditState) => {
    if (source !== 'supabase') {
      // Demo mode: reflect the choice locally only — nothing is persisted.
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, reviewDecision: decision } : i)))
      setEditingId(null)
      return
    }
    setBusyId(item.id)
    try {
      await decideInventoryCandidate(item.id, {
        decision,
        corrections: corrections
          ? {
              brand: corrections.brand || undefined,
              model: corrections.model || undefined,
              trim: corrections.trim || undefined,
              year: corrections.year ? Number(corrections.year) : undefined,
              plate: corrections.plate || undefined,
              value: corrections.value ? Number(corrections.value) : undefined,
            }
          : undefined,
      })
      load()
      setEditingId(null)
    } catch {
      setError('Não foi possível salvar essa decisão agora. Tente de novo em instantes.')
    } finally {
      setBusyId(null)
    }
  }

  const confirmAllSafe = async () => {
    if (source !== 'supabase') {
      setItems((prev) => prev.map((i) => (i.warnings.length === 0 && i.reviewDecision === 'pending' ? { ...i, reviewDecision: 'approved' } : i)))
      return
    }
    setBatchBusy(true)
    try {
      for (const item of safeForBulk) {
        await decideInventoryCandidate(item.id, { decision: 'approved' })
      }
      load()
    } catch {
      setError('Parte da confirmação em lote falhou. Confira a lista antes de tentar de novo.')
    } finally {
      setBatchBusy(false)
    }
  }

  // TEMPORÁRIO — ferramenta de cutover (ver conversa/commit). Confirma TODOS
  // os pendentes com os dados exatamente como vieram da planilha, avisos
  // inclusive — nenhuma correção automática. Diferente de "Confirmar todos
  // sem avisos" (que só pega os sem aviso), esta existe só para destravar o
  // cutover do estoque atual quando o ambiente de operação (SQL Editor pelo
  // celular) não é confiável para revisar item a item. Remover este botão e
  // esta função depois que o cutover for confirmado.
  const confirmAllPendingForCutover = async () => {
    if (source !== 'supabase') {
      setItems((prev) => prev.map((i) => (i.reviewDecision === 'pending' ? { ...i, reviewDecision: 'approved' } : i)))
      return
    }
    setBatchBusy(true)
    const total = pending.length
    let confirmed = 0
    try {
      for (const item of pending) {
        await decideInventoryCandidate(item.id, { decision: 'approved' })
        confirmed += 1
      }
      setBatchResult(`${confirmed} de ${total} candidato(s) confirmado(s) como estão, sem alteração de dados.`)
      load()
    } catch {
      setError(
        `Confirmação em lote parou depois de ${confirmed} de ${total}. Os que já foram confirmados continuam salvos — pode rodar de novo para o restante.`,
      )
    } finally {
      setBatchBusy(false)
    }
  }

  const createInventory = async () => {
    if (source !== 'supabase') {
      setBatchResult('Modo de demonstração: a criação do estoque oficial precisa de conexão com o banco.')
      return
    }
    setBatchBusy(true)
    try {
      const created = await createInitialInventory(`review-center-${new Date().toISOString()}`)
      setBatchResult(created.length > 0 ? `${created.length} veículo(s) adicionados ao estoque oficial.` : 'Nada novo para importar — tudo que estava aprovado já foi importado antes.')
      load()
    } catch {
      setError('Não foi possível criar o estoque inicial agora.')
    } finally {
      setBatchBusy(false)
    }
  }

  if (loading) return <p className="text-slate-500 dark:text-slate-400">Carregando…</p>

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Estoque atual</h1>
        <p className="text-slate-500 dark:text-slate-400">
          {items.length} carro(s) encontrados na planilha como estoque do mês mais recente. Confirme cada um.
        </p>
      </div>

      {source === 'demo' && <DemoBanner />}
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {batchResult && <p className="text-sm text-slate-600 dark:text-slate-300">{batchResult}</p>}

      {pending.length > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 dark:bg-slate-800">
          <span className="text-sm text-slate-600 dark:text-slate-300">{safeForBulk.length} sem nenhum aviso</span>
          <button
            type="button"
            onClick={confirmAllSafe}
            disabled={safeForBulk.length === 0 || batchBusy}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-50 dark:text-slate-900"
          >
            Confirmar todos sem avisos
          </button>
        </div>
      )}

      {/* TEMPORÁRIO — ferramenta de cutover, remover depois de usar uma vez. */}
      {pending.length > 0 && (
        <div className="space-y-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-900 dark:bg-amber-950">
          <p className="text-xs text-amber-900 dark:text-amber-200">
            Ferramenta de cutover: confirma os {pending.length} pendentes de uma vez, exatamente como estão (avisos
            inclusive). Nada é corrigido automaticamente — ajuste depois em Estoque → Editar se precisar.
          </p>
          <button
            type="button"
            onClick={confirmAllPendingForCutover}
            disabled={batchBusy}
            className="w-full rounded-lg border border-amber-400 bg-white py-2 text-sm font-medium text-amber-900 disabled:opacity-50 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
          >
            {batchBusy ? 'Confirmando…' : `Confirmar todos os pendentes (${pending.length})`}
          </button>
        </div>
      )}

      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            {editingId === item.id ? (
              <EditCard
                initial={toEditState(item)}
                busy={busyId === item.id}
                onCancel={() => setEditingId(null)}
                onSave={(state) => applyDecision(item, 'edited_and_approved', state)}
              />
            ) : (
              <ViewCard
                item={item}
                busy={busyId === item.id}
                onApprove={() => applyDecision(item, 'approved')}
                onReject={() => applyDecision(item, 'rejected')}
                onEdit={() => setEditingId(item.id)}
              />
            )}
          </li>
        ))}
      </ul>

      {decided.length > 0 && pending.length === 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Criar o estoque oficial</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {decided.filter((i) => i.reviewDecision === 'approved' || i.reviewDecision === 'edited_and_approved').length} carro(s)
            confirmados, prontos para virar estoque de verdade.
          </p>
          <button
            type="button"
            onClick={createInventory}
            disabled={batchBusy}
            className="w-full rounded-lg bg-slate-900 py-2.5 text-base font-medium text-white disabled:opacity-60 dark:bg-slate-50 dark:text-slate-900"
          >
            {batchBusy ? 'Criando…' : 'Criar estoque inicial'}
          </button>
        </div>
      )}
    </div>
  )
}

function ViewCard({
  item,
  busy,
  onApprove,
  onReject,
  onEdit,
}: {
  item: InventoryReviewItem
  busy: boolean
  onApprove: () => void
  onReject: () => void
  onEdit: () => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-slate-900 dark:text-slate-50">{vehicleTitle(item)}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {item.trim ? `${item.trim} · ` : ''}
            {item.year ?? 'Ano não informado'} · {item.plate ?? 'Placa não informada'}
          </p>
        </div>
        {item.reviewDecision !== 'pending' && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {item.reviewDecision === 'rejected' ? 'Marcado como fora do estoque' : 'Confirmado'}
          </span>
        )}
      </div>

      <p className="text-lg font-semibold text-slate-900 dark:text-slate-50">{fmtBRL(item.value)}</p>

      <p className="text-xs text-slate-400">
        Encontrado em {item.monthsSeen.length} mês(es) da planilha · origem: {item.sourceSheet} linha {item.sourceRow}
      </p>

      {item.warnings.length > 0 && (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Dados incompletos: {item.warnings.join('; ')}
        </div>
      )}

      {item.reviewDecision === 'pending' && (
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onApprove}
            disabled={busy}
            className="flex-1 rounded-lg bg-slate-900 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-50 dark:text-slate-900"
          >
            Confirmar no estoque
          </button>
          <button
            type="button"
            onClick={onEdit}
            disabled={busy}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={onReject}
            disabled={busy}
            className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 disabled:opacity-50 dark:border-red-900 dark:text-red-400"
          >
            Não está mais no estoque
          </button>
        </div>
      )}
    </div>
  )
}

function EditCard({
  initial,
  busy,
  onCancel,
  onSave,
}: {
  initial: EditState
  busy: boolean
  onCancel: () => void
  onSave: (state: EditState) => void
}) {
  const [state, setState] = useState(initial)

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault()
        onSave(state)
      }}
    >
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Corrigir antes de confirmar</p>
      <p className="text-xs text-slate-400">O dado original da planilha nunca é apagado — só guardamos sua correção ao lado dele.</p>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Marca" value={state.brand} onChange={(v) => setState({ ...state, brand: v })} />
        <Field label="Modelo" value={state.model} onChange={(v) => setState({ ...state, model: v })} />
        <Field label="Versão" value={state.trim} onChange={(v) => setState({ ...state, trim: v })} />
        <Field label="Ano" value={state.year} onChange={(v) => setState({ ...state, year: v })} type="number" />
        <Field label="Placa" value={state.plate} onChange={(v) => setState({ ...state, plate: v.toUpperCase() })} />
        <Field label="Valor (R$)" value={state.value} onChange={(v) => setState({ ...state, value: v })} type="number" />
      </div>
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={busy} className="flex-1 rounded-lg bg-slate-900 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-50 dark:text-slate-900">
          Salvar e confirmar
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200">
          Cancelar
        </button>
      </div>
    </form>
  )
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block text-xs text-slate-500 dark:text-slate-400">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
      />
    </label>
  )
}
