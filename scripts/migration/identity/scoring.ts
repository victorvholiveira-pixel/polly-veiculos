import type { NormalizedOccurrence } from '../types'

export interface OpenVehicleState {
  id: string
  brand: string | null
  model: string | null
  year: number | null
  lastValue: number | null
  plate: string | null
  lastSeenPeriod: string
}

export interface AttributeMatch {
  score: number
  reasonsFor: string[]
  reasonsAgainst: string[]
}

function monthsBetween(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number) as [number, number]
  const [by, bm] = b.split('-').map(Number) as [number, number]
  return (by - ay) * 12 + (bm - am)
}

/** Consecutive-month continuity is a prerequisite, not just a scoring bonus — see identity/resolve.ts. */
export function isConsecutiveOrSamePeriod(candidateLastSeen: string, occurrencePeriod: string): boolean {
  const gap = monthsBetween(candidateLastSeen, occurrencePeriod)
  return gap >= 0 && gap <= 1
}

function normalizedEquals(a: string | null, b: string | null): boolean {
  if (!a || !b) return false
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

function modelSimilar(a: string | null, b: string | null): boolean {
  if (!a || !b) return false
  const na = a.trim().toLowerCase()
  const nb = b.trim().toLowerCase()
  if (na === nb) return true
  return na.includes(nb) || nb.includes(na)
}

/**
 * Attribute-based (Tier 2) score between an occurrence and a candidate open
 * vehicle. Every contributing signal is named explicitly — this feeds
 * directly into the `reasonsFor`/`reasonsAgainst` the review queue shows a
 * human, per Onda 2 §9 ("não quero apenas um score opaco").
 */
export function scoreAttributeMatch(occurrence: NormalizedOccurrence, candidate: OpenVehicleState): AttributeMatch {
  const reasonsFor: string[] = []
  const reasonsAgainst: string[] = []
  let score = 0

  if (normalizedEquals(occurrence.parsedBrand, candidate.brand)) {
    score += 0.35
    reasonsFor.push(`same parsed brand: ${candidate.brand}`)
  } else if (occurrence.parsedBrand && candidate.brand) {
    reasonsAgainst.push(`brand differs: "${occurrence.parsedBrand}" vs "${candidate.brand}"`)
  } else {
    reasonsAgainst.push('brand unknown on at least one side')
  }

  if (modelSimilar(occurrence.parsedModel, candidate.model)) {
    score += 0.25
    reasonsFor.push(`similar parsed model: "${occurrence.parsedModel}" ~ "${candidate.model}"`)
  } else if (occurrence.parsedModel && candidate.model) {
    reasonsAgainst.push(`model text differs: "${occurrence.parsedModel}" vs "${candidate.model}"`)
  } else {
    reasonsAgainst.push('model unknown on at least one side')
  }

  if (occurrence.parsedYear !== null && occurrence.parsedYear === candidate.year) {
    score += 0.2
    reasonsFor.push(`same year: ${candidate.year}`)
  } else if (occurrence.parsedYear !== null && candidate.year !== null) {
    reasonsAgainst.push(`year differs: ${occurrence.parsedYear} vs ${candidate.year}`)
  }

  if (occurrence.valueParsed !== null && candidate.lastValue !== null) {
    const pctChange = Math.abs(occurrence.valueParsed - candidate.lastValue) / candidate.lastValue
    if (pctChange <= 0.05) {
      score += 0.15
      reasonsFor.push(`value essentially unchanged (${(pctChange * 100).toFixed(1)}% difference)`)
    } else if (pctChange <= 0.15) {
      score += 0.05
      reasonsFor.push(`value changed by ${(pctChange * 100).toFixed(1)}%`)
      reasonsAgainst.push(`value moved ${(pctChange * 100).toFixed(1)}% — larger than a typical single-month markdown`)
    } else {
      reasonsAgainst.push(`value changed by ${(pctChange * 100).toFixed(1)}% — too large to be confident`)
    }
  }

  const gap = monthsBetween(candidate.lastSeenPeriod, occurrence.sourcePeriod)
  if (gap === 0 || gap === 1) {
    reasonsFor.push(gap === 0 ? 'appears in the same month sheet' : 'appears in the consecutive month')
  } else {
    reasonsAgainst.push(`${gap} months since the candidate was last seen — continuity broken`)
  }

  return { score: Math.min(score, 1), reasonsFor, reasonsAgainst }
}
