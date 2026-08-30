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
  MONTH_ABBR,
  SOLD_PERIOD_QUICK_OPTIONS,
  SOLD_SORT_OPTIONS,
  availableSoldYears,
  canStepMonthForward,
  completedSales,
  computeSoldSummary,
  countActiveAdvancedFilters,
  currentCalendarMonth,
  deriveSoldFilterOptions,
  filterSoldSales,
  periodLabel,
  sameSoldPeriod,
  sortSoldSales,
  stepCalendarMonth,
  type SoldFilters,
  type SoldPeriodSelection,
  type SoldSortKey,
} from '@/lib/data/soldSales'

/**
 * "Vendidos" dentro de Estoque (Onda 15, revisão de UX na Onda 16 — feedback
 * real: letras pequenas, texto secundário claro demais, filtros pouco
 * intuitivos). Mesma massa de dados do Histórico (fetchSales) e mesmo
 * componente de detalhe (SaleDetailsSheet).
 *
 * Tipografia/contraste: texto real (datas, placas, vendedor, meta) nunca
 * abaixo de slate-600 — slate-400/500 (usados antes) ficam abaixo de 4.5:1
 * de contraste no fundo claro deste app (tema travado em light, ver
 * index.css), que é exatamente o "pouco contraste" reportado.
 */
export function SoldVehiclesView() {
  const [sales, setSales] = useState<SaleWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Uma única leitura de "agora" por carga — evita o período mudar de
  // resultado no meio de uma sessão de filtro/navegação de mês.
  const [now] = useState(() => new Date())

  const [filters, setFilters] = useState<SoldFilters>(() => ({ ...DEFAULT_SOLD_FILTERS, period: currentCalendarMonth(now), query: '' }))
  const [sortKey, setSortKey] = useState<SoldSortKey>('newest')
  const [monthPickerOpen, setMonthPickerOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null)

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
  const advancedCount = countActiveAdvancedFilters(filters)

  const setPeriod = (period: SoldPeriodSelection) => setFilters((f) => ({ ...f, period }))

  return (
    <div className="space-y-5">
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {loading && <SoldSkeleton />}

      {!loading && !error && (
        <>
          {completed.length > 0 && (
            <>
              <MonthNavigator period={filters.period} now={now} onChange={setPeriod} onOpenPicker={() => setMonthPickerOpen(true)} />

              <div className="-mx-4 overflow-x-auto px-4">
                <div className="flex w-max gap-2">
                  <PeriodPill active={sameSoldPeriod(filters.period, currentCalendarMonth(now))} onClick={() => setPeriod(currentCalendarMonth(now))}>
                    Este mês
                  </PeriodPill>
                  {SOLD_PERIOD_QUICK_OPTIONS.map((opt) => (
                    <PeriodPill key={opt.label} active={sameSoldPeriod(filters.period, opt.selection)} onClick={() => setPeriod(opt.selection)}>
                      {opt.label}
                    </PeriodPill>
                  ))}
                  {years.length > 1 && (
                    <select
                      aria-label="Selecionar ano"
                      value={filters.period.kind === 'year' ? String(filters.period.year) : ''}
                      onChange={(e) => setPeriod({ kind: 'year', year: Number(e.target.value) })}
                      className={`rounded-full border-none px-3 py-2 text-sm font-semibold outline-none ${
                        filters.period.kind === 'year' ? 'bg-slate-900 text-white dark:bg-slate-50 dark:text-slate-900' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
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
              </div>

              <SoldSummaryCard summary={summary} />

              <div className="relative">
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  type="search"
                  placeholder="Marca, modelo, placa ou cliente"
                  value={filters.query}
                  onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-3.5 text-base text-slate-900 outline-none placeholder:text-slate-500 focus:border-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                />
              </div>

              <div className="flex gap-2">
                <ToolButton label="Filtros" count={advancedCount} onClick={() => setFiltersOpen(true)}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 6h16M7 12h10M10 18h4" />
                  </svg>
                </ToolButton>
                <ToolButton label="Ordenar" onClick={() => setSortOpen(true)}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M6 5v14M6 19l-3-3M6 19l3-3M18 19V5M18 5l-3 3M18 5l3 3" />
                  </svg>
                </ToolButton>
              </div>
            </>
          )}

          {completed.length === 0 ? (
            <EmptyState title="Nenhuma venda concluída ainda." note="Vendas registradas no app ou trazidas da planilha antiga aparecem aqui assim que existirem." />
          ) : sorted.length === 0 ? (
            <EmptyState
              title={`Nenhuma venda em ${periodLabel(filters.period).toLowerCase()}.`}
              note={advancedCount > 0 || filters.query ? 'Os filtros aplicados também podem estar excluindo vendas desse período.' : undefined}
              action={
                <button
                  type="button"
                  onClick={() => setFilters({ ...DEFAULT_SOLD_FILTERS, period: currentCalendarMonth(now), query: '' })}
                  className="text-base font-semibold text-slate-700 underline dark:text-slate-300"
                >
                  Limpar filtros e ver este mês
                </button>
              }
            />
          ) : (
            <ul className="space-y-3">
              {sorted.map((s) => (
                <SoldSaleCard key={s.id} sale={s} onClick={() => setSelectedSaleId(s.id)} />
              ))}
            </ul>
          )}
        </>
      )}

      <MonthPickerSheet
        key={monthPickerOpen ? 'open' : 'closed'}
        open={monthPickerOpen}
        onClose={() => setMonthPickerOpen(false)}
        period={filters.period}
        now={now}
        onSelect={(month) => {
          setPeriod({ kind: 'calendarMonth', ...month })
          setMonthPickerOpen(false)
        }}
      />

      <ActionSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filtros avançados">
        <div className="space-y-5 p-3">
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

          <FilterGroup label="Comissão">
            <ChipRow>
              <FilterChip active={filters.commission === 'all'} onClick={() => setFilters((f) => ({ ...f, commission: 'all' }))}>
                Todas
              </FilterChip>
              <FilterChip active={filters.commission === 'known'} onClick={() => setFilters((f) => ({ ...f, commission: 'known' }))}>
                Informada
              </FilterChip>
              <FilterChip active={filters.commission === 'unknown'} onClick={() => setFilters((f) => ({ ...f, commission: 'unknown' }))}>
                Não informada
              </FilterChip>
            </ChipRow>
          </FilterGroup>

          {filterOptions.vehicleYears.length > 0 && (
            <FilterGroup label="Ano do veículo">
              <ChipRow>
                <FilterChip active={filters.vehicleYear === 'all'} onClick={() => setFilters((f) => ({ ...f, vehicleYear: 'all' }))}>
                  Todos
                </FilterChip>
                {filterOptions.vehicleYears.map((y) => (
                  <FilterChip key={y} active={filters.vehicleYear === y} onClick={() => setFilters((f) => ({ ...f, vehicleYear: y }))}>
                    {y}
                  </FilterChip>
                ))}
              </ChipRow>
            </FilterGroup>
          )}

          <FilterGroup label="Faixa de valor">
            <div className="flex items-center gap-2">
              <label className="flex-1">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">De R$</span>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="0"
                  value={filters.minValue ?? ''}
                  onChange={(e) => setFilters((f) => ({ ...f, minValue: e.target.value === '' ? null : Number(e.target.value) }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base text-slate-900 outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
                />
              </label>
              <label className="flex-1">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Até R$</span>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="Sem limite"
                  value={filters.maxValue ?? ''}
                  onChange={(e) => setFilters((f) => ({ ...f, maxValue: e.target.value === '' ? null : Number(e.target.value) }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base text-slate-900 outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
                />
              </label>
            </div>
          </FilterGroup>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setFilters((f) => ({ ...DEFAULT_SOLD_FILTERS, period: f.period, query: f.query }))}
              className="flex-1 rounded-lg border border-slate-300 py-3 text-base font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              className="flex-1 rounded-lg bg-slate-900 py-3 text-base font-semibold text-white dark:bg-slate-50 dark:text-slate-900"
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

// --- Navegação de período ------------------------------------------------

function MonthNavigator({
  period,
  now,
  onChange,
  onOpenPicker,
}: {
  period: SoldPeriodSelection
  now: Date
  onChange: (p: SoldPeriodSelection) => void
  onOpenPicker: () => void
}) {
  const isMonth = period.kind === 'calendarMonth'
  const canForward = isMonth && canStepMonthForward(period, now)

  return (
    <div className="flex items-center justify-between gap-2">
      {isMonth ? (
        <button
          type="button"
          onClick={() => onChange({ kind: 'calendarMonth', ...stepCalendarMonth(period, -1) })}
          aria-label="Mês anterior"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-700 active:bg-slate-100 dark:text-slate-200 dark:active:bg-slate-800"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      ) : (
        <span className="h-11 w-11 shrink-0" aria-hidden="true" />
      )}

      <button type="button" onClick={onOpenPicker} className="min-w-0 flex-1 rounded-lg py-1 text-center active:bg-slate-100 dark:active:bg-slate-800">
        <span className="block truncate text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">{periodLabel(period)}</span>
      </button>

      {isMonth ? (
        <button
          type="button"
          onClick={() => canForward && onChange({ kind: 'calendarMonth', ...stepCalendarMonth(period, 1) })}
          aria-label="Próximo mês"
          disabled={!canForward}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-700 active:bg-slate-100 disabled:text-slate-300 disabled:active:bg-transparent dark:text-slate-200 dark:disabled:text-slate-700 dark:active:bg-slate-800"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      ) : (
        <span className="h-11 w-11 shrink-0" aria-hidden="true" />
      )}
    </div>
  )
}

function MonthPickerSheet({
  open,
  onClose,
  period,
  now,
  onSelect,
}: {
  open: boolean
  onClose: () => void
  period: SoldPeriodSelection
  now: Date
  onSelect: (month: { year: number; month: number }) => void
}) {
  // The parent remounts this component (key={open ? 'open' : 'closed'}) each
  // time the sheet opens, so this lazy initializer alone keeps pickerYear
  // fresh — no reset effect needed.
  const [pickerYear, setPickerYear] = useState(period.kind === 'calendarMonth' ? period.year : now.getFullYear())

  const selectedMonth = period.kind === 'calendarMonth' && period.year === pickerYear ? period.month : null
  const isCurrentYear = pickerYear === now.getFullYear()

  return (
    <ActionSheet open={open} onClose={onClose} title="Escolher mês">
      <div className="space-y-4 p-3">
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => setPickerYear((y) => y - 1)}
            aria-label="Ano anterior"
            className="flex h-11 w-11 items-center justify-center rounded-full text-slate-700 active:bg-slate-100 dark:text-slate-200 dark:active:bg-slate-800"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <span className="w-20 text-center text-lg font-bold text-slate-900 dark:text-slate-50">{pickerYear}</span>
          <button
            type="button"
            onClick={() => !isCurrentYear && setPickerYear((y) => y + 1)}
            aria-label="Próximo ano"
            disabled={isCurrentYear}
            className="flex h-11 w-11 items-center justify-center rounded-full text-slate-700 active:bg-slate-100 disabled:text-slate-300 disabled:active:bg-transparent dark:text-slate-200 dark:disabled:text-slate-700 dark:active:bg-slate-800"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {MONTH_ABBR.map((label, i) => {
            const monthNumber = i + 1
            const future = isCurrentYear && monthNumber > now.getMonth() + 1
            const active = selectedMonth === monthNumber
            return (
              <button
                key={label}
                type="button"
                disabled={future}
                onClick={() => onSelect({ year: pickerYear, month: monthNumber })}
                className={`rounded-xl py-3 text-base font-semibold ${
                  active
                    ? 'bg-slate-900 text-white dark:bg-slate-50 dark:text-slate-900'
                    : future
                      ? 'text-slate-300 dark:text-slate-700'
                      : 'bg-slate-100 text-slate-700 active:bg-slate-200 dark:bg-slate-800 dark:text-slate-200'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>
    </ActionSheet>
  )
}

// --- Resumo ------------------------------------------------------------------

function SoldSummaryCard({ summary }: { summary: ReturnType<typeof computeSoldSummary> }) {
  return (
    <Card>
      <div className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <span className="text-[32px] font-bold leading-none tracking-tight text-slate-900 dark:text-slate-50">{summary.count}</span>
          <span className="text-base font-semibold text-slate-600 dark:text-slate-300">{summary.count === 1 ? 'venda' : 'vendas'}</span>
        </div>
        <span className="shrink-0 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">{fmtBRL(summary.revenue)}</span>
      </div>

      <div className="mt-4 h-px bg-slate-200 dark:bg-slate-700" />

      <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4">
        <MiniStat label="Ticket médio" value={summary.avgTicket !== null ? fmtBRL(summary.avgTicket) : '—'} />
        <MiniStat label="Comissão conhecida" value={fmtBRL(summary.commissionKnown)} />
      </div>

      {summary.commissionUnknownCount > 0 && (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          {summary.commissionUnknownCount === 1 ? '1 venda sem comissão informada' : `${summary.commissionUnknownCount} vendas sem comissão informada`}
        </p>
      )}
    </Card>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="truncate text-lg font-bold text-slate-900 dark:text-slate-50">{value}</p>
    </div>
  )
}

// --- Controles -------------------------------------------------------------

function PeriodPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
        active ? 'bg-slate-900 text-white dark:bg-slate-50 dark:text-slate-900' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
      }`}
    >
      {children}
    </button>
  )
}

function ToolButton({ label, count, onClick, children }: { label: string; count?: number; onClick: () => void; children: ReactNode }) {
  const active = Boolean(count && count > 0)
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border text-sm font-semibold ${
        active ? 'border-slate-900 text-slate-900 dark:border-slate-50 dark:text-slate-50' : 'border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-200'
      } bg-white dark:bg-slate-900`}
    >
      {children}
      <span>{label}</span>
      {active && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-900 px-1 text-xs font-bold text-white dark:bg-slate-50 dark:text-slate-900">{count}</span>
      )}
    </button>
  )
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      {children}
    </div>
  )
}

function ChipRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
        active ? 'bg-slate-900 text-white dark:bg-slate-50 dark:text-slate-900' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
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
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors active:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:active:bg-slate-800"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 truncate text-base font-bold text-slate-900 dark:text-slate-50">
              {sale.vehicle ? `${sale.vehicle.brand} ${sale.vehicle.model}` : 'Veículo não informado'}
            </p>
            {sale.origin === 'migration' && (
              <span className="shrink-0">
                <Badge tone="neutral">Histórico importado</Badge>
              </span>
            )}
          </div>
          {sale.vehicle?.trim && <p className="truncate text-sm text-slate-600 dark:text-slate-300">{sale.vehicle.trim}</p>}

          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-50">{fmtBRL(sale.sale_value)}</p>

          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">{fmtDateShort(sale.sale_date)}</p>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {sale.vehicle?.modelYear ?? 'Ano não informado'} · {sale.vehicle?.plate ?? 'Placa não informada'}
          </p>

          {meta && <p className="mt-1.5 truncate text-sm text-slate-600 dark:text-slate-300">{meta}</p>}
        </div>

        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-slate-400">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </li>
  )
}

// --- Estados vazios / loading ------------------------------------------------

function EmptyState({ title, note, action }: { title: string; note?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-6 text-center dark:border-slate-700 dark:bg-slate-900/40">
      <p className="text-base font-semibold text-slate-700 dark:text-slate-200">{title}</p>
      {note && <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">{note}</p>}
      {action && <div className="mt-4">{action}</div>}
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
