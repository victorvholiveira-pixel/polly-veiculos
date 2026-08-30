import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { SaleDetailsSheet } from '@/components/sales/SaleDetailsSheet'
import { ActionSheet, ActionSheetItem } from '@/components/ui/ActionSheet'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { SkeletonBlock } from '@/components/ui/Skeleton'
import { fmtBRL, fmtDateShort } from '@/lib/format'
import { fetchSales, type SaleWithDetails } from '@/lib/data/sales'
import {
  DEFAULT_SOLD_FILTERS,
  SOLD_PERIOD_OPTIONS,
  SOLD_SORT_OPTIONS,
  availableSoldYears,
  completedSales,
  computeSoldSummary,
  deriveSoldFilterOptions,
  filterSoldSales,
  sameSoldPeriod,
  sortSoldSales,
  type SoldFilters,
  type SoldSortKey,
} from '@/lib/data/soldSales'

/**
 * "Vendidos" dentro de Estoque (Onda 15) — mesma massa de dados do
 * Histórico (fetchSales) e mesmo componente de detalhe (SaleDetailsSheet),
 * só que com filtros/resumo focados em "o que já vendi" (só status
 * completed — uma venda cancelada fica só no Histórico).
 */
export function SoldVehiclesView() {
  const [sales, setSales] = useState<SaleWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [filters, setFilters] = useState<SoldFilters>(DEFAULT_SOLD_FILTERS)
  const [sortKey, setSortKey] = useState<SoldSortKey>('newest')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null)

  // Uma única leitura de "agora" por carga — mesmo padrão do Estoque, evita o
  // período mudar de resultado no meio de uma sessão de filtro.
  const [now] = useState(() => new Date())

  const load = () => {
    fetchSales()
      .then(setSales)
      .catch(() => setError('Não foi possível carregar as vendas agora. Confira a conexão e tente de novo.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const completed = useMemo(() => completedSales(sales), [sales])
  const years = useMemo(() => availableSoldYears(completed), [completed])
  const filterOptions = useMemo(() => deriveSoldFilterOptions(completed), [completed])
  const filtered = useMemo(() => filterSoldSales(completed, filters, now), [completed, filters, now])
  const sorted = useMemo(() => sortSoldSales(filtered, sortKey), [filtered, sortKey])
  const summary = useMemo(() => computeSoldSummary(filtered), [filtered])

  const extraFiltersActive = filters.sellerId !== 'all' || filters.channel !== 'all' || filters.origin !== 'all'

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {loading && <SoldSkeleton />}

      {!loading && !error && (
        <>
          {completed.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-1.5">
                {SOLD_PERIOD_OPTIONS.map((opt) => (
                  <PeriodPill
                    key={opt.label}
                    active={sameSoldPeriod(filters.period, opt.selection)}
                    onClick={() => setFilters((f) => ({ ...f, period: opt.selection }))}
                  >
                    {opt.label}
                  </PeriodPill>
                ))}
                {years.length > 1 && (
                  <select
                    aria-label="Selecionar ano"
                    value={filters.period.kind === 'year' ? String(filters.period.year) : ''}
                    onChange={(e) => setFilters((f) => ({ ...f, period: { kind: 'year', year: Number(e.target.value) } }))}
                    className={`rounded-full border-none px-2.5 py-1 text-xs font-medium outline-none ${
                      filters.period.kind === 'year' ? 'bg-slate-900 text-white dark:bg-slate-50 dark:text-slate-900' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    <option value="" disabled>
                      Ano
                    </option>
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <SoldSummaryCard summary={summary} />

              <div className="flex items-center gap-2">
                <input
                  type="search"
                  placeholder="Buscar por marca, modelo, placa ou cliente"
                  value={filters.query}
                  onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
                  className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3.5 py-2.5 text-base outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                />
                <IconButton label="Filtros" active={extraFiltersActive} onClick={() => setFiltersOpen(true)}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 6h16M7 12h10M10 18h4" />
                  </svg>
                </IconButton>
                <IconButton label="Ordenar" onClick={() => setSortOpen(true)}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M6 5v14M6 19l-3-3M6 19l3-3M18 19V5M18 5l-3 3M18 5l3 3" />
                  </svg>
                </IconButton>
              </div>
            </>
          )}

          {completed.length === 0 ? (
            <EmptyState title="Nenhuma venda concluída ainda." note="Vendas registradas no app ou trazidas da planilha antiga aparecem aqui assim que existirem." />
          ) : sorted.length === 0 ? (
            <EmptyState
              title="Nada encontrado para esses filtros."
              action={
                <button type="button" onClick={() => setFilters(DEFAULT_SOLD_FILTERS)} className="text-sm font-medium text-slate-600 underline dark:text-slate-300">
                  Limpar filtros
                </button>
              }
            />
          ) : (
            <ul className="space-y-2.5">
              {sorted.map((s) => (
                <SoldSaleCard key={s.id} sale={s} onClick={() => setSelectedSaleId(s.id)} />
              ))}
            </ul>
          )}
        </>
      )}

      <ActionSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filtros">
        <div className="space-y-4 p-2">
          <FilterGroup label="Vendedor">
            <ChipRow>
              <FilterChip active={filters.sellerId === 'all'} onClick={() => setFilters((f) => ({ ...f, sellerId: 'all' }))}>
                Todos
              </FilterChip>
              {filterOptions.sellers.map((s) => (
                <FilterChip key={s.id} active={filters.sellerId === s.id} onClick={() => setFilters((f) => ({ ...f, sellerId: s.id }))}>
                  {s.name}
                </FilterChip>
              ))}
            </ChipRow>
          </FilterGroup>

          <FilterGroup label="Canal">
            <ChipRow>
              <FilterChip active={filters.channel === 'all'} onClick={() => setFilters((f) => ({ ...f, channel: 'all' }))}>
                Todos
              </FilterChip>
              {filterOptions.channels.map((c) => (
                <FilterChip key={c} active={filters.channel === c} onClick={() => setFilters((f) => ({ ...f, channel: c }))}>
                  {c}
                </FilterChip>
              ))}
            </ChipRow>
          </FilterGroup>

          <FilterGroup label="Origem">
            <ChipRow>
              <FilterChip active={filters.origin === 'all'} onClick={() => setFilters((f) => ({ ...f, origin: 'all' }))}>
                Todas
              </FilterChip>
              <FilterChip active={filters.origin === 'app'} onClick={() => setFilters((f) => ({ ...f, origin: 'app' }))}>
                App
              </FilterChip>
              <FilterChip active={filters.origin === 'migration'} onClick={() => setFilters((f) => ({ ...f, origin: 'migration' }))}>
                Histórico importado
              </FilterChip>
            </ChipRow>
          </FilterGroup>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setFilters((f) => ({ ...DEFAULT_SOLD_FILTERS, period: f.period, query: f.query }))}
              className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              className="flex-1 rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white dark:bg-slate-50 dark:text-slate-900"
            >
              Ver {filtered.length} {filtered.length === 1 ? 'venda' : 'vendas'}
            </button>
          </div>
        </div>
      </ActionSheet>

      <ActionSheet open={sortOpen} onClose={() => setSortOpen(false)} title="Ordenar por">
        {SOLD_SORT_OPTIONS.map((opt) => (
          <ActionSheetItem
            key={opt.key}
            active={sortKey === opt.key}
            onClick={() => {
              setSortKey(opt.key)
              setSortOpen(false)
            }}
          >
            {opt.label}
          </ActionSheetItem>
        ))}
      </ActionSheet>

      <SaleDetailsSheet key={selectedSaleId ?? 'none'} saleId={selectedSaleId} onClose={() => setSelectedSaleId(null)} onSaleChanged={load} />
    </div>
  )
}

// --- Resumo ------------------------------------------------------------------

function SoldSummaryCard({ summary }: { summary: ReturnType<typeof computeSoldSummary> }) {
  return (
    <Card>
      <div className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <span className="text-[26px] font-bold leading-none tracking-tight text-slate-900 dark:text-slate-50">{summary.count}</span>
          <span className="text-sm font-medium text-slate-400">{summary.count === 1 ? 'venda' : 'vendas'}</span>
        </div>
        <span className="shrink-0 text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">{fmtBRL(summary.revenue)}</span>
      </div>

      <div className="mt-3 h-px bg-slate-100 dark:bg-slate-800" />

      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3">
        <MiniStat label="Ticket médio" value={summary.avgTicket !== null ? fmtBRL(summary.avgTicket) : '—'} />
        <MiniStat label="Comissão conhecida" value={fmtBRL(summary.commissionKnown)} />
      </div>

      {summary.commissionUnknownCount > 0 && (
        <p className="mt-3 text-[11px] text-slate-400">
          {summary.commissionUnknownCount === 1 ? '1 venda sem comissão informada' : `${summary.commissionUnknownCount} vendas sem comissão informada`}
        </p>
      )}
    </Card>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">{value}</p>
    </div>
  )
}

// --- Filtros -------------------------------------------------------------

function PeriodPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
        active ? 'bg-slate-900 text-white dark:bg-slate-50 dark:text-slate-900' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
      }`}
    >
      {children}
    </button>
  )
}

function IconButton({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-slate-500 dark:text-slate-400 ${
        active ? 'border-slate-900 dark:border-slate-50' : 'border-slate-200 dark:border-slate-800'
      } bg-white dark:bg-slate-900`}
    >
      {children}
      {active && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-slate-900 dark:bg-slate-50" aria-hidden="true" />}
    </button>
  )
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      {children}
    </div>
  )
}

function ChipRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-1.5">{children}</div>
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? 'bg-slate-900 text-white dark:bg-slate-50 dark:text-slate-900' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
      }`}
    >
      {children}
    </button>
  )
}

// --- Card de venda ---------------------------------------------------------

function SoldSaleCard({ sale, onClick }: { sale: SaleWithDetails; onClick: () => void }) {
  const meta = [sale.customer_name, sale.sellerName, sale.commission_amount !== null ? `Comissão ${fmtBRL(sale.commission_amount)}` : null].filter(Boolean).join(' · ')

  return (
    <li>
      <button type="button" onClick={onClick} className="block w-full rounded-2xl border border-slate-200 bg-white p-3.5 text-left shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-1.5">
          <p className="min-w-0 truncate text-[15px] font-semibold text-slate-900 dark:text-slate-50">
            {sale.vehicle ? sale.vehicle.brand : null} {sale.vehicle ? sale.vehicle.model : 'Veículo não informado'}
            {sale.vehicle?.trim && <span className="font-normal text-slate-500 dark:text-slate-400"> · {sale.vehicle.trim}</span>}
          </p>
          {sale.origin === 'migration' && (
            <span className="shrink-0">
              <Badge tone="neutral">Histórico importado</Badge>
            </span>
          )}
        </div>

        <div className="mt-0.5 flex items-baseline justify-between gap-2">
          <span className="truncate text-xs text-slate-400">
            {sale.vehicle?.modelYear ?? 'Ano não informado'} · {sale.vehicle?.plate ?? 'Placa não informada'} · {fmtDateShort(sale.sale_date)}
          </span>
          <span className="shrink-0 text-lg font-bold text-slate-900 dark:text-slate-50">{fmtBRL(sale.sale_value)}</span>
        </div>

        {meta && <p className="mt-1.5 truncate text-xs text-slate-400">{meta}</p>}
      </button>
    </li>
  )
}

// --- Estados vazios / loading ------------------------------------------------

function EmptyState({ title, note, action }: { title: string; note?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-6 text-center dark:border-slate-700 dark:bg-slate-900/40">
      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{title}</p>
      {note && <p className="mt-1 text-xs text-slate-400">{note}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

function SoldSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <SkeletonBlock className="h-32" />
      <SkeletonBlock className="h-11" />
      <div className="space-y-2.5">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonBlock key={i} className="h-[92px]" />
        ))}
      </div>
    </div>
  )
}
