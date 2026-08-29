import { describe, expect, it } from 'vitest'
import { validateVehicleForm, type VehicleFormState } from '../vehicleForm'

const BASE: VehicleFormState = { brand: 'Fiat', model: 'Uno', trim: '', year: '', plate: '', value: '', entryDate: '' }

describe('validateVehicleForm', () => {
  it('requires brand and model', () => {
    const errors = validateVehicleForm({ ...BASE, brand: '', model: '' })
    expect(errors.brand).toBeTruthy()
    expect(errors.model).toBeTruthy()
  })

  it('accepts a minimal valid form (only brand + model)', () => {
    expect(validateVehicleForm(BASE)).toEqual({})
  })

  it('accepts an old-format plate', () => {
    expect(validateVehicleForm({ ...BASE, plate: 'ABC1234' }).plate).toBeUndefined()
  })

  it('accepts a Mercosul-format plate', () => {
    expect(validateVehicleForm({ ...BASE, plate: 'ABC1D23' }).plate).toBeUndefined()
  })

  it('rejects a plate matching neither known format', () => {
    expect(validateVehicleForm({ ...BASE, plate: '123' }).plate).toBeTruthy()
  })

  it('rejects an implausible year', () => {
    expect(validateVehicleForm({ ...BASE, year: '1899' }).year).toBeTruthy()
    expect(validateVehicleForm({ ...BASE, year: '2999' }).year).toBeTruthy()
  })

  it('accepts a plausible year', () => {
    expect(validateVehicleForm({ ...BASE, year: '2020' }).year).toBeUndefined()
  })

  it('rejects a negative value', () => {
    expect(validateVehicleForm({ ...BASE, value: '-100' }).value).toBeTruthy()
  })

  it('accepts a positive value', () => {
    expect(validateVehicleForm({ ...BASE, value: '25900' }).value).toBeUndefined()
  })

  it('rejects an entry date in the future', () => {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
    expect(validateVehicleForm({ ...BASE, entryDate: tomorrow }).entryDate).toBeTruthy()
  })

  it('accepts a past or today entry date', () => {
    const today = new Date().toISOString().slice(0, 10)
    expect(validateVehicleForm({ ...BASE, entryDate: today }).entryDate).toBeUndefined()
    expect(validateVehicleForm({ ...BASE, entryDate: '2024-01-15' }).entryDate).toBeUndefined()
  })
})
