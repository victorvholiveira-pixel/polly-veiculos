import type { MatchCandidate, OccurrenceResolution, ReviewQueueEntry } from './types'

/**
 * Groups everything that needs a human decision by reason, for the report's
 * "Review queue" section and for a future review UI (not built this wave)
 * to query directly.
 */
export function buildReviewQueue(resolutions: readonly OccurrenceResolution[], matchCandidates: readonly MatchCandidate[]): ReviewQueueEntry[] {
  const pendingReview = resolutions.filter((r) => r.matchStatus === 'pending_review')
  const unresolved = resolutions.filter((r) => r.matchStatus === 'unresolved_no_signal')
  const plateConflicts = matchCandidates.filter((m) => m.reasonsAgainst.some((r) => r.includes('conflict')))

  const entries: ReviewQueueEntry[] = []

  if (pendingReview.length > 0) {
    entries.push({
      reason: 'plausible_but_unconfident_vehicle_match',
      occurrenceKeys: pendingReview.map((r) => r.occurrenceKey),
      detail: 'Occurrence has one or more plausible prior-vehicle candidates (see canonical_vehicle_candidates match_candidates), but none confident enough to auto-merge. A new vehicle was created; a human should confirm whether it is actually the same car.',
    })
  }

  if (unresolved.length > 0) {
    entries.push({
      reason: 'no_identity_signal',
      occurrenceKeys: unresolved.map((r) => r.occurrenceKey),
      detail: 'No plate and no attribute signal strong enough to even suggest a candidate. Treated as a standalone new vehicle; likely needs manual classification (brand/model unreadable, or a genuinely isolated record).',
    })
  }

  if (plateConflicts.length > 0) {
    entries.push({
      reason: 'plate_claimed_by_multiple_open_vehicles',
      occurrenceKeys: [...new Set(plateConflicts.map((m) => m.occurrenceA))],
      detail: 'More than one currently-open vehicle candidate shares the same normalized plate. Never auto-resolved — needs a human to say which (if any) is the real continuation.',
    })
  }

  return entries
}
