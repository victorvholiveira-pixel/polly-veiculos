/**
 * Trims, collapses repeated whitespace, and turns empty strings into null.
 * Never destroys content.
 *
 * The source occasionally has Excel mis-typing a text cell as a date (a
 * known corruption confirmed by the audit, e.g. a "Modelo" cell holding a
 * literal Date instead of text like "1.6"). Rendered as ISO (YYYY-MM-DD)
 * rather than JS's verbose Date#toString() — still the raw, un-guessed
 * value, just legible.
 */
export function normalizeText(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null
    return raw.toISOString().slice(0, 10)
  }
  const s = String(raw).replace(/\s+/g, ' ').trim()
  return s.length > 0 ? s : null
}
