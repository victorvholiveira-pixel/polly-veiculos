import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchVehicle, type Vehicle } from '@/lib/data/vehicles'

function fmtBRL(n: number | null): string {
  return n === null ? 'Não informado' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

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

  if (loading) return <p className="text-slate-500 dark:text-slate-400">Carregando…</p>
  if (error) return <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>
  if (!vehicle) return <p className="text-slate-500 dark:text-slate-400">Veículo não encontrado.</p>

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
          {vehicle.brand} {vehicle.model}
        </h1>
        {vehicle.trim && <p className="text-slate-500 dark:text-slate-400">{vehicle.trim}</p>}
      </div>

      <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">{fmtBRL(vehicle.asking_price)}</p>

      <dl className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <Field label="Ano" value={vehicle.model_year?.toString() ?? '—'} />
        <Field label="Placa" value={vehicle.plate ?? '—'} />
        <Field label="Status" value={statusLabel[vehicle.status]} />
        <Field label="Origem" value={vehicle.origin === 'manual' ? 'Cadastrado no app' : 'Migrado da planilha'} />
      </dl>

      {vehicle.observations && (
        <div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Observações</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">{vehicle.observations}</p>
        </div>
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="text-sm font-medium text-slate-900 dark:text-slate-50">{value}</dd>
    </div>
  )
}
