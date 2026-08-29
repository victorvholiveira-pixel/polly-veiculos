/**
 * Loads the Onda 2 dry-run artifact (normalized_occurrences.json) into the
 * real `vehicle_occurrences` table — the raw historical ledger, nothing
 * more. This is NOT a cutover: it never touches `vehicles` or `sales`, and
 * it deliberately does NOT load canonical_vehicle_candidates.json or
 * match_candidates.json.
 *
 * Why match_candidates.json is skipped here: `vehicle_match_candidates.
 * candidate_vehicle_id` is a foreign key to a REAL `vehicles` row, but most
 * of the 1.023 canonical vehicle candidates from Onda 2 are estimates, not
 * real vehicles — materializing them just to satisfy the FK would be an
 * disguised full identity cutover, which Onda 3 explicitly forbids. Until a
 * later wave does the real historical cutover, P1 (conflicts) and P3
 * (remaining identity review) in the Review Center read match_candidates.json
 * directly instead of a DB table — see src/lib/data/reviewFixtures.ts.
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY as plain env vars
 * (never VITE_-prefixed — this never runs in the browser). Run manually:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run migration:load-ledger
 *
 * Idempotent: upserts on the (source_sheet, source_row) natural key, so
 * re-running after a fixed artifact (or a second dry-run) never duplicates
 * a row.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import type { NormalizedOccurrence } from './types'

const ROOT = path.resolve(import.meta.dirname, '..', '..')
const ARTIFACTS_DIR = path.join(ROOT, 'artifacts', 'migration')
const BATCH_SIZE = 200

function toDbRow(o: NormalizedOccurrence) {
  return {
    source_sheet: o.sourceSheet,
    source_row: o.sourceRow,
    period: o.sourcePeriod,
    observed_status: o.observedStatus,
    brand_raw: o.brandModelRaw,
    model_raw: o.versionRaw,
    plate_raw: o.plateRaw,
    value_raw: typeof o.valueRaw === 'number' ? o.valueRaw : null,
    sale_date_raw: null, // sale_date_raw is text-shaped historically; the parsed date is authoritative — see sale_date_parsed
    buyer_name_raw: o.buyerRaw,
    buyer_phone_raw: o.phoneRaw,
    channel_raw: o.platformRaw,
    seller_raw: o.sellerRaw,
    trade_in_raw: o.tradeInRaw,
    observations_raw: o.observationsRaw,
    original_payload: o.originalPayload,
    data_quality: o.dataQuality,
    migration_run_id: crypto.randomUUID(),

    plate_normalized: o.plateNormalized,
    plate_format: o.plateFormat,
    sale_date_parsed: o.saleDateParsed,
    value_parsed: o.valueParsed,
    parsed_brand: o.parsedBrand,
    parsed_model: o.parsedModel,
    parsed_year: o.parsedYear,
    observed_status_basis: o.observedStatusBasis,
    warnings: o.warnings,
    sale_classification: o.observedStatus === 'sold' ? classifySale(o) : null,
  }
}

function classifySale(o: NormalizedOccurrence): string {
  if (o.saleDateValidation === 'valid') return 'sale_detected'
  const strongEvidence = Boolean(o.buyerRaw) || o.valueValidation === 'valid' || Boolean(o.plateRaw)
  return strongEvidence ? 'sale_detected_with_invalid_date' : 'sale_ambiguous'
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — refusing to run without real credentials.')
    console.error('This script is not runnable in the current environment (no Supabase project linked yet).')
    process.exitCode = 1
    return
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

  const raw = await readFile(path.join(ARTIFACTS_DIR, 'normalized_occurrences.json'), 'utf8')
  const occurrences = JSON.parse(raw) as NormalizedOccurrence[]
  console.log(`==> Loading ${occurrences.length} occurrences into vehicle_occurrences (upsert on source_sheet+source_row)`)

  for (let i = 0; i < occurrences.length; i += BATCH_SIZE) {
    const batch = occurrences.slice(i, i + BATCH_SIZE).map(toDbRow)
    const { error } = await supabase.from('vehicle_occurrences').upsert(batch, { onConflict: 'source_sheet,source_row' })
    if (error) throw new Error(`Batch starting at ${i} failed: ${error.message}`)
    console.log(`   ${Math.min(i + BATCH_SIZE, occurrences.length)}/${occurrences.length}`)
  }

  console.log('==> Done. vehicles/sales were not touched.')
}

main().catch((err: unknown) => {
  console.error('load-ledger failed:', err)
  process.exitCode = 1
})
