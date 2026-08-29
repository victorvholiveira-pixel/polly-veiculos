import { normalizeDate } from './normalize/date'
import { normalizePlate } from './normalize/plate'
import { normalizeText } from './normalize/text'
import { normalizeValue } from './normalize/value'
import { parseVehicleDescription } from './normalize/vehicle-description'
import { parseRow, type ParsedRawFields } from './row-parser'
import type { DataQuality, NormalizedOccurrence, ObservedStatus, RawRow, SheetLayout } from './types'

function isFlagSet(raw: unknown): boolean {
  if (typeof raw === 'number') return raw === 1
  const text = normalizeText(raw)
  return text === '1'
}

function hasAnyDateSignal(raw: unknown): boolean {
  return raw !== null && raw !== undefined && raw !== ''
}

interface StatusResult {
  status: ObservedStatus
  basis: string
  warning?: string
}

/**
 * Determines stock vs. sold. Eras with a dedicated flag column (L4+) treat
 * flag=1 as authoritative. Earlier eras (L2/L3) have no dedicated flag — only
 * an ad hoc "1" that sometimes appears in the Nome column — so the signal is
 * weaker and conflicts are flagged rather than silently resolved one way.
 * L1 has no stock concept at all (see eras.ts).
 */
function determineObservedStatus(
  layout: SheetLayout,
  fields: ParsedRawFields,
  saleDateValidation: string,
): StatusResult {
  if (layout.allRowsSold) {
    return { status: 'sold', basis: 'era has no stock concept — whole sheet is a sales log' }
  }

  const hasDate = hasAnyDateSignal(fields.saleDateRaw)
  const dateIsValid = saleDateValidation === 'valid'

  if (layout.columns.flag !== undefined) {
    const flagged = isFlagSet(fields.stockFlagRaw)
    if (flagged && hasDate) {
      return {
        status: 'sold',
        basis: 'stock flag is set but a sale date is also present — trusting the date (stronger signal)',
        warning: 'conflicting signals: stock flag = 1 and a sale date are both present',
      }
    }
    if (flagged) return { status: 'stock', basis: 'stock flag column = 1' }
    if (hasDate) return { status: 'sold', basis: dateIsValid ? 'sale date present, flag column empty' : 'flag column empty and a (possibly invalid) sale date is present' }
    return { status: 'stock', basis: 'no flag and no date — defaulted to stock', warning: 'no positive signal for stock vs. sold; defaulted to stock' }
  }

  // L2/L3: ad hoc flag riding in the "Nome" column.
  const adHocFlagged = isFlagSet(fields.stockFlagRaw)
  if (adHocFlagged && hasDate) {
    return {
      status: 'sold',
      basis: 'ad hoc flag (Nome column = 1) and a sale date are both present — trusting the date',
      warning: 'conflicting signals: ad hoc stock flag and a sale date are both present',
    }
  }
  if (adHocFlagged) return { status: 'stock', basis: 'ad hoc flag: Nome column holds 1 instead of a name' }
  if (hasDate) return { status: 'sold', basis: 'sale date present' }
  return { status: 'stock', basis: 'no flag and no date — defaulted to stock', warning: 'no positive signal for stock vs. sold; defaulted to stock' }
}

function classifyQuality(o: {
  plateFormat: string
  descriptionConfidence: string
  valueValidation: string
  saleDateValidation: string
  observedStatus: ObservedStatus
  hasStatusWarning: boolean
  hasBrandOrPlate: boolean
}): DataQuality {
  if (!o.hasBrandOrPlate) return 'invalid'
  if (o.hasStatusWarning) return 'ambiguous'

  const plateOk = o.plateFormat === 'old' || o.plateFormat === 'mercosul'
  const descOk = o.descriptionConfidence !== 'low'
  const valueOk = o.valueValidation === 'valid'
  const dateOk = o.observedStatus === 'stock' || o.saleDateValidation === 'valid'

  if (plateOk && descOk && valueOk && dateOk) return 'reliable'
  if ((plateOk || descOk) && (valueOk || dateOk)) return 'partially_reliable'
  return 'ambiguous'
}

/** Builds a sanitized payload snapshot of the row — never anything from an ignored/sensitive sheet. */
function buildOriginalPayload(fields: ParsedRawFields): Record<string, unknown> {
  const entries = Object.entries(fields).filter(([, v]) => v !== null && v !== undefined && v !== '')
  return Object.fromEntries(entries.map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v]))
}

export function buildOccurrence(row: RawRow, layout: SheetLayout, sourcePeriod: string): NormalizedOccurrence {
  const fields = parseRow(row, layout)

  const plate = normalizePlate(fields.plateRaw)
  const date = normalizeDate(fields.saleDateRaw, sourcePeriod)
  const value = normalizeValue(fields.valueRaw)
  const brandModelRaw = normalizeText(fields.brandModelRaw)
  const versionRaw = normalizeText(fields.versionRaw)
  const description = parseVehicleDescription(brandModelRaw, versionRaw)

  const statusResult = determineObservedStatus(layout, fields, date.validation)

  const warnings: string[] = [...description.warnings]
  if (statusResult.warning) warnings.push(statusResult.warning)
  if (plate.format === 'invalid') warnings.push(`plate does not match a known format: ${JSON.stringify(plate.raw)}`)
  if (date.validation !== 'valid' && date.validation !== 'missing') {
    warnings.push(`sale date invalid (${date.validation}): ${JSON.stringify(date.raw)}`)
  }
  if (value.validation !== 'valid' && value.validation !== 'null') {
    warnings.push(`value ${value.validation}: ${JSON.stringify(value.raw)}`)
  }

  const hasBrandOrPlate = brandModelRaw !== null || plate.raw !== null

  const dataQuality = classifyQuality({
    plateFormat: plate.format,
    descriptionConfidence: description.confidence,
    valueValidation: value.validation,
    saleDateValidation: date.validation,
    observedStatus: statusResult.status,
    hasStatusWarning: Boolean(statusResult.warning),
    hasBrandOrPlate,
  })

  return {
    sourceSheet: row.sheetName,
    sourceRow: row.rowNumber,
    sourcePeriod,
    layoutId: layout.id,

    brandModelRaw,
    versionRaw,
    plateRaw: plate.raw,
    valueRaw: value.raw,
    saleDateRaw: date.raw,
    stockFlagRaw: (fields.stockFlagRaw as string | number | null) ?? null,
    buyerRaw: normalizeText(fields.buyerRaw),
    phoneRaw: normalizeText(fields.phoneRaw),
    tradeInRaw: normalizeText(fields.tradeInRaw),
    platformRaw: normalizeText(fields.platformRaw),
    sellerRaw: normalizeText(fields.sellerRaw),
    reportRaw: normalizeText(fields.reportRaw),
    observationsRaw: normalizeText(fields.observationsRaw),
    originalPayload: buildOriginalPayload(fields),

    plateNormalized: plate.normalized,
    plateFormat: plate.format,

    saleDateParsed: date.parsed,
    saleDateValidation: date.validation,
    saleDateSuggestedValue: date.suggestedValue,

    valueParsed: value.parsed,
    valueValidation: value.validation,

    parsedBrand: description.parsedBrand,
    parsedModel: description.parsedModel,
    parsedYear: description.parsedYear,
    descriptionConfidence: description.confidence,

    observedStatus: statusResult.status,
    observedStatusBasis: statusResult.basis,

    warnings,
    dataQuality,
  }
}
