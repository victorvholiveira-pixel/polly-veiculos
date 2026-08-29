const PLATE_OLD = /^[A-Za-z]{3}\d{4}$/
const PLATE_MERCOSUL = /^[A-Za-z]{3}\d[A-Za-z]\d{2}$/

export interface VehicleFormState {
  brand: string
  model: string
  trim: string
  year: string
  plate: string
  value: string
  entryDate: string
}

export type VehicleFormErrors = Partial<Record<keyof VehicleFormState, string>>

/** Pure validation for the cadastro/edição form (Onda 3 §11). No side effects, no network. */
export function validateVehicleForm(state: VehicleFormState): VehicleFormErrors {
  const errors: VehicleFormErrors = {}
  if (!state.brand.trim()) errors.brand = 'Informe a marca'
  if (!state.model.trim()) errors.model = 'Informe o modelo'

  if (state.year) {
    const year = Number(state.year)
    const currentYear = new Date().getFullYear()
    if (!Number.isInteger(year) || year < 1950 || year > currentYear + 1) {
      errors.year = 'Ano inválido'
    }
  }

  if (state.plate) {
    const normalized = state.plate.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (!PLATE_OLD.test(normalized) && !PLATE_MERCOSUL.test(normalized)) {
      errors.plate = 'Placa não parece válida (formato antigo ABC1234 ou Mercosul ABC1D23)'
    }
  }

  if (state.value) {
    const value = Number(state.value)
    if (!Number.isFinite(value) || value < 0) errors.value = 'Valor inválido'
  }

  if (state.entryDate) {
    const today = new Date().toISOString().slice(0, 10)
    if (state.entryDate > today) errors.entryDate = 'Data de entrada não pode ser no futuro'
  }

  return errors
}
