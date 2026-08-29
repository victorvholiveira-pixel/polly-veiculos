import { normalizeText } from './text'

export interface VehicleDescriptionResult {
  parsedBrand: string | null
  parsedModel: string | null
  parsedYear: number | null
  confidence: 'high' | 'medium' | 'low'
  warnings: string[]
}

/**
 * Known-brand dictionary — matched when the cell actually contains a brand
 * word (e.g. "Ford Fiesta 2008", "Honda Fit"). Built from brands observed in
 * the audit sample, not an exhaustive world catalog.
 */
const KNOWN_BRANDS: readonly string[] = [
  'fiat',
  'volkswagen',
  'vw',
  'chevrolet',
  'gm',
  'ford',
  'renault',
  'honda',
  'toyota',
  'hyundai',
  'hyndai', // common misspelling seen in the source
  'nissan',
  'jeep',
  'mitsubishi',
  'mmc',
  'citroen',
  'citroën',
  'peugeot',
  'kia',
  'chery',
  'caoa',
]

const BRAND_CANONICAL: Record<string, string> = {
  vw: 'Volkswagen',
  gm: 'Chevrolet',
  hyndai: 'Hyundai',
  mmc: 'Mitsubishi',
  citroen: 'Citroën',
}

/**
 * The audit confirmed the source's "Marca" cell is, in the large majority of
 * rows, actually the MODEL name (e.g. "Palio", "Fox", "Ecosport", "Agile") —
 * not the manufacturer brand. A brand-only dictionary therefore misses most
 * rows. This model → brand map is checked FIRST; the brand dictionary above
 * is the fallback for the minority of cells that do spell out the brand.
 * Built from models actually observed in the audit sample — not exhaustive.
 */
const MODEL_TO_BRAND: Record<string, string> = {
  // Fiat
  palio: 'Fiat',
  uno: 'Fiat',
  siena: 'Fiat',
  idea: 'Fiat',
  punto: 'Fiat',
  linea: 'Fiat',
  toro: 'Fiat',
  strada: 'Fiat',
  doblo: 'Fiat',
  argo: 'Fiat',
  cronos: 'Fiat',
  mobi: 'Fiat',
  // Volkswagen
  fox: 'Volkswagen',
  spacefox: 'Volkswagen',
  crossfox: 'Volkswagen',
  gol: 'Volkswagen',
  voyage: 'Volkswagen',
  polo: 'Volkswagen',
  saveiro: 'Volkswagen',
  jetta: 'Volkswagen',
  virtus: 'Volkswagen',
  // Ford
  ecosport: 'Ford',
  ka: 'Ford',
  fiesta: 'Ford',
  focus: 'Ford',
  ranger: 'Ford',
  // Chevrolet
  onix: 'Chevrolet',
  prisma: 'Chevrolet',
  corsa: 'Chevrolet',
  classic: 'Chevrolet',
  agile: 'Chevrolet',
  celta: 'Chevrolet',
  tracker: 'Chevrolet',
  cruze: 'Chevrolet',
  spin: 'Chevrolet',
  montana: 'Chevrolet',
  s10: 'Chevrolet',
  // Renault
  kwid: 'Renault',
  sandero: 'Renault',
  duster: 'Renault',
  logan: 'Renault',
  captur: 'Renault',
  stepway: 'Renault',
  // Hyundai
  hb20: 'Hyundai',
  tucson: 'Hyundai',
  creta: 'Hyundai',
  i30: 'Hyundai',
  // Honda
  civic: 'Honda',
  fit: 'Honda',
  city: 'Honda',
  'hr-v': 'Honda',
  'cr-v': 'Honda',
  // Toyota
  corolla: 'Toyota',
  etios: 'Toyota',
  hilux: 'Toyota',
  yaris: 'Toyota',
  rav4: 'Toyota',
  rav: 'Toyota',
  // Nissan
  versa: 'Nissan',
  march: 'Nissan',
  kicks: 'Nissan',
  sentra: 'Nissan',
  // Jeep
  renegade: 'Jeep',
  compass: 'Jeep',
  cherokee: 'Jeep',
  wrangler: 'Jeep',
  // Mitsubishi
  asx: 'Mitsubishi',
  l200: 'Mitsubishi',
  pajero: 'Mitsubishi',
  // Peugeot / Citroën
  '208': 'Peugeot',
  '2008': 'Peugeot',
  '3008': 'Peugeot',
  partner: 'Peugeot',
  c3: 'Citroën',
  c4: 'Citroën',
  aircross: 'Citroën',
  // Kia
  picanto: 'Kia',
  sportage: 'Kia',
  cerato: 'Kia',
  soul: 'Kia',
}

const YEAR_TOKEN = /(19[89]\d|20[0-3]\d)/

function canonicalBrand(match: string): string {
  const lower = match.toLowerCase()
  return BRAND_CANONICAL[lower] ?? match[0]!.toUpperCase() + match.slice(1).toLowerCase()
}

function findWordMatch(haystack: string, needle: string): number {
  const idx = haystack.indexOf(needle)
  if (idx === -1) return -1
  const before = haystack[idx - 1]
  const after = haystack[idx + needle.length]
  const boundaryBefore = idx === 0 || !/[a-z0-9]/.test(before ?? '')
  const boundaryAfter = !after || !/[a-z0-9]/.test(after)
  return boundaryBefore && boundaryAfter ? idx : -1
}

/**
 * Parses the free-text "brand/model/year" description found in the source's
 * Marca column, plus the Modelo column (usually trim/version rather than a
 * clean model name). Conservative on purpose: low confidence and a null
 * field beat a wrong guess.
 */
export function parseVehicleDescription(
  brandModelRaw: string | null,
  versionRaw: string | null,
): VehicleDescriptionResult {
  const warnings: string[] = []
  const description = normalizeText(brandModelRaw)

  if (!description) {
    return { parsedBrand: null, parsedModel: null, parsedYear: null, confidence: 'low', warnings: ['empty description'] }
  }

  const yearMatch = YEAR_TOKEN.exec(description) ?? (versionRaw ? YEAR_TOKEN.exec(versionRaw) : null)
  const parsedYear = yearMatch ? Number(yearMatch[0]) : null

  const lowerDescription = description.toLowerCase()

  // Try the model dictionary first — it covers the majority shape of this
  // workbook ("Marca" cell actually holds the model name).
  let modelToken: string | undefined
  let modelIdx = -1
  for (const candidate of Object.keys(MODEL_TO_BRAND)) {
    const idx = findWordMatch(lowerDescription, candidate)
    if (idx !== -1 && (modelToken === undefined || candidate.length > modelToken.length)) {
      modelToken = candidate
      modelIdx = idx
    }
  }

  if (modelToken) {
    const brand = MODEL_TO_BRAND[modelToken]!
    const originalCasing = description.slice(modelIdx, modelIdx + modelToken.length)
    const parsedModel = originalCasing.length > 0 ? originalCasing[0]!.toUpperCase() + originalCasing.slice(1).toLowerCase() : modelToken
    const confidence: VehicleDescriptionResult['confidence'] = parsedYear ? 'high' : 'medium'
    return { parsedBrand: brand, parsedModel, parsedYear, confidence, warnings }
  }

  // Fall back to an explicit brand word in the cell (e.g. "Ford Fiesta 2008").
  const brandHit = KNOWN_BRANDS.find((b) => findWordMatch(lowerDescription, b) !== -1)
  if (!brandHit) {
    warnings.push('neither a known model nor a known brand recognized in the description')
    return {
      parsedBrand: null,
      parsedModel: null,
      parsedYear,
      confidence: parsedYear ? 'medium' : 'low',
      warnings,
    }
  }

  let remainder = description
  const brandIdx = lowerDescription.indexOf(brandHit)
  remainder = remainder.slice(0, brandIdx) + remainder.slice(brandIdx + brandHit.length)
  if (yearMatch) remainder = remainder.replace(yearMatch[0], '')
  remainder = remainder.replace(/[/,-]/g, ' ').replace(/\s+/g, ' ').trim()

  const parsedModel = remainder.length > 0 ? remainder : normalizeText(versionRaw)
  if (!parsedModel) warnings.push('model text empty after removing brand/year — fell back to null')

  const confidence: VehicleDescriptionResult['confidence'] = parsedYear && parsedModel ? 'high' : parsedModel ? 'medium' : 'low'
  return { parsedBrand: canonicalBrand(brandHit), parsedModel, parsedYear, confidence, warnings }
}
