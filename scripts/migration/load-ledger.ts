/**
 * Loads the Onda 2 dry-run artifacts into the real backend (Google Apps
 * Script + Sheets — see gas/Logic.js's bulkLoadOccurrences_/
 * bulkLoadMatchCandidates_): the raw historical ledger (VehicleOccurrences)
 * and the identity-review evidence (VehicleMatchCandidates). This is NOT a
 * cutover: it never touches Vehicles or Sales.
 *
 * Unlike the old Supabase-era version of this script, match_candidates.json
 * IS loaded now — VehicleMatchCandidates stores occurrence *keys*
 * (source_sheet#source_row), not a foreign key to a real Vehicles row, so
 * there is no need to fabricate placeholder vehicles just to hold evidence
 * (see gas/Store.js's comment on that column). This is what makes the
 * Review Center's P1 (conflitos) and P3 (outros) screens read real data
 * instead of a static fixture.
 *
 * Requires APPS_SCRIPT_URL and APPS_SCRIPT_ADMIN_SECRET as plain env vars
 * (never VITE_-prefixed — this never runs in the browser). Run manually:
 *   APPS_SCRIPT_URL=... APPS_SCRIPT_ADMIN_SECRET=... npm run migration:load-ledger
 *
 * Idempotent for occurrences: gas/Logic.js dedupes on the (source_sheet,
 * source_row) natural key, so re-running after a fixed artifact never
 * duplicates a row. Match candidates are NOT deduped (there is no natural
 * key for them — a second run would double them), so only run this once per
 * artifact set; re-running deliberately requires clearing the
 * VehicleMatchCandidates tab by hand first.
 */
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { NormalizedOccurrence } from './types'

const ROOT = path.resolve(import.meta.dirname, '..', '..')
const ARTIFACTS_DIR = path.join(ROOT, 'artifacts', 'migration')
const BATCH_SIZE = 200

interface MatchCandidateArtifact {
  occurrenceA: string
  occurrenceB: string
  tier: number
  score: number
  reasonsFor: string[]
  reasonsAgainst: string[]
  suggestedDecision: string
  autoMatchAllowed: boolean
}

function toOccurrenceRow(o: NormalizedOccurrence, migrationRunId: string) {
  return {
    source_sheet: o.sourceSheet,
    source_row: o.sourceRow,
    period: o.sourcePeriod,
    observed_status: o.observedStatus,
    brand_raw: o.brandModelRaw,
    model_raw: o.versionRaw,
    plate_raw: o.plateRaw,
    value_raw: typeof o.valueRaw === 'number' ? o.valueRaw : null,
    sale_date_raw: null, // text-shaped historically; sale_date_parsed is authoritative
    buyer_name_raw: o.buyerRaw,
    buyer_phone_raw: o.phoneRaw,
    channel_raw: o.platformRaw,
    seller_raw: o.sellerRaw,
    trade_in_raw: o.tradeInRaw,
    observations_raw: o.observationsRaw,
    original_payload: o.originalPayload,
    data_quality: o.dataQuality,
    migration_run_id: migrationRunId,
    imported_at: new Date().toISOString(),

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
    review_decision: 'pending',
  }
}

function classifySale(o: NormalizedOccurrence): string {
  if (o.saleDateValidation === 'valid') return 'sale_detected'
  const strongEvidence = Boolean(o.buyerRaw) || o.valueValidation === 'valid' || Boolean(o.plateRaw)
  return strongEvidence ? 'sale_detected_with_invalid_date' : 'sale_ambiguous'
}

function toMatchCandidateRow(m: MatchCandidateArtifact) {
  return {
    occurrence_a_key: m.occurrenceA,
    occurrence_b_key: m.occurrenceB,
    tier: m.tier,
    score: m.score,
    reasons_for: m.reasonsFor,
    reasons_against: m.reasonsAgainst,
    suggested_decision: m.suggestedDecision,
    auto_match_allowed: m.autoMatchAllowed,
    decision: 'pending',
  }
}

async function callAdmin(apiUrl: string, adminSecret: string, action: string, params: Record<string, unknown>) {
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, adminSecret, ...params }),
  })
  const json = (await res.json()) as { data?: unknown; error?: string }
  if (json.error) throw new Error(`${action} failed: ${json.error}`)
  return json.data
}

async function main() {
  const apiUrl = process.env.APPS_SCRIPT_URL
  const adminSecret = process.env.APPS_SCRIPT_ADMIN_SECRET
  if (!apiUrl || !adminSecret) {
    console.error('Missing APPS_SCRIPT_URL / APPS_SCRIPT_ADMIN_SECRET — refusing to run without real credentials.')
    console.error('This script is not runnable until the Apps Script Web App is deployed (see ARCHITECTURE.md).')
    process.exitCode = 1
    return
  }

  const migrationRunId = randomUUID()
  const [occurrencesRaw, matchCandidatesRaw] = await Promise.all([
    readFile(path.join(ARTIFACTS_DIR, 'normalized_occurrences.json'), 'utf8'),
    readFile(path.join(ARTIFACTS_DIR, 'match_candidates.json'), 'utf8'),
  ])
  const occurrences = (JSON.parse(occurrencesRaw) as NormalizedOccurrence[]).map((o) => toOccurrenceRow(o, migrationRunId))
  const matchCandidates = (JSON.parse(matchCandidatesRaw) as MatchCandidateArtifact[]).map(toMatchCandidateRow)

  console.log(`==> Loading ${occurrences.length} occurrences (run ${migrationRunId})`)
  for (let i = 0; i < occurrences.length; i += BATCH_SIZE) {
    const batch = occurrences.slice(i, i + BATCH_SIZE)
    const result = (await callAdmin(apiUrl, adminSecret, 'bulkLoadOccurrences', { rows: batch })) as { inserted: number; skipped: number }
    console.log(`   ${Math.min(i + BATCH_SIZE, occurrences.length)}/${occurrences.length} (inserted ${result.inserted}, skipped ${result.skipped})`)
  }

  console.log(`==> Loading ${matchCandidates.length} match candidates`)
  for (let i = 0; i < matchCandidates.length; i += BATCH_SIZE) {
    const batch = matchCandidates.slice(i, i + BATCH_SIZE)
    await callAdmin(apiUrl, adminSecret, 'bulkLoadMatchCandidates', { rows: batch })
    console.log(`   ${Math.min(i + BATCH_SIZE, matchCandidates.length)}/${matchCandidates.length}`)
  }

  console.log('==> Done. Vehicles/Sales were not touched.')
}

main().catch((err: unknown) => {
  console.error('load-ledger failed:', err)
  process.exitCode = 1
})
