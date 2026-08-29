import { describe, expect, it } from 'vitest'
import { parseVehicleDescription } from '../vehicle-description'

describe('parseVehicleDescription', () => {
  it('recognizes a known model even when the "Marca" cell holds only the model name (the workbook majority case)', () => {
    const result = parseVehicleDescription('Renault Kwid   2021', '1.0')
    expect(result.parsedBrand).toBe('Renault')
    expect(result.parsedYear).toBe(2021)
  })

  it('recognizes a model-only cell with no brand word at all', () => {
    const result = parseVehicleDescription('Agile/2013', null)
    expect(result.parsedBrand).toBe('Chevrolet')
    expect(result.parsedModel).toBe('Agile')
    expect(result.parsedYear).toBe(2013)
  })

  it('falls back to an explicit brand word when present', () => {
    const result = parseVehicleDescription('Ford Fiesta 2008', 'Hatch 1.0')
    expect(result.parsedBrand).toBe('Ford')
    expect(result.parsedYear).toBe(2008)
  })

  it('stays low-confidence and null rather than guessing an unrecognized description', () => {
    const result = parseVehicleDescription('Palo Weekend', null)
    expect(result.parsedBrand).toBeNull()
    expect(result.confidence).toBe('low')
  })

  it('does not fabricate a brand/model for an empty description', () => {
    const result = parseVehicleDescription(null, null)
    expect(result.parsedBrand).toBeNull()
    expect(result.parsedModel).toBeNull()
    expect(result.parsedYear).toBeNull()
  })
})
