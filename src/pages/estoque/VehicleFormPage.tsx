import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createVehicle, fetchVehicle, updateVehicle, type VehicleFormInput } from '@/lib/data/vehicles'
import { validateVehicleForm, type VehicleFormState as FormState } from '@/lib/validation/vehicleForm'

const EMPTY: FormState = { brand: '', model: '', trim: '', year: '', plate: '', value: '', entryDate: '' }

export function VehicleFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const [state, setState] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [loading, setLoading] = useState(isEdit)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    fetchVehicle(id)
      .then((v) => {
        if (!v) return
        setState({
          brand: v.brand,
          model: v.model,
          trim: v.trim ?? '',
          year: v.model_year?.toString() ?? '',
          plate: v.plate ?? '',
          value: v.asking_price?.toString() ?? '',
          entryDate: v.entry_date ?? '',
        })
      })
      .finally(() => setLoading(false))
  }, [id])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const validationErrors = validateVehicleForm(state)
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) return

    const input: VehicleFormInput = {
      brand: state.brand.trim(),
      model: state.model.trim(),
      trim: state.trim.trim() || null,
      model_year: state.year ? Number(state.year) : null,
      plate: state.plate ? state.plate.toUpperCase().replace(/[^A-Z0-9]/g, '') : null,
      asking_price: state.value ? Number(state.value) : null,
      entry_date: state.entryDate || null,
    }

    setSubmitting(true)
    setSubmitError(null)
    try {
      const vehicle = isEdit && id ? await updateVehicle(id, input) : await createVehicle(input)
      navigate(`/estoque/${vehicle.id}`, { replace: true })
    } catch {
      setSubmitError('Não foi possível salvar agora. Confira a conexão e tente de novo.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <p className="text-slate-500 dark:text-slate-400">Carregando…</p>

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
        {isEdit ? 'Editar veículo' : 'Adicionar veículo'}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-3">
        <TextField label="Marca" value={state.brand} error={errors.brand} onChange={(v) => setState({ ...state, brand: v })} required />
        <TextField label="Modelo" value={state.model} error={errors.model} onChange={(v) => setState({ ...state, model: v })} required />
        <TextField label="Versão (opcional)" value={state.trim} onChange={(v) => setState({ ...state, trim: v })} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Ano" value={state.year} error={errors.year} onChange={(v) => setState({ ...state, year: v })} type="number" />
          <TextField label="Placa" value={state.plate} error={errors.plate} onChange={(v) => setState({ ...state, plate: v })} />
        </div>
        <TextField label="Valor anunciado (R$)" value={state.value} error={errors.value} onChange={(v) => setState({ ...state, value: v })} type="number" />
        <TextField
          label="Data de entrada no estoque (opcional)"
          value={state.entryDate}
          error={errors.entryDate}
          onChange={(v) => setState({ ...state, entryDate: v })}
          type="date"
        />

        {submitError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{submitError}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-slate-900 py-2.5 text-base font-medium text-white disabled:opacity-60 dark:bg-slate-50 dark:text-slate-900"
        >
          {submitting ? 'Salvando…' : isEdit ? 'Salvar alterações' : 'Adicionar ao estoque'}
        </button>
      </form>
    </div>
  )
}

function TextField({
  label,
  value,
  error,
  onChange,
  type = 'text',
  required = false,
}: {
  label: string
  value: string
  error?: string
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
    </label>
  )
}
