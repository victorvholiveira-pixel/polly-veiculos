import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ActionSheet, ActionSheetItem } from '@/components/ui/ActionSheet'
import { Card } from '@/components/ui/Card'
import { SkeletonBlock } from '@/components/ui/Skeleton'
import { fmtBRL, fmtDateShort } from '@/lib/format'
import {
  activeStock,
  computeStockSummary,
  daysInStockFor,
  filterVehiclesByChip,
  sortVehicles,
  SORT_OPTIONS,
  type StockFilterKey,
  type StockSortKey,
  type StockSummary,
} from '@/lib/data/stockSummary'
import { fetchVehicles, searchVehicles, type Vehicle } from '@/lib/data/vehicles'

const STATUS_LABEL: Record<Vehicle['status'], string> = { available: 'Disponível', reserved: 'Reservado', sold: 'Vendido' }

export function StockListPage() {
  const navigate = useNavigate()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [filterKey, setFilterKey] = useState<StockFilterKey>('all')
  const [sortKey, setSortKey] = useState<StockSortKey>('newest')
  const [sortOpen, setSortOpen] = useState(false)
  const [menuVehicle, setMenuVehicle] = useState<Vehicle | null>(null)

  // Uma única leitura de "agora" por carga de dados — evita um veículo mudar
  // de faixa de dias no meio de uma sessão de filtro/busca.
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    fetchVehicles('all')
      .then((data) => {
        setVehicles(data)
        setNow(new Date())
      })
      .catch(() => setError('Não foi possível carregar o estoque agora. Confira a conexão e tente de novo.'))
      .finally(() => setLoading(false))
  }, [])

  const summary: StockSummary = useMemo(() => computeStockSummary(vehicles, now), [vehicles, now])
  const base = useMemo(() => activeStock(vehicles), [vehicles])
  const availableCount = useMemo(() => base.filter((v) => v.status === 'available').length, [base])
  const reservedCount = useMemo(() => base.filter((v) => v.status === 'reserved').length, [base])

  const chipFiltered = useMemo(() => filterVehiclesByChip(vehicles, filterKey, now), [vehicles, filterKey, now])
  const searched = useMemo(() => searchVehicles(chipFiltered, query), [chipFiltered, query])
  const sorted = useMemo(() => sortVehicles(searched, sortKey, now), [searched, sortKey, now])

  const chips: Array<{ key: StockFilterKey; label: string; count: number }> = [
    { key: 'all', label: 'Todos', count: summary.count },
    { key: 'available', label: 'Disponíveis', count: availableCount },
    { key: 'reserved', label: 'Reservados', count: reservedCount },
    ...(summary.over30 > 0 ? [{ key: 'over30' as const, label: '+30 dias', count: summary.over30 }] : []),
    ...(summary.over60 > 0 ? [{ key: 'over60' as const, label: '+60 dias', count: summary.over60 }] : []),
  ]

  return (
    <div className="space-y-4 pb-2">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Estoque</h1>
        <Link to="/estoque/novo" className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-slate-50 dark:text-slate-900">
          + Adicionar
        </Link>
      </div>

      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {loading && <StockSkeleton />}

      {!loading && !error && (
        <>
          {vehicles.length > 0 && <StockHero summary={summary} />}

          {vehicles.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1 overflow-x-auto">
                <div className="flex w-max gap-2">
                  {chips.map((c) => (
                    <Chip key={c.key} active={filterKey === c.key} onClick={() => setFilterKey(c.key)}>
                      {c.label} · {c.count}
                    </Chip>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSortOpen(true)}
                aria-label="Ordenar"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 5v14M6 19l-3-3M6 19l3-3M18 19V5M18 5l-3 3M18 5l3 3" />
                </svg>
              </button>
            </div>
          )}

          <input
            type="search"
            placeholder="Buscar por marca, modelo, versão ou placa"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
          />

          {vehicles.length === 0 ? (
            <EmptyNoVehicles />
          ) : sorted.length === 0 ? (
            <EmptyFiltered query={query} filterKey={filterKey} onClearQuery={() => setQuery('')} onShowAll={() => setFilterKey('all')} />
          ) : (
            <ul className="space-y-2.5">
              {sorted.map((v) => (
                <VehicleCard key={v.id} vehicle={v} days={daysInStockFor(v, now)} onMenu={() => setMenuVehicle(v)} />
              ))}
            </ul>
          )}
        </>
      )}

      <ActionSheet open={sortOpen} onClose={() => setSortOpen(false)} title="Ordenar por">
        {SORT_OPTIONS.map((opt) => (
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

      <ActionSheet open={menuVehicle !== null} onClose={() => setMenuVehicle(null)} title={menuVehicle ? `${menuVehicle.brand} ${menuVehicle.model}` : undefined}>
        {menuVehicle && (
          <>
            <ActionSheetItem onClick={() => navigate(`/estoque/${menuVehicle.id}`)}>Ver detalhes</ActionSheetItem>
            <ActionSheetItem onClick={() => navigate(`/estoque/${menuVehicle.id}/editar`)}>Editar</ActionSheetItem>
            {menuVehicle.status === 'available' && <ActionSheetItem onClick={() => navigate(`/vender/${menuVehicle.id}`)}>Vender</ActionSheetItem>}
          </>
        )}
      </ActionSheet>
    </div>
  )
}

// --- Resumo executivo -----------------------------------------------------

function StockHero({ summary }: { summary: StockSummary }) {
  return (
    <Card>
      <div className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <span className="text-[26px] font-bold leading-none tracking-tight text-slate-900 dark:text-slate-50">{summary.count}</span>
          <span className="text-sm font-medium text-slate-400">{summary.count === 1 ? 'veículo' : 'veículos'}</span>
        </div>
        <span className="shrink-0 text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">{fmtBRL(summary.totalValue)}</span>
      </div>

      <div className="mt-3 h-px bg-slate-100 dark:bg-slate-800" />

      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3">
        <MiniStat label="Ticket médio" value={summary.avgTicket !== null ? fmtBRL(summary.avgTicket) : '—'} />
        <MiniStat label="Idade média" value={summary.avgDays !== null ? `${summary.avgDays} dias` : '—'} />
        <MiniStat label="+30 dias" value={String(summary.over30)} tone={summary.over30 > 0 ? 'text-amber-600 dark:text-amber-400' : undefined} />
        <MiniStat label="+60 dias" value={String(summary.over60)} tone={summary.over60 > 0 ? 'text-red-600 dark:text-red-400' : undefined} />
      </div>

      {summary.unknownDatesCount > 0 && (
        <p className="mt-3 text-[11px] text-slate-400">
          {summary.unknownDatesCount === 1 ? '1 veículo sem data de entrada' : `${summary.unknownDatesCount} veículos sem data de entrada`}
        </p>
      )}
    </Card>
  )
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className={`truncate text-sm font-semibold ${tone ?? 'text-slate-900 dark:text-slate-50'}`}>{value}</p>
    </div>
  )
}

// --- Filtros ---------------------------------------------------------------

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? 'bg-slate-900 text-white dark:bg-slate-50 dark:text-slate-900' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
      }`}
    >
      {children}
    </button>
  )
}

// --- Card de veículo ---------------------------------------------------------

function VehicleCard({ vehicle, days, onMenu }: { vehicle: Vehicle; days: number | null; onMenu: () => void }) {
  const daysColor = days === null ? '' : days >= 60 ? 'text-red-600 dark:text-red-400' : days >= 30 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
  const statusColor = vehicle.status === 'available' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'

  return (
    <li className="relative">
      <Link to={`/estoque/${vehicle.id}`} className="block rounded-2xl border border-slate-200 bg-white p-3.5 pr-10 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="truncate pr-1 text-[15px] font-semibold text-slate-900 dark:text-slate-50">
          {vehicle.brand} {vehicle.model}
          {vehicle.trim && <span className="font-normal text-slate-500 dark:text-slate-400"> · {vehicle.trim}</span>}
        </p>

        <div className="mt-0.5 flex items-baseline justify-between gap-2">
          <span className="truncate text-xs text-slate-400">
            {vehicle.model_year ?? 'Ano não informado'} · {vehicle.plate ?? 'Placa não informada'}
          </span>
          <span className="shrink-0 text-lg font-bold text-slate-900 dark:text-slate-50">
            {vehicle.asking_price !== null ? fmtBRL(vehicle.asking_price) : 'Sem preço'}
          </span>
        </div>

        <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
          <span className="shrink-0">
            <span className={`font-semibold ${statusColor}`}>{STATUS_LABEL[vehicle.status]}</span>
            {days !== null && (
              <>
                <span className="text-slate-300 dark:text-slate-600"> · </span>
                <span className={`font-semibold ${daysColor}`}>
                  {days} {days === 1 ? 'dia' : 'dias'} em estoque
                </span>
              </>
            )}
          </span>
          <span className="min-w-0 truncate text-right text-slate-400">
            {vehicle.entry_date ? `Entrada: ${fmtDateShort(vehicle.entry_date)}` : 'Data de entrada não informada'}
          </span>
        </div>
      </Link>

      <button
        type="button"
        onClick={onMenu}
        aria-label={`Mais ações para ${vehicle.brand} ${vehicle.model}`}
        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full text-slate-300 hover:bg-slate-100 hover:text-slate-500 dark:text-slate-600 dark:hover:bg-slate-800"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="1.75" />
          <circle cx="12" cy="12" r="1.75" />
          <circle cx="12" cy="19" r="1.75" />
        </svg>
      </button>
    </li>
  )
}

// --- Estados vazios ----------------------------------------------------------

function EmptyState({ title, note, action }: { title: string; note?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-6 text-center dark:border-slate-700 dark:bg-slate-900/40">
      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{title}</p>
      {note && <p className="mt-1 text-xs text-slate-400">{note}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

function EmptyNoVehicles() {
  return (
    <EmptyState
      title="Nenhum veículo cadastrado ainda."
      note="Cadastre o primeiro veículo para começar a montar o estoque."
      action={
        <Link to="/estoque/novo" className="inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white dark:bg-slate-50 dark:text-slate-900">
          + Cadastrar veículo
        </Link>
      }
    />
  )
}

function EmptyFiltered({
  query,
  filterKey,
  onClearQuery,
  onShowAll,
}: {
  query: string
  filterKey: StockFilterKey
  onClearQuery: () => void
  onShowAll: () => void
}) {
  if (query.trim()) {
    return (
      <EmptyState
        title={`Nenhum veículo encontrado para "${query}"`}
        action={
          <button type="button" onClick={onClearQuery} className="text-sm font-medium text-slate-600 underline dark:text-slate-300">
            Limpar busca
          </button>
        }
      />
    )
  }

  const byFilter: Record<Exclude<StockFilterKey, 'all'>, { title: string; note?: string }> = {
    available: { title: 'Nenhum veículo disponível no momento.' },
    reserved: { title: 'Nenhum veículo reservado no momento.' },
    over30: { title: 'Nenhum veículo há mais de 30 dias no estoque.', note: 'Ótimo sinal de giro do estoque.' },
    over60: { title: 'Nenhum veículo há mais de 60 dias no estoque.', note: 'Ótimo sinal de giro do estoque.' },
  }
  const copy = filterKey === 'all' ? { title: 'Nada por aqui.' } : byFilter[filterKey]

  return (
    <EmptyState
      title={copy.title}
      note={copy.note}
      action={
        filterKey !== 'all' && (
          <button type="button" onClick={onShowAll} className="text-sm font-medium text-slate-600 underline dark:text-slate-300">
            Ver todos
          </button>
        )
      }
    />
  )
}

// --- Loading -----------------------------------------------------------------

function StockSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <SkeletonBlock className="h-32" />
      <SkeletonBlock className="h-9" />
      <SkeletonBlock className="h-11" />
      <div className="space-y-2.5">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonBlock key={i} className="h-[92px]" />
        ))}
      </div>
    </div>
  )
}
