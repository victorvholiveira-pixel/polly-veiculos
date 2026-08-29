import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { SkeletonBlock } from '@/components/ui/Skeleton'
import { buildSalesHistoryView, fetchDashboardStats, type DashboardStats, type SalesRangeSelection } from '@/lib/data/dashboard'
import { fmtBRL } from '@/lib/format'

function fmtCompactBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 })
}

function fmtShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function missingCommissionNote(count: number): string {
  return count === 1 ? '1 venda sem comissão informada' : `${count} vendas sem comissão informada`
}

interface Delta {
  text: string
  positive: boolean
}

/** Only shown when there's a real previous-month base to compare against —
 * "quando houver dado suficiente" per the product ask. */
function monthDelta(current: number, previous: number): Delta | null {
  if (previous <= 0) return null
  const pct = Math.round(((current - previous) / previous) * 100)
  if (pct === 0) return { text: 'Igual ao mês passado', positive: true }
  return { text: `${pct > 0 ? '▲' : '▼'} ${Math.abs(pct)}% vs. mês passado`, positive: pct > 0 }
}

export function HomePage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [chartMode, setChartMode] = useState<'count' | 'revenue'>('count')
  const [rangeSelection, setRangeSelection] = useState<SalesRangeSelection>({ kind: 'months', months: 6 })

  useEffect(() => {
    fetchDashboardStats()
      .then(setStats)
      .catch((err: unknown) =>
        setError(err instanceof Error ? `Não foi possível carregar o painel: ${err.message}` : 'Não foi possível carregar o painel agora.'),
      )
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-5 pb-2">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Início</h1>
        <p className="text-slate-500 dark:text-slate-400">Como está a loja hoje.</p>
      </div>

      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {loading && <HomeSkeleton />}

      {stats && (
        <>
          <PrincipalKpis stats={stats} />
          <SecondaryKpis stats={stats} />
          <SalesHistoryCard stats={stats} mode={chartMode} onModeChange={setChartMode} selection={rangeSelection} onSelectionChange={setRangeSelection} />
          <AgingCard stats={stats} />
          <HighlightsCard stats={stats} />
          <RecentActivityCard stats={stats} />
        </>
      )}
    </div>
  )
}

// --- KPIs principais ---------------------------------------------------

function PrincipalKpis({ stats }: { stats: DashboardStats }) {
  const revenueDelta = monthDelta(stats.revenueThisMonth, stats.revenueLastMonth)
  const salesDelta = monthDelta(stats.salesThisMonth, stats.salesLastMonth)
  return (
    <div className="grid grid-cols-2 gap-3">
      <KpiCard label="Em estoque" value={String(stats.vehiclesInStock)} suffix="veículos" />
      <KpiCard label="Valor do estoque" value={fmtBRL(stats.stockValue)} />
      <KpiCard label="Vendas do mês" value={String(stats.salesThisMonth)} delta={salesDelta} />
      <KpiCard label="Faturamento do mês" value={fmtBRL(stats.revenueThisMonth)} delta={revenueDelta} />
    </div>
  )
}

function KpiCard({ label, value, suffix, delta }: { label: string; value: string; suffix?: string; delta?: Delta | null }) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
        {value}
        {suffix && <span className="ml-1 text-sm font-medium text-slate-400">{suffix}</span>}
      </p>
      {delta && (
        <p className={`mt-1 text-xs font-medium ${delta.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
          {delta.text}
        </p>
      )}
    </div>
  )
}

// --- KPIs secundários ----------------------------------------------------

function SecondaryKpis({ stats }: { stats: DashboardStats }) {
  const entryDateNote =
    stats.avgDaysInStock === null
      ? 'Sem data de entrada registrada'
      : stats.vehiclesInStockMissingEntryDate > 0
        ? `${stats.vehiclesInStockWithEntryDate} de ${stats.vehiclesInStock} com data`
        : undefined

  return (
    <div className="space-y-2">
      <SectionEyebrow>Detalhes do mês e do estoque</SectionEyebrow>
      <div className="grid grid-cols-2 gap-3">
        <SmallKpi
          label="Ticket médio de venda"
          value={stats.avgSaleTicket !== null ? fmtBRL(stats.avgSaleTicket) : '—'}
          note={stats.avgSaleTicket === null ? 'Sem vendas no mês' : undefined}
        />
        <SmallKpi
          label="Comissão do mês"
          value={fmtBRL(stats.commissionThisMonth)}
          note={
            stats.commissionThisMonthKnownCount < stats.salesThisMonth
              ? missingCommissionNote(stats.salesThisMonth - stats.commissionThisMonthKnownCount)
              : undefined
          }
        />
        <SmallKpi
          label="Ticket médio em estoque"
          value={stats.avgStockTicket !== null ? fmtBRL(stats.avgStockTicket) : '—'}
          note={stats.avgStockTicket === null ? 'Estoque vazio' : undefined}
        />
        <SmallKpi
          label="Tempo médio em estoque"
          value={stats.avgDaysInStock !== null ? `${stats.avgDaysInStock} dias` : '—'}
          note={entryDateNote}
        />
      </div>
    </div>
  )
}

function SmallKpi({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="break-words text-base font-semibold text-slate-900 dark:text-slate-50">{value}</p>
      {note && <p className="mt-0.5 text-[11px] text-slate-400">{note}</p>}
    </div>
  )
}

function SectionEyebrow({ children }: { children: ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{children}</p>
}

// --- Histórico de vendas -----------------------------------------------------

const RANGE_OPTIONS: Array<{ label: string; selection: SalesRangeSelection }> = [
  { label: '6m', selection: { kind: 'months', months: 6 } },
  { label: '12m', selection: { kind: 'months', months: 12 } },
  { label: '24m', selection: { kind: 'months', months: 24 } },
  { label: 'Tudo', selection: { kind: 'all' } },
]

function sameSelection(a: SalesRangeSelection, b: SalesRangeSelection): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === 'months' && b.kind === 'months') return a.months === b.months
  if (a.kind === 'year' && b.kind === 'year') return a.year === b.year
  return true // both 'all'
}

function pctDelta(pct: number | null, label: string): Delta | null {
  if (pct === null) return null
  if (pct === 0) return { text: `Igual ao ${label}`, positive: true }
  return { text: `${pct > 0 ? '▲' : '▼'} ${Math.abs(pct)}% vs. ${label}`, positive: pct > 0 }
}

function SalesHistoryCard({
  stats,
  mode,
  onModeChange,
  selection,
  onSelectionChange,
}: {
  stats: DashboardStats
  mode: 'count' | 'revenue'
  onModeChange: (mode: 'count' | 'revenue') => void
  selection: SalesRangeSelection
  onSelectionChange: (selection: SalesRangeSelection) => void
}) {
  const [tappedMonth, setTappedMonth] = useState<string | null>(null)

  const view = buildSalesHistoryView(stats.salesHistorySales, selection, new Date(), stats.salesHistoryEarliestDate)
  const detail = tappedMonth ? (view.months.find((m) => m.month === tappedMonth) ?? null) : null
  const max = Math.max(1, ...view.months.map((m) => (mode === 'count' ? m.salesCount : m.revenue)))
  const hasAnyData = view.summary.salesCount > 0
  const scrollable = view.months.length > 12
  const comparisonLabel = selection.kind === 'all' ? '' : selection.kind === 'year' ? 'ano anterior' : 'período anterior'

  const changeSelection = (next: SalesRangeSelection) => {
    setTappedMonth(null)
    onSelectionChange(next)
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Histórico de vendas</p>
        <div className="flex shrink-0 gap-1 rounded-full bg-slate-100 p-0.5 text-xs dark:bg-slate-800">
          <ToggleButton active={mode === 'count'} onClick={() => onModeChange('count')}>
            Qtd.
          </ToggleButton>
          <ToggleButton active={mode === 'revenue'} onClick={() => onModeChange('revenue')}>
            R$
          </ToggleButton>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {RANGE_OPTIONS.map((opt) => (
          <RangePill key={opt.label} active={sameSelection(selection, opt.selection)} onClick={() => changeSelection(opt.selection)}>
            {opt.label}
          </RangePill>
        ))}
        {stats.salesHistoryAvailableYears.length > 1 && (
          <select
            aria-label="Selecionar ano"
            value={selection.kind === 'year' ? String(selection.year) : ''}
            onChange={(e) => changeSelection({ kind: 'year', year: Number(e.target.value) })}
            className={`rounded-full border-none px-2.5 py-1 text-xs font-medium outline-none ${
              selection.kind === 'year' ? 'bg-slate-900 text-white dark:bg-slate-50 dark:text-slate-900' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
            }`}
          >
            <option value="" disabled>
              Ano
            </option>
            {stats.salesHistoryAvailableYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <PeriodStat label="Vendas" value={String(view.summary.salesCount)} delta={pctDelta(view.comparison.salesDeltaPct, comparisonLabel)} />
        <PeriodStat label="Faturamento" value={fmtBRL(view.summary.revenue)} delta={pctDelta(view.comparison.revenueDeltaPct, comparisonLabel)} />
        <PeriodStat label="Ticket médio" value={view.summary.avgTicket !== null ? fmtBRL(view.summary.avgTicket) : '—'} />
        <PeriodStat
          label="Comissão"
          value={fmtBRL(view.summary.commission)}
          note={
            view.summary.commissionKnownCount < view.summary.salesCount
              ? missingCommissionNote(view.summary.salesCount - view.summary.commissionKnownCount)
              : undefined
          }
        />
      </div>

      {!hasAnyData ? (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          {view.months.length === 0 ? 'Ainda não há vendas para mostrar histórico.' : 'Nenhuma venda registrada nesse período.'}
        </p>
      ) : (
        <>
          <div className={scrollable ? 'mt-4 overflow-x-auto' : 'mt-4'}>
            <div
              className={scrollable ? 'flex h-28 items-end gap-1.5' : 'flex h-28 items-end justify-between gap-1.5'}
              style={scrollable ? { minWidth: `${view.months.length * 30}px` } : undefined}
            >
              {view.months.map((m) => {
                const value = mode === 'count' ? m.salesCount : m.revenue
                const heightPct = value > 0 ? Math.max(6, Math.round((value / max) * 100)) : 2
                const isTapped = tappedMonth === m.month
                return (
                  <button
                    key={m.month}
                    type="button"
                    onClick={() => setTappedMonth(isTapped ? null : m.month)}
                    className={scrollable ? 'flex h-full w-7 shrink-0 flex-col items-center justify-end gap-1' : 'flex h-full flex-1 flex-col items-center justify-end gap-1'}
                  >
                    <span className="h-3 overflow-hidden whitespace-nowrap text-[9px] font-medium text-slate-500 dark:text-slate-400">
                      {/* A compact currency label ("R$93,3 mil") never fits a narrow scrollable
                          bar column — showing it there just overlaps into the neighbors. Tap
                          the bar for exact numbers instead; short counts still fit fine. */}
                      {value > 0 && !(scrollable && mode === 'revenue') ? (mode === 'count' ? value : fmtCompactBRL(value)) : ''}
                    </span>
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className={`w-full rounded-t-md transition-colors ${
                          value === 0 ? 'bg-slate-100 dark:bg-slate-800' : isTapped ? 'bg-emerald-500' : 'bg-slate-900 dark:bg-slate-50'
                        }`}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                    <span className={`text-[9px] ${isTapped ? 'font-semibold text-slate-900 dark:text-slate-50' : 'text-slate-400'}`}>{m.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {detail && (
            <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{detail.label}</p>
              {detail.salesCount === 0 ? (
                <p className="mt-1 text-xs text-slate-400">Nenhuma venda nesse mês.</p>
              ) : (
                <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                  <span>{detail.salesCount === 1 ? '1 venda' : `${detail.salesCount} vendas`}</span>
                  <span>{fmtBRL(detail.revenue)}</span>
                  <span>Ticket médio: {detail.avgTicket !== null ? fmtBRL(detail.avgTicket) : '—'}</span>
                  <span>{detail.commissionKnownCount > 0 ? `Comissão: ${fmtBRL(detail.commission)}` : 'Comissão não informada'}</span>
                </div>
              )}
            </div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
            <MiniStat label="Melhor mês" value={view.bestMonth ? `${view.bestMonth.label} · ${fmtBRL(view.bestMonth.revenue)}` : '—'} />
            <MiniStat label="Pior mês (com venda)" value={view.worstMonth ? `${view.worstMonth.label} · ${fmtBRL(view.worstMonth.revenue)}` : '—'} />
            <MiniStat label="Vendas médias/mês" value={view.avgMonthlySales !== null ? view.avgMonthlySales.toFixed(1) : '—'} />
            <MiniStat label="Faturamento médio/mês" value={view.avgMonthlyRevenue !== null ? fmtBRL(view.avgMonthlyRevenue) : '—'} />
          </div>
        </>
      )}
    </Card>
  )
}

function ToggleButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 font-medium transition-colors ${
        active ? 'bg-slate-900 text-white dark:bg-slate-50 dark:text-slate-900' : 'text-slate-500 dark:text-slate-400'
      }`}
    >
      {children}
    </button>
  )
}

function RangePill({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
        active ? 'bg-slate-900 text-white dark:bg-slate-50 dark:text-slate-900' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
      }`}
    >
      {children}
    </button>
  )
}

function PeriodStat({ label, value, note, delta }: { label: string; value: string; note?: string; delta?: Delta | null }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="truncate text-base font-semibold text-slate-900 dark:text-slate-50">{value}</p>
      {delta ? (
        <p className={`truncate text-[11px] font-medium ${delta.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{delta.text}</p>
      ) : (
        note && <p className="truncate text-[11px] text-slate-400">{note}</p>
      )}
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-slate-400">{label}</p>
      <p className="truncate font-medium text-slate-700 dark:text-slate-200">{value}</p>
    </div>
  )
}

// --- Estoque envelhecido ----------------------------------------------------

function AgingCard({ stats }: { stats: DashboardStats }) {
  const hasKnownDates = stats.vehiclesInStockWithEntryDate > 0

  return (
    <Card>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Estoque envelhecido</p>
        {hasKnownDates && (stats.agingOver30 > 0 || stats.agingOver60 > 0) && (
          <div className="flex gap-1.5 text-xs">
            {stats.agingOver60 > 0 && <Badge tone="danger">{stats.agingOver60} +60d</Badge>}
            {stats.agingOver30 > 0 && <Badge tone="warning">{stats.agingOver30} +30d</Badge>}
          </div>
        )}
      </div>

      {!hasKnownDates ? (
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Nenhum veículo em estoque tem data de entrada registrada ainda. Preencha em Estoque → Editar para acompanhar o
          tempo parado.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {stats.agingVehicles.map((v) => (
            <li key={v.id}>
              <Link
                to={`/estoque/${v.id}`}
                className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800"
              >
                <div className="min-w-0 truncate">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-50">{[v.brand, v.model].filter(Boolean).join(' ')}</p>
                  <p className="truncate text-xs text-slate-400">{v.plate ?? 'Sem placa'}</p>
                </div>
                <span
                  className={`shrink-0 text-sm font-semibold ${
                    v.daysInStock >= 60
                      ? 'text-red-600 dark:text-red-400'
                      : v.daysInStock >= 30
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {v.daysInStock} dias
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

// --- Destaques ---------------------------------------------------------

function HighlightsCard({ stats }: { stats: DashboardStats }) {
  const hasAny = stats.topSellingModel !== null || stats.biggestSale !== null || stats.fastestSale !== null

  return (
    <Card>
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Destaques dos últimos 6 meses</p>
      {!hasAny ? (
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Ainda não há vendas suficientes para mostrar destaques.</p>
      ) : (
        <ul className="mt-2">
          {stats.topSellingModel && (
            <HighlightRow
              label="Modelo mais vendido"
              value={`${stats.topSellingModel.brand} ${stats.topSellingModel.model}`}
              note={stats.topSellingModel.count === 1 ? '1 venda' : `${stats.topSellingModel.count} vendas`}
            />
          )}
          {stats.biggestSale && <HighlightRow label="Maior venda" value={stats.biggestSale.vehicleLabel} note={fmtBRL(stats.biggestSale.value)} />}
          {stats.fastestSale && (
            <HighlightRow
              label="Venda mais rápida"
              value={stats.fastestSale.vehicleLabel}
              note={stats.fastestSale.days === 1 ? '1 dia em estoque' : `${stats.fastestSale.days} dias em estoque`}
            />
          )}
        </ul>
      )}
    </Card>
  )
}

function HighlightRow({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <li className="flex items-center justify-between gap-2 border-b border-slate-100 py-2 first:pt-0 last:border-0 last:pb-0 dark:border-slate-800">
      <div className="min-w-0 truncate">
        <p className="text-xs text-slate-400">{label}</p>
        <p className="truncate font-medium text-slate-900 dark:text-slate-50">{value}</p>
      </div>
      <p className="shrink-0 text-sm font-semibold text-slate-600 dark:text-slate-300">{note}</p>
    </li>
  )
}

// --- Últimas movimentações -----------------------------------------------

function RecentActivityCard({ stats }: { stats: DashboardStats }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Últimas movimentações</p>
        <Link to="/historico" className="text-xs font-medium text-slate-500 hover:underline dark:text-slate-400">
          Ver histórico
        </Link>
      </div>

      {stats.recentActivity.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Nenhuma movimentação ainda.</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {stats.recentActivity.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-50">{a.actionLabel}</p>
                <p className="truncate text-xs text-slate-400">
                  {[a.vehicleLabel, a.amount !== null ? fmtBRL(a.amount) : null, a.note].filter(Boolean).join(' · ')}
                </p>
              </div>
              <p className="shrink-0 text-xs text-slate-400">{fmtShortDate(a.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

// --- Skeleton ----------------------------------------------------------------

function HomeSkeleton() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonBlock key={i} className="h-24" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonBlock key={i} className="h-16" />
        ))}
      </div>
      <SkeletonBlock className="h-40" />
      <SkeletonBlock className="h-36" />
      <SkeletonBlock className="h-32" />
      <SkeletonBlock className="h-40" />
    </div>
  )
}
