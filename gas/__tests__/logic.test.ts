import { describe, expect, it } from 'vitest'
import { loadGasContext } from './gasHarness'

function ctx() {
  return loadGasContext()
}

describe('Auth', () => {
  it('setup() generates a login password and an admin secret, logged once', () => {
    const g = ctx()
    g.setup()
    expect(g.logs.some((l: string) => l.includes('Senha de login gerada'))).toBe(true)
    expect(g.logs.some((l: string) => l.includes('ADMIN_SECRET gerado'))).toBe(true)
  })

  it('login_ issues a token that verifyToken_ accepts, and rejects the wrong password', () => {
    const g = ctx()
    g.setup()
    const password = g.logs.find((l: string) => l.includes('Senha de login gerada')).split(': ')[1]

    const { token } = g.login_({ name: 'Victor', password }) as { token: string }
    expect(typeof token).toBe('string')
    const payload = g.verifyToken_(token) as { name: string }
    expect(payload.name).toBe('Victor')

    expect(() => g.login_({ name: 'Victor', password: 'senha-errada' })).toThrow(/senha incorreta/)
  })

  it('authenticate_ accepts the ADMIN_SECRET without a user token', () => {
    const g = ctx()
    g.setup()
    const adminSecret = g.logs.find((l: string) => l.includes('ADMIN_SECRET gerado')).split(': ')[1]
    expect(g.authenticate_({ adminSecret })).toBe('admin')
    expect(() => g.authenticate_({ token: 'garbage' })).toThrow()
  })
})

function setupAndLogin(g: ReturnType<typeof loadGasContext>) {
  g.setup()
  const password = g.logs.find((l: string) => l.includes('Senha de login gerada')).split(': ')[1]
  const { token } = g.login_({ name: 'Victor', password }) as { token: string }
  return token
}

describe('Vehicles', () => {
  it('createVehicle_ sets origin/status and writes an audit_log entry', () => {
    const g = ctx()
    setupAndLogin(g)
    const v = g.createVehicle_({ brand: 'Fiat', model: 'Uno', plate: 'ABC1234' }, 'Victor') as { id: string; origin: string; status: string }
    expect(v.origin).toBe('manual')
    expect(v.status).toBe('available')

    const log = g.fetchAuditLog_({}) as Array<{ entity_id: string; action: string }>
    expect(log.some((l) => l.entity_id === v.id && l.action === 'vehicle_created')).toBe(true)
  })

  it('rejects a second active vehicle with the same plate', () => {
    const g = ctx()
    setupAndLogin(g)
    g.createVehicle_({ brand: 'Fiat', model: 'Uno', plate: 'XYZ9999' }, 'Victor')
    expect(() => g.createVehicle_({ brand: 'Ford', model: 'Ka', plate: 'XYZ9999' }, 'Victor')).toThrow(/já existe um veículo ativo/i)
  })

  it('updateVehicle_ never changes status, even if the caller sends one', () => {
    const g = ctx()
    setupAndLogin(g)
    const v = g.createVehicle_({ brand: 'Fiat', model: 'Uno' }, 'Victor') as { id: string }
    const updated = g.updateVehicle_({ id: v.id, brand: 'Fiat', model: 'Uno (editado)', status: 'sold' }, 'Victor') as { status: string; model: string }
    expect(updated.status).toBe('available')
    expect(updated.model).toBe('Uno (editado)')

    const log = g.fetchAuditLog_({}) as Array<{ entity_id: string; action: string }>
    expect(log.some((l) => l.entity_id === v.id && l.action === 'vehicle_updated')).toBe(true)
  })
})

describe('registerSale_ / cancelSale_', () => {
  it('registers a sale, marks the vehicle sold, and audits it', () => {
    const g = ctx()
    setupAndLogin(g)
    const v = g.createVehicle_({ brand: 'Fiat', model: 'Uno' }, 'Victor') as { id: string }

    const sale = g.registerSale_({ vehicleId: v.id, saleDate: '2026-08-20', saleValue: 25900 }, 'Victor') as {
      id: string
      status: string
    }
    expect(sale.status).toBe('completed')

    const vehicle = g.fetchVehicle_({ id: v.id }) as { status: string }
    expect(vehicle.status).toBe('sold')

    const log = g.fetchAuditLog_({}) as Array<{ entity_id: string; action: string }>
    expect(log.some((l) => l.entity_id === sale.id && l.action === 'sale_registered')).toBe(true)
  })

  it('rejects selling a vehicle that is not available', () => {
    const g = ctx()
    setupAndLogin(g)
    const v = g.createVehicle_({ brand: 'Fiat', model: 'Uno' }, 'Victor') as { id: string }
    g.registerSale_({ vehicleId: v.id, saleDate: '2026-08-20', saleValue: 1000 }, 'Victor')
    expect(() => g.registerSale_({ vehicleId: v.id, saleDate: '2026-08-21', saleValue: 500 }, 'Victor')).toThrow(/não está disponível/)
  })

  it('rejects a negative sale value', () => {
    const g = ctx()
    setupAndLogin(g)
    const v = g.createVehicle_({ brand: 'Fiat', model: 'Uno' }, 'Victor') as { id: string }
    expect(() => g.registerSale_({ vehicleId: v.id, saleDate: '2026-08-20', saleValue: -1 }, 'Victor')).toThrow(/inválido/)
  })

  it('cancels a sale, reverts the vehicle, and requires a reason', () => {
    const g = ctx()
    setupAndLogin(g)
    const v = g.createVehicle_({ brand: 'Fiat', model: 'Uno' }, 'Victor') as { id: string }
    const sale = g.registerSale_({ vehicleId: v.id, saleDate: '2026-08-20', saleValue: 25900 }, 'Victor') as { id: string }

    expect(() => g.cancelSale_({ saleId: sale.id, reason: '' }, 'Victor')).toThrow(/motivo/)

    const cancelled = g.cancelSale_({ saleId: sale.id, reason: 'Cliente desistiu' }, 'Victor') as { status: string; cancelled_reason: string }
    expect(cancelled.status).toBe('cancelled')
    expect(cancelled.cancelled_reason).toBe('Cliente desistiu')

    const vehicle = g.fetchVehicle_({ id: v.id }) as { status: string }
    expect(vehicle.status).toBe('available')

    expect(() => g.cancelSale_({ saleId: sale.id, reason: 'de novo' }, 'Victor')).toThrow(/não está ativa/)
  })
})

describe('Review Center provenance', () => {
  it('decideInventoryCandidate_ only writes overlay fields, never the raw/parsed ones', () => {
    const g = ctx()
    setupAndLogin(g)
    const occ = g.appendRow_('VehicleOccurrences', {
      source_sheet: 'AGO 2026', source_row: 1, period: '2026-08-01', observed_status: 'stock',
      parsed_brand: 'Fiat', data_quality: 'reliable',
    }) as { id: string; parsed_brand: string }

    g.decideInventoryCandidate_({ occurrenceId: occ.id, decision: 'edited_and_approved', corrections: { brand: 'Fiat (confirmado)' } }, 'Victor')

    const after = g.findById_('VehicleOccurrences', occ.id) as { parsed_brand: string; confirmed_brand: string; review_decision: string }
    expect(after.parsed_brand).toBe('Fiat') // original never touched
    expect(after.confirmed_brand).toBe('Fiat (confirmado)')
    expect(after.review_decision).toBe('edited_and_approved')
  })
})

describe('createInitialInventory_', () => {
  it('imports only approved candidates from the latest period, and is idempotent', () => {
    const g = ctx()
    setupAndLogin(g)
    g.appendRow_('VehicleOccurrences', {
      source_sheet: 'AGO 2026', source_row: 1, period: '2026-08-01', observed_status: 'stock',
      parsed_brand: 'Fiat', parsed_model: 'Uno', value_parsed: 25900, review_decision: 'approved',
    })
    g.appendRow_('VehicleOccurrences', {
      source_sheet: 'AGO 2026', source_row: 2, period: '2026-08-01', observed_status: 'stock',
      parsed_brand: 'Ford', parsed_model: 'Ka', review_decision: 'rejected',
    })
    g.appendRow_('VehicleOccurrences', {
      source_sheet: 'AGO 2026', source_row: 3, period: '2026-08-01', observed_status: 'stock',
      parsed_brand: 'Honda', parsed_model: 'Civic', review_decision: 'pending',
    })

    const created = g.createInitialInventory_({ batchLabel: 'batch-1' }, 'Victor') as unknown[]
    expect(created).toHaveLength(1)

    const vehicles = g.fetchVehicles_({ status: 'all' }) as Array<{ brand: string; origin: string }>
    expect(vehicles.some((v) => v.brand === 'Fiat' && v.origin === 'migration')).toBe(true)
    expect(vehicles.some((v) => v.brand === 'Ford' || v.brand === 'Honda')).toBe(false)

    const secondRun = g.createInitialInventory_({ batchLabel: 'batch-2' }, 'Victor') as unknown[]
    expect(secondRun).toHaveLength(0)
  })
})

describe('bulkLoadOccurrences_', () => {
  it('dedupes by (source_sheet, source_row) on repeated loads', () => {
    const g = ctx()
    setupAndLogin(g)
    const rows = [
      { source_sheet: 'AGO 2026', source_row: 1, period: '2026-08-01', observed_status: 'stock' },
      { source_sheet: 'AGO 2026', source_row: 2, period: '2026-08-01', observed_status: 'stock' },
    ]
    const first = g.bulkLoadOccurrences_({ rows }) as { inserted: number; skipped: number }
    expect(first).toEqual({ inserted: 2, skipped: 0 })

    const second = g.bulkLoadOccurrences_({ rows }) as { inserted: number; skipped: number }
    expect(second).toEqual({ inserted: 0, skipped: 2 })
  })
})

describe('plate reuse', () => {
  it('frees the plate once the prior vehicle is sold, but blocks cancelSale_ from reactivating into a collision', () => {
    const g = ctx()
    setupAndLogin(g)
    const v1 = g.createVehicle_({ brand: 'Fiat', model: 'Uno', plate: 'ZZZ9999' }, 'Victor') as { id: string }
    const sale = g.registerSale_({ vehicleId: v1.id, saleDate: '2026-08-20', saleValue: 20000 }, 'Victor') as { id: string }

    // Plate is free again now that v1 is sold — a new vehicle can claim it.
    const v2 = g.createVehicle_({ brand: 'Ford', model: 'Ka', plate: 'ZZZ9999' }, 'Victor') as { id: string }
    expect(v2.id).not.toBe(v1.id)

    // Cancelling the original sale would reactivate v1 with the same plate v2 now holds.
    expect(() => g.cancelSale_({ saleId: sale.id, reason: 'Erro de digitação' }, 'Victor')).toThrow(/já está em uso por outro veículo ativo/)
    // Nothing was left half-changed by the failed attempt.
    const stillSold = g.fetchVehicle_({ id: v1.id }) as { status: string }
    expect(stillSold.status).toBe('sold')
  })
})

describe('AppSettings', () => {
  it('updateDefaultCommissionPct_ updates the singleton row', () => {
    const g = ctx()
    setupAndLogin(g)
    expect((g.fetchAppSettings_({}) as { default_commission_pct: number | null }).default_commission_pct).toBeNull()
    g.updateDefaultCommissionPct_({ pct: 2.5 })
    expect((g.fetchAppSettings_({}) as { default_commission_pct: number | null }).default_commission_pct).toBe(2.5)
  })
})

describe('P1/P3 review (match candidates)', () => {
  it('splits conflicts (brand-contradiction) from other candidate_review items, and records decisions', () => {
    const g = ctx()
    setupAndLogin(g)
    g.bulkLoadOccurrences_({
      rows: [
        { source_sheet: 'AGO 2026', source_row: 1, period: '2026-08-01', observed_status: 'stock', parsed_brand: 'Ford' },
        { source_sheet: 'SET 2026', source_row: 2, period: '2026-09-01', observed_status: 'stock', parsed_brand: 'Honda' },
      ],
    })
    g.bulkLoadMatchCandidates_({
      rows: [
        {
          occurrence_a_key: 'AGO 2026#1', occurrence_b_key: 'veh_1:last', tier: 1, score: 0.4,
          reasons_for: [], reasons_against: ['brand conflict: Ford vs Honda'], suggested_decision: 'candidate_review', auto_match_allowed: false,
        },
        {
          occurrence_a_key: 'SET 2026#2', occurrence_b_key: 'veh_2:last', tier: 3, score: 0.7,
          reasons_for: ['same brand'], reasons_against: [], suggested_decision: 'candidate_review', auto_match_allowed: false,
        },
      ],
    })

    const conflicts = g.fetchConflicts_() as Array<{ id: string; occurrenceA: { sourceSheet: string } }>
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]!.occurrenceA.sourceSheet).toBe('AGO 2026')

    const other = g.fetchOtherReview_() as Array<{ id: string }>
    expect(other).toHaveLength(1)

    g.decideMatchCandidate_({ candidateId: other[0]!.id, decision: 'same_vehicle' }, 'Victor')
    const updated = g.fetchOtherReview_() as Array<{ id: string; decision: string }>
    expect(updated[0]!.decision).toBe('same_vehicle')
  })
})

describe('P2 ambiguous sales', () => {
  it('lists sale_ambiguous occurrences and records a review decision without touching raw fields', () => {
    const g = ctx()
    setupAndLogin(g)
    const occ = g.appendRow_('VehicleOccurrences', {
      source_sheet: 'AGO 2026', source_row: 5, period: '2026-08-01', observed_status: 'sold',
      sale_classification: 'sale_ambiguous', buyer_name_raw: null, value_parsed: 18000,
    }) as { id: string }

    const list = g.fetchAmbiguousSales_() as Array<{ id: string }>
    expect(list.some((o) => o.id === occ.id)).toBe(true)

    g.decideSale_({ occurrenceId: occ.id, decision: 'rejected', reason: 'Não foi venda' }, 'Victor')
    const after = g.findById_('VehicleOccurrences', occ.id) as { review_decision: string; value_parsed: number }
    expect(after.review_decision).toBe('rejected')
    expect(after.value_parsed).toBe(18000) // raw/parsed field untouched
  })
})

describe('Router (doPost end-to-end)', () => {
  it('rejects a protected action without a token, and serves it once logged in', () => {
    const g = ctx()
    g.setup()
    const password = g.logs.find((l: string) => l.includes('Senha de login gerada')).split(': ')[1]

    const unauthed = JSON.parse(
      (g.doPost({ postData: { contents: JSON.stringify({ action: 'fetchVehicles', status: 'all' }) } }) as { getContent: () => string }).getContent(),
    )
    expect(unauthed.error).toMatch(/faça login/)

    const loginRes = JSON.parse(
      (g.doPost({ postData: { contents: JSON.stringify({ action: 'login', name: 'Victor', password }) } }) as { getContent: () => string }).getContent(),
    )
    const token = loginRes.data.token as string

    const ok = JSON.parse(
      (g.doPost({ postData: { contents: JSON.stringify({ action: 'fetchVehicles', status: 'all', token }) } }) as { getContent: () => string }).getContent(),
    )
    expect(ok.data).toEqual([])
  })

  it('blocks a non-admin token from calling an admin-only action', () => {
    const g = ctx()
    const token = setupAndLogin(g)
    const res = JSON.parse(
      (g.doPost({ postData: { contents: JSON.stringify({ action: 'bulkLoadOccurrences', rows: [], token }) } }) as { getContent: () => string }).getContent(),
    )
    expect(res.error).toMatch(/restrito à automação/)
  })
})

describe('fetchDashboardStats_', () => {
  it('separates this-month from last-month sales for the comparison indicator', () => {
    const g = ctx()
    setupAndLogin(g)
    const v1 = g.createVehicle_({ brand: 'Fiat', model: 'Uno', asking_price: 20000 }, 'Victor') as { id: string }
    g.createVehicle_({ brand: 'Ford', model: 'Ka', asking_price: 15000 }, 'Victor')

    g.registerSale_({ vehicleId: v1.id, saleDate: '2026-08-15', saleValue: 25000, commissionAmount: 500 }, 'Victor')
    g.appendRow_('Sales', { vehicle_id: 'other', sale_date: '2026-07-10', sale_value: 10000, status: 'completed' })

    const stats = g.fetchDashboardStats_({ now: '2026-08-29T12:00:00Z' }) as {
      vehiclesInStock: number
      revenueThisMonth: number
      revenueLastMonth: number
      commissionThisMonth: number
    }
    expect(stats.vehiclesInStock).toBe(1)
    expect(stats.revenueThisMonth).toBe(25000)
    expect(stats.revenueLastMonth).toBe(10000)
    expect(stats.commissionThisMonth).toBe(500)
  })
})
