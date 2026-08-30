import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ActionSheet } from '@/components/ui/ActionSheet'
import { Badge } from '@/components/ui/Badge'
import { fmtBRL, fmtDateLong } from '@/lib/format'
import { cancelSale, fetchSaleDetail, type SaleDetail } from '@/lib/data/sales'

/**
 * Single detail view for a sale — bottom sheet, mobile-first. Opened from
 * anywhere a sale appears (Histórico, Home's "últimas movimentações", …) by
 * passing the sale's id; never a separate implementation per list. Fetches
 * its own data on open (fetchSaleDetail) instead of expecting the caller to
 * carry every field, so a list can stay light (fetchSales() doesn't select
 * year/trim) without duplicating this component per screen.
 *
 * The caller should render this with `key={saleId ?? 'none'}` — switching
 * sales remounts it, resetting fetch/cancel state for free instead of a
 * manual reset effect (see React's docs on resetting state via key).
 */
export function SaleDetailsSheet({
  saleId,
  onClose,
  onSaleChanged,
}: {
  saleId: string | null
  onClose: () => void
  /** Called after a cancellation succeeds, so the caller's list can refresh. */
  onSaleChanged?: () => void
}) {
  const [detail, setDetail] = useState<SaleDetail | null>(null)
  // Starts true (not set from inside the effect below) because the caller
  // remounts this component per sale (key={saleId ?? 'none'}) — whenever an
  // instance exists with a real saleId, a fetch is always about to start.
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!saleId) return
    fetchSaleDetail(saleId)
      .then((d) => setDetail(d))
      .catch(() => setError('Não foi possível carregar os detalhes dessa venda agora.'))
      .finally(() => setLoading(false))
  }, [saleId])

  const confirmCancel = async () => {
    if (!detail || !reason.trim()) return
    setBusy(true)
    try {
      const updated = await cancelSale(detail.id, reason.trim())
      setDetail({ ...detail, ...updated })
      setCancelling(false)
      setReason('')
      onSaleChanged?.()
    } catch {
      setError('Não foi possível cancelar essa venda agora.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ActionSheet open={saleId !== null} onClose={onClose}>
      <div className="space-y-4 p-3">
        {loading && (
          <div className="space-y-3" aria-hidden="true">
            <div className="h-7 w-2/3 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-5 w-1/2 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-24 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
          </div>
        )}

        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        {!loading && detail && (
          <>
            <header className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">{fmtBRL(detail.sale_value)}</p>
                {detail.origin === 'migration' && <Badge tone="neutral">Histórico importado</Badge>}
              </div>
              <StatusLine detail={detail} />
            </header>

            <section>
              {detail.vehicle ? (
                <>
                  <p className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                    {detail.vehicle.brand} {detail.vehicle.model}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {[detail.vehicle.trim, detail.vehicle.modelYear?.toString(), detail.vehicle.plate ?? 'Placa não informada']
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">Veículo não informado</p>
              )}
            </section>

            <dl className="grid grid-cols-2 gap-x-3 gap-y-3">
              <Field label="Data da venda" value={fmtDateLong(detail.sale_date)} />
              <Field label="Comissão" value={detail.commission_amount !== null ? fmtBRL(detail.commission_amount) : 'Não informada'} />
              {detail.customer_name && <Field label="Comprador" value={detail.customer_name} />}
              {detail.customer_phone && <Field label="Telefone" value={detail.customer_phone} />}
              {detail.sellerName && <Field label="Vendedor" value={detail.sellerName} />}
              {detail.channel && <Field label="Canal" value={detail.channel} />}
            </dl>

            {detail.trade_in_description && (
              <section className="space-y-1">
                <p className="text-xs text-slate-400">Troca</p>
                <p className="text-sm text-slate-700 dark:text-slate-300">{detail.trade_in_description}</p>
              </section>
            )}

            {detail.observations && (
              <section className="space-y-1">
                <p className="text-xs text-slate-400">Observações</p>
                <p className="text-sm text-slate-700 dark:text-slate-300">{detail.observations}</p>
              </section>
            )}

            <Footer
              detail={detail}
              cancelling={cancelling}
              reason={reason}
              busy={busy}
              onStartCancel={() => setCancelling(true)}
              onCancelReason={setReason}
              onCancelBack={() => {
                setCancelling(false)
                setReason('')
              }}
              onCancelConfirm={confirmCancel}
              onClose={onClose}
            />
          </>
        )}
      </div>
    </ActionSheet>
  )
}

function StatusLine({ detail }: { detail: SaleDetail }) {
  if (detail.status === 'cancelled') {
    return (
      <p className="text-sm font-medium text-red-600 dark:text-red-400">
        Venda cancelada{detail.cancelled_reason ? ` — ${detail.cancelled_reason}` : ''}
      </p>
    )
  }
  return <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Venda concluída</p>
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="text-sm font-semibold text-slate-900 dark:text-slate-50">{value}</dd>
    </div>
  )
}

function Footer({
  detail,
  cancelling,
  reason,
  busy,
  onStartCancel,
  onCancelReason,
  onCancelBack,
  onCancelConfirm,
  onClose,
}: {
  detail: SaleDetail
  cancelling: boolean
  reason: string
  busy: boolean
  onStartCancel: () => void
  onCancelReason: (value: string) => void
  onCancelBack: () => void
  onCancelConfirm: () => void
  onClose: () => void
}) {
  // Migration sales are read-only by default — no rule for cancelling/editing
  // one as if it were an operational app sale exists yet (see task spec).
  if (detail.origin === 'migration') {
    return (
      <button
        type="button"
        onClick={onClose}
        className="w-full rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
      >
        Fechar
      </button>
    )
  }

  if (cancelling) {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Motivo do cancelamento
          <textarea
            value={reason}
            onChange={(e) => onCancelReason(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancelBack}
            className="rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={onCancelConfirm}
            disabled={!reason.trim() || busy}
            className="rounded-lg bg-red-600 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Confirmar cancelamento
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {detail.vehicle_id && (
        <Link
          to={`/estoque/${detail.vehicle_id}`}
          onClick={onClose}
          className="block w-full rounded-lg bg-slate-900 py-2.5 text-center text-sm font-medium text-white dark:bg-slate-50 dark:text-slate-900"
        >
          Ver veículo
        </Link>
      )}
      {detail.status === 'completed' && (
        <button
          type="button"
          onClick={onStartCancel}
          className="w-full rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
        >
          Cancelar venda
        </button>
      )}
    </div>
  )
}
