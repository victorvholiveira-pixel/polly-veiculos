import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { SkeletonBlock } from '@/components/ui/Skeleton'
import { fmtBRL, fmtDateLong } from '@/lib/format'
import { daysInStockFor } from '@/lib/data/stockSummary'
import { fetchVehicle, type Vehicle } from '@/lib/data/vehicles'

const statusLabel: Record<Vehicle['status'], string> = {
  available: 'Disponível',
  reserved: 'Reservado',
  sold: 'Vendido',
}

export function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    fetchVehicle(id)
      .then(setVehicle)
      .catch(() => setError('Não foi possível carregar este veículo agora.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="space-y-4" aria-hidden="true">
        <SkeletonBlock className="h-9 w-2/3" />
        <SkeletonBlock className="h-10 w-1/2" />
        <SkeletonBlock className="h-40" />
        <SkeletonBlock className="h-12" />
        <SkeletonBlock className="h-12" />
      </div>
    )
  }
  if (error) return <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>
  if (!vehicle) return <p className="text-slate-500 dark:text-slate-400">Veículo não encontrado.</p>

  const days = daysInStockFor(vehicle, new Date())
  const daysColor = days === null ? 'text-slate-500 dark:text-slate-400' : days >= 60 ? 'text-red-600 dark:text-red-400' : days >= 30 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
  const statusColor = vehicle.status === 'available' ? 'text-emerald-600 dark:text-emerald-400' : vehicle.status === 'reserved' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
          {vehicle.brand} {vehicle.model}
        </h1>
        {vehicle.trim && <p className="text-slate-500 dark:text-slate-400">{vehicle.trim}</p>}
      </div>

      <p className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">{vehicle.asking_price !== null ? fmtBRL(vehicle.asking_price) : 'Preço não informado'}</p>

      <Card>
        <dl className="grid grid-cols-2 gap-4">
          <Field label="Ano" value={vehicle.model_year?.toString() ?? '—'} />
          <Field label="Placa" value={vehicle.plate ?? '—'} />
          <Field label="Status" value={statusLabel[vehicle.status]} valueClassName={statusColor} />
          <Field label="Dias em estoque" value={days !== null ? `${days} ${days === 1 ? 'dia' : 'dias'}` : '—'} valueClassName={daysColor} />
          <Field label="Entrada" value={vehicle.entry_date ? fmtDateLong(vehicle.entry_date) : 'Não informada'} />
          <Field label="Origem" value={vehicle.origin === 'manual' ? 'Cadastrado no app' : 'Migrado da planilha'} />
        </dl>
      </Card>

      {vehicle.observations && (
        <Card>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Observações</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{vehicle.observations}</p>
        </Card>
      )}

      <div className="space-y-2">
        {vehicle.status === 'available' && (
          <Link
            to={`/vender/${vehicle.id}`}
            className="block w-full rounded-lg bg-slate-900 py-2.5 text-center text-base font-medium text-white dark:bg-slate-50 dark:text-slate-900"
          >
            Vender
          </Link>
        )}
        <Link
          to={`/estoque/${vehicle.id}/editar`}
          className="block w-full rounded-lg border border-slate-300 py-2.5 text-center text-base font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
        >
          Editar
        </Link>
      </div>
    </div>
  )
}

function Field({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className={`text-sm font-semibold ${valueClassName ?? 'text-slate-900 dark:text-slate-50'}`}>{value}</dd>
    </div>
  )
}
