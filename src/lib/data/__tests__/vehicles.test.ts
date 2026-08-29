import { describe, expect, it } from 'vitest'
import { searchVehicles } from '../vehicles'
import type { Vehicle } from '../vehicles'

function vehicle(overrides: Partial<Vehicle>): Vehicle {
  return {
    id: 'id',
    brand: 'Fiat',
    model: 'Uno',
    trim: null,
    model_year: 2015,
    manufacture_year: null,
    plate: 'ABC1234',
    plate_format: 'old',
    asking_price: 25900,
    entry_date: null,
    origin: 'manual',
    status: 'available',
    observations: null,
    founding_occurrence_id: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('searchVehicles', () => {
  const vehicles = [
    vehicle({ id: '1', brand: 'Fiat', model: 'Uno', plate: 'ABC1234' }),
    vehicle({ id: '2', brand: 'Honda', model: 'Civic', trim: 'LXR 2.0', plate: 'XYZ9876' }),
    vehicle({ id: '3', brand: 'Ford', model: 'Ka', plate: null }),
  ]

  it('returns everything for an empty query', () => {
    expect(searchVehicles(vehicles, '')).toHaveLength(3)
    expect(searchVehicles(vehicles, '   ')).toHaveLength(3)
  })

  it('matches by brand, case-insensitively', () => {
    expect(searchVehicles(vehicles, 'honda').map((v) => v.id)).toEqual(['2'])
  })

  it('matches by model', () => {
    expect(searchVehicles(vehicles, 'civic').map((v) => v.id)).toEqual(['2'])
  })

  it('matches by trim', () => {
    expect(searchVehicles(vehicles, 'lxr').map((v) => v.id)).toEqual(['2'])
  })

  it('matches by plate', () => {
    expect(searchVehicles(vehicles, 'abc1234').map((v) => v.id)).toEqual(['1'])
  })

  it('never throws on a vehicle with a null plate', () => {
    expect(() => searchVehicles(vehicles, 'ka')).not.toThrow()
    expect(searchVehicles(vehicles, 'ka').map((v) => v.id)).toEqual(['3'])
  })

  it('returns nothing for a query matching no vehicle', () => {
    expect(searchVehicles(vehicles, 'zzz-not-here')).toHaveLength(0)
  })
})
