import type { CanonicalVehicleCandidate, MatchCandidate, NormalizedOccurrence, OccurrenceResolution } from '../types'
import { occurrenceKey } from '../types'
import { isConsecutiveOrSamePeriod, scoreAttributeMatch, type OpenVehicleState } from './scoring'

const TIER2_AUTO_MERGE_THRESHOLD = 0.85
const TIER2_UNIQUENESS_MARGIN = 0.15
const TIER3_MIN_PLAUSIBLE_SCORE = 0.5

export interface ResolutionResult {
  vehicles: CanonicalVehicleCandidate[]
  matchCandidates: MatchCandidate[]
  resolutions: OccurrenceResolution[]
}

function sortChronologically(occurrences: readonly NormalizedOccurrence[]): NormalizedOccurrence[] {
  return [...occurrences].sort((a, b) => a.sourcePeriod.localeCompare(b.sourcePeriod))
}

/**
 * Resolves canonical vehicle identity across all occurrences, in
 * chronological order, following the conservative tiered strategy approved
 * in FASE 0.5 / requested in Onda 2 §8:
 *
 *   Tier 1 — exact normalized plate + month continuity with an open vehicle
 *            → auto-merge.
 *   Tier 2 — no usable plate, but a uniquely strong attribute match (brand +
 *            model + year + value + continuity) with an open vehicle
 *            → auto-merge only above a strict, unique-best threshold.
 *   Tier 3 — anything else with a plausible-but-not-confident signal
 *            → NEVER auto-merged. A new vehicle is created for the
 *            occurrence and the plausible prior vehicle is recorded as a
 *            reviewable match candidate instead.
 *
 * On doubt, this always creates a new vehicle rather than merging — a false
 * negative (a few extra vehicle records) is preferred over a false positive
 * (two different cars fused into one history).
 */
export function resolveIdentity(occurrences: readonly NormalizedOccurrence[]): ResolutionResult {
  const ordered = sortChronologically(occurrences)

  const openVehicles = new Map<string, OpenVehicleState>()
  const vehicles = new Map<string, CanonicalVehicleCandidate>()
  const matchCandidates: MatchCandidate[] = []
  const resolutions: OccurrenceResolution[] = []
  let nextId = 1

  function newVehicleId(): string {
    const id = `veh_${String(nextId).padStart(5, '0')}`
    nextId += 1
    return id
  }

  function createVehicle(o: NormalizedOccurrence, method: CanonicalVehicleCandidate['resolutionMethod']): CanonicalVehicleCandidate {
    const id = newVehicleId()
    const vehicle: CanonicalVehicleCandidate = {
      id,
      brand: o.parsedBrand,
      model: o.parsedModel,
      version: o.versionRaw,
      year: o.parsedYear,
      plate: o.plateNormalized,
      occurrenceKeys: [occurrenceKey(o)],
      firstSeenAt: o.sourcePeriod,
      lastSeenAt: o.sourcePeriod,
      finalStatus: o.observedStatus === 'sold' ? 'sold_candidate' : 'stock_candidate',
      confidence: o.dataQuality === 'reliable' ? 'high' : o.dataQuality === 'invalid' ? 'low' : 'medium',
      resolutionMethod: method,
    }
    vehicles.set(id, vehicle)
    if (o.observedStatus === 'stock') {
      openVehicles.set(id, {
        id: vehicle.id,
        brand: vehicle.brand,
        model: vehicle.model,
        year: vehicle.year,
        lastValue: o.valueParsed,
        plate: vehicle.plate,
        lastSeenPeriod: vehicle.lastSeenAt,
      })
    }
    return vehicle
  }

  function mergeInto(vehicleId: string, o: NormalizedOccurrence) {
    const vehicle = vehicles.get(vehicleId)!
    vehicle.occurrenceKeys.push(occurrenceKey(o))
    vehicle.lastSeenAt = o.sourcePeriod
    if (o.plateNormalized) vehicle.plate = o.plateNormalized
    if (o.parsedBrand && !vehicle.brand) vehicle.brand = o.parsedBrand
    if (o.parsedModel && !vehicle.model) vehicle.model = o.parsedModel
    if (o.parsedYear && !vehicle.year) vehicle.year = o.parsedYear

    if (o.observedStatus === 'sold') {
      vehicle.finalStatus = 'sold_candidate'
      openVehicles.delete(vehicleId)
    } else {
      const state = openVehicles.get(vehicleId)
      openVehicles.set(vehicleId, {
        id: vehicleId,
        brand: vehicle.brand,
        model: vehicle.model,
        year: vehicle.year,
        lastValue: o.valueParsed ?? state?.lastValue ?? null,
        plate: vehicle.plate,
        lastSeenPeriod: o.sourcePeriod,
      })
    }
  }

  for (const o of ordered) {
    const key = occurrenceKey(o)

    // --- Tier 1: exact plate + continuity ---
    if (o.plateNormalized) {
      const plateMatches = [...openVehicles.values()].filter(
        (v) => v.plate === o.plateNormalized && isConsecutiveOrSamePeriod(v.lastSeenPeriod, o.sourcePeriod),
      )
      if (plateMatches.length === 1) {
        const match = plateMatches[0]!
        const brandContradicts = Boolean(o.parsedBrand) && Boolean(match.brand) && o.parsedBrand!.toLowerCase() !== match.brand!.toLowerCase()

        if (!brandContradicts) {
          mergeInto(match.id, o)
          resolutions.push({ occurrenceKey: key, vehicleId: match.id, matchStatus: 'resolved_exact_plate', matchScore: 1 })
          continue
        }

        // Same plate, but the parsed brand flatly contradicts the open
        // vehicle's — never trust the plate alone over a real conflict; a
        // plate can be mistyped, reused, or misread far more easily than a
        // recognized brand can coincidentally be wrong on both sides.
        const vehicle = createVehicle(o, 'tier3_unresolved_singleton')
        const matchLastOccurrence = vehicles.get(match.id)!.occurrenceKeys.at(-1)!
        matchCandidates.push({
          occurrenceA: key,
          occurrenceB: matchLastOccurrence,
          tier: 3,
          score: 0.4,
          reasonsFor: [`same normalized plate: ${o.plateNormalized}`],
          reasonsAgainst: [`plate matches but parsed brand conflicts: "${o.parsedBrand}" vs "${match.brand}" — treated as a data conflict, not auto-merged`],
          suggestedDecision: 'candidate_review',
          autoMatchAllowed: false,
        })
        resolutions.push({ occurrenceKey: key, vehicleId: vehicle.id, matchStatus: 'pending_review', matchScore: 0.4 })
        continue
      }
      if (plateMatches.length > 1) {
        // Should not normally happen (plates are unique among open vehicles by
        // construction), but if the source data produces it, never guess —
        // treat every same-plate open vehicle as a review candidate and
        // start a new vehicle for this occurrence.
        const vehicle = createVehicle(o, 'tier3_unresolved_singleton')
        for (const match of plateMatches) {
          matchCandidates.push({
            occurrenceA: key,
            occurrenceB: vehicle.occurrenceKeys[0]!,
            tier: 3,
            score: 0.5,
            reasonsFor: [`both associated with normalized plate ${o.plateNormalized}`],
            reasonsAgainst: ['more than one open vehicle currently claims this exact plate — conflict, not auto-resolved'],
            suggestedDecision: 'candidate_review',
            autoMatchAllowed: false,
          })
          void match
        }
        resolutions.push({ occurrenceKey: key, vehicleId: vehicle.id, matchStatus: 'pending_review', matchScore: 0.5 })
        continue
      }
      // No open vehicle currently holds this plate — a genuinely new vehicle.
      const vehicle = createVehicle(o, 'tier1_plate_continuity')
      resolutions.push({ occurrenceKey: key, vehicleId: vehicle.id, matchStatus: 'resolved_exact_plate', matchScore: 1 })
      continue
    }

    // --- Tier 2/3: attribute-based ---
    const candidates = [...openVehicles.values()]
      .filter((v) => isConsecutiveOrSamePeriod(v.lastSeenPeriod, o.sourcePeriod))
      .map((v) => ({ vehicle: v, ...scoreAttributeMatch(o, v) }))
      .sort((a, b) => b.score - a.score)

    const best = candidates[0]
    const secondBest = candidates[1]

    if (best && best.score >= TIER2_AUTO_MERGE_THRESHOLD && (!secondBest || best.score - secondBest.score >= TIER2_UNIQUENESS_MARGIN)) {
      mergeInto(best.vehicle.id, o)
      matchCandidates.push({
        occurrenceA: key,
        occurrenceB: `${best.vehicle.id}:last_occurrence`,
        tier: 2,
        score: best.score,
        reasonsFor: best.reasonsFor,
        reasonsAgainst: best.reasonsAgainst,
        suggestedDecision: 'auto_match',
        autoMatchAllowed: true,
      })
      resolutions.push({ occurrenceKey: key, vehicleId: best.vehicle.id, matchStatus: 'resolved_high_confidence', matchScore: best.score })
      continue
    }

    // No confident auto-merge — always create a new vehicle for this occurrence.
    const vehicle = createVehicle(o, 'tier3_unresolved_singleton')

    const plausible = candidates.filter((c) => c.score >= TIER3_MIN_PLAUSIBLE_SCORE).slice(0, 3)
    for (const c of plausible) {
      matchCandidates.push({
        occurrenceA: key,
        occurrenceB: `${c.vehicle.id}:last_occurrence`,
        tier: 3,
        score: c.score,
        reasonsFor: c.reasonsFor,
        reasonsAgainst: c.reasonsAgainst,
        suggestedDecision: 'candidate_review',
        autoMatchAllowed: false,
      })
    }

    resolutions.push({
      occurrenceKey: key,
      vehicleId: vehicle.id,
      matchStatus: plausible.length > 0 ? 'pending_review' : 'unresolved_no_signal',
      matchScore: best?.score ?? null,
    })
  }

  return { vehicles: [...vehicles.values()], matchCandidates, resolutions }
}
