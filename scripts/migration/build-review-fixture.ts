/**
 * Builds a small, review-center-specific fixture from the full Onda 2
 * dry-run artifacts, written to public/data/review-center-demo.json.
 *
 * Why this exists: normalized_occurrences.json alone is ~1.7 MB — far too
 * large to ship to a mobile app, and not what a real deployment would do
 * anyway (a real deployment queries the backend directly, paginated). This
 * fixture exists ONLY for local/offline preview of the Review Center's UI
 * while no backend is deployed (see src/lib/data/reviewFixture.ts) — it is
 * explicitly demo data, fetched lazily (not bundled into the JS), and every
 * screen that uses it shows a visible "modo de demonstração" banner.
 *
 * Run: npm run migration:build-review-fixture (after migration:dry-run).
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import type { NormalizedOccurrence } from './types'

const ROOT = path.resolve(import.meta.dirname, '..', '..')
const ARTIFACTS_DIR = path.join(ROOT, 'artifacts', 'migration')
const OUT_PATH = path.join(ROOT, 'public', 'data', 'review-center-demo.json')

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

function occKey(o: NormalizedOccurrence) {
  return `${o.sourceSheet}#${o.sourceRow}`
}

function slimOccurrence(o: NormalizedOccurrence) {
  return {
    key: occKey(o),
    sourceSheet: o.sourceSheet,
    sourceRow: o.sourceRow,
    period: o.sourcePeriod,
    brand: o.parsedBrand,
    model: o.parsedModel,
    year: o.parsedYear,
    plate: o.plateNormalized ?? o.plateRaw,
    value: o.valueParsed,
    buyer: o.buyerRaw,
    warnings: o.warnings,
    dataQuality: o.dataQuality,
  }
}

async function main() {
  const [occurrencesRaw, matchCandidatesRaw, currentInventoryRaw, summaryRaw] = await Promise.all([
    readFile(path.join(ARTIFACTS_DIR, 'normalized_occurrences.json'), 'utf8'),
    readFile(path.join(ARTIFACTS_DIR, 'match_candidates.json'), 'utf8'),
    readFile(path.join(ARTIFACTS_DIR, 'current_inventory_candidates.json'), 'utf8'),
    readFile(path.join(ARTIFACTS_DIR, 'migration_summary.json'), 'utf8'),
  ])

  const occurrences = JSON.parse(occurrencesRaw) as NormalizedOccurrence[]
  const matchCandidates = JSON.parse(matchCandidatesRaw) as MatchCandidateArtifact[]
  const currentInventory = JSON.parse(currentInventoryRaw)
  const summary = JSON.parse(summaryRaw)

  const occByKey = new Map(occurrences.map((o) => [occKey(o), o]))

  // P1: conflicts — the brand-contradiction case from resolve.ts's Tier 1 guard.
  const conflicts = matchCandidates
    .filter((m) => m.reasonsAgainst.some((r) => r.includes('conflict')))
    .map((m) => ({
      occurrenceA: occByKey.get(m.occurrenceA) ? slimOccurrence(occByKey.get(m.occurrenceA)!) : null,
      occurrenceBKey: m.occurrenceB,
      score: m.score,
      reasonsFor: m.reasonsFor,
      reasonsAgainst: m.reasonsAgainst,
    }))
    .filter((c) => c.occurrenceA !== null)

  // P2: ambiguous sales.
  const ambiguousSales = occurrences
    .filter((o) => o.observedStatus === 'sold' && o.saleDateValidation !== 'valid')
    .filter((o) => {
      const hasStrongEvidence = Boolean(o.buyerRaw) || o.valueValidation === 'valid' || Boolean(o.plateRaw)
      return !hasStrongEvidence // sale_ambiguous, mirroring sales/detect.ts
    })
    .map(slimOccurrence)

  // P3: remaining tier-3 review candidates (excluding the P1 conflicts already shown).
  const conflictKeys = new Set(matchCandidates.filter((m) => m.reasonsAgainst.some((r) => r.includes('conflict'))).map((m) => m.occurrenceA))
  const otherReviewAll = matchCandidates.filter((m) => !conflictKeys.has(m.occurrenceA) && m.suggestedDecision === 'candidate_review')
  const otherReview = otherReviewAll
    .slice(0, 100) // demo sample — otherReviewAll.length below is the real total
    .map((m) => ({
      occurrence: occByKey.get(m.occurrenceA) ? slimOccurrence(occByKey.get(m.occurrenceA)!) : null,
      score: m.score,
      reasonsFor: m.reasonsFor,
      reasonsAgainst: m.reasonsAgainst,
    }))
    .filter((c) => c.occurrence !== null)

  const fixture = {
    generatedAt: new Date().toISOString(),
    note: 'Demo fixture for offline preview of the Review Center — not production data. See build-review-fixture.ts.',
    summary: {
      reviewQueueTotal: summary.reviewQueue?.totalEntries ?? 0,
      conflicts: conflicts.length,
      ambiguousSalesTotal: ambiguousSales.length,
      otherReviewTotal: otherReviewAll.length,
    },
    sales: {
      periodFrom: summary.workbook?.periodFrom ?? null,
      periodTo: summary.workbook?.periodTo ?? null,
      validDate: summary.sales?.validDate ?? 0,
      invalidDate: summary.sales?.invalidDate ?? 0,
      ambiguous: summary.sales?.ambiguous ?? 0,
    },
    currentInventory,
    conflicts,
    ambiguousSales,
    otherReview,
  }

  await mkdir(path.dirname(OUT_PATH), { recursive: true })
  await writeFile(OUT_PATH, JSON.stringify(fixture, null, 2), 'utf8')

  const sizeKb = (JSON.stringify(fixture).length / 1024).toFixed(0)
  console.log(`==> wrote ${OUT_PATH} (${sizeKb} KB)`)
  console.log(`    inventory=${currentInventory.length} conflicts=${conflicts.length} ambiguousSales=${ambiguousSales.length} otherReview(sampled)=${otherReview.length}`)
}

main().catch((err: unknown) => {
  console.error('build-review-fixture failed:', err)
  process.exitCode = 1
})
