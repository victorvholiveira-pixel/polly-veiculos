import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { createSeller, fetchActiveSellers, registerSale, type Seller } from '@/lib/data/sales'
import { fetchVehicle, type Vehicle } from '@/lib/data/vehicles'

const NEW_SELLER_OPTION = '__new__'

function fmtBRL(n: number | null): string {
  return n === null ? 'Sem preço' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Passo 2 do fluxo Vender: formulário da venda para o veículo já escolhido. */
export function SellFormPage() {
  const { vehicleId } = useParams<{ vehicleId: string }>()
  const navigate = useNavigate()

  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [sellers, setSellers] = useState<Seller[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [saleDate, setSaleDate] = useState(todayISO())
  const [saleValue, setSaleValue] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [sellerChoice, setSellerChoice] = useState('')
  const [newSellerName, setNewSellerName] = useState('')
  const [commission, setCommission] = useState('')
  const [observations, setObservations] = useState('')

  const [errors, setErrors] = useState<{ saleDate?: string; saleValue?: string }>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (!vehicleId) return
    Promise.all([fetchVehicle(vehicleId), fetchActiveSellers()])
      .then(([v, s]) => {
        setVehicle(v)
        setSellers(s)
        if (v?.asking_price) setSaleValue(String(v.asking_price))
      })
      .catch(() => setLoadError('Não foi possível carregar os dados agora. Confira a conexão e tente de novo.'))
      .finally(() => setLoading(false))
  }, [vehicleId])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!vehicleId) return

    const validationErrors: typeof errors = {}
    if (!saleDate) validationErrors.saleDate = 'Informe a data da venda.'
    const valueNumber = Number(saleValue)
    if (!saleValue || Number.isNaN(valueNumber) || valueNumber < 0) validationErrors.saleValue = 'Informe um valor válido.'
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) return

    setSubmitting(true)
    setSubmitError(null)
    try {
      let sellerId: string | undefined
      if (sellerChoice === NEW_SELLER_OPTION) {
        if (newSellerName.trim()) {
          const seller = await createSeller(newSellerName.trim())
          sellerId = seller.id
        }
      } else if (sellerChoice) {
        sellerId = sellerChoice
      }

      await registerSale({
        vehicleId,
        saleDate,
        saleValue: valueNumber,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        sellerId,
        commissionAmount: commission ? Number(commission) : undefined,
        observations: observations.trim() || undefined,
      })
      navigate('/historico', { replace: true })
    } catch {
      setSubmitError('Não foi possível registrar a venda agora. Confira a conexão e tente de novo.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <p className="text-slate-500 dark:text-slate-400">Carregando…</p>
  if (loadError) return <p role="alert" className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
  if (!vehicle) return <p className="text-slate-500 dark:text-slate-400">Veículo não encontrado.</p>
  if (vehicle.status !== 'available') {
    return (
      <div className="space-y-3">
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Este veículo não está mais disponível para venda.
        </p>
        <Link to="/vender" className="block text-sm font-medium text-slate-700 underline dark:text-slate-300">
          Escolher outro veículo
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
          Vender {vehicle.brand} {vehicle.model}
        </h1>
        <p className="text-slate-500 dark:text-slate-400">
          {vehicle.plate ?? 'Placa não informada'} · Anunciado por {fmtBRL(vehicle.asking_price)}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Data da venda" value={saleDate} error={errors.saleDate} onChange={setSaleDate} type="date" required />
          <TextField label="Valor da venda (R$)" value={saleValue} error={errors.saleValue} onChange={setSaleValue} type="number" required />
        </div>
        <TextField label="Comprador (opcional)" value={customerName} onChange={setCustomerName} />
        <TextField label="Telefone do comprador (opcional)" value={customerPhone} onChange={setCustomerPhone} />

        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Vendedor (opcional)
          <select
            value={sellerChoice}
            onChange={(e) => setSellerChoice(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base font-normal text-slate-900 outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
          >
            <option value="">Não informar</option>
            {sellers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            <option value={NEW_SELLER_OPTION}>+ Adicionar novo vendedor</option>
          </select>
        </label>
        {sellerChoice === NEW_SELLER_OPTION && (
          <TextField label="Nome do novo vendedor" value={newSellerName} onChange={setNewSellerName} />
        )}

        <TextField
          label="Comissão (R$, opcional)"
          value={commission}
          onChange={setCommission}
          type="number"
          hint="Ainda não temos uma regra automática — preencha só se já souber o valor."
        />

        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Observações (opcional)
          <textarea
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base font-normal text-slate-900 outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
          />
        </label>

        {submitError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{submitError}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-slate-900 py-2.5 text-base font-medium text-white disabled:opacity-60 dark:bg-slate-50 dark:text-slate-900"
        >
          {submitting ? 'Registrando…' : 'Confirmar venda'}
        </button>
      </form>
    </div>
  )
}

function TextField({
  label,
  value,
  error,
  hint,
  onChange,
  type = 'text',
  required = false,
}: {
  label: string
  value: string
  error?: string
  hint?: string
  onChange: (v: string) => void
  type?: string
  required?: boolean
}) {
  return (
    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
      {label}
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base font-normal text-slate-900 outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
      />
      {error && <span className="mt-1 block text-xs font-normal text-red-600 dark:text-red-400">{error}</span>}
      {!error && hint && <span className="mt-1 block text-xs font-normal text-slate-400">{hint}</span>}
    </label>
  )
}
