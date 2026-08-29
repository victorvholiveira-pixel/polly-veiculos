import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { PipelineResult } from '../pipeline'
import type { MigrationSummary } from './summary'

/**
 * Writes the machine-readable dry-run artifacts (Onda 2 §15). These are
 * inputs for a future review UI and for the eventual real load — NOT
 * production seeds themselves; nothing here is written to Supabase.
 */
export async function writeJsonArtifacts(outDir: string, result: PipelineResult, summary: MigrationSummary): Promise<string[]> {
  await mkdir(outDir, { recursive: true })

  const files: Array<[string, unknown]> = [
    ['normalized_occurrences.json', result.occurrences],
    ['canonical_vehicle_candidates.json', result.vehicles],
    ['match_candidates.json', result.matchCandidates],
    ['sales_candidates.json', result.sales],
    ['current_inventory_candidates.json', result.currentInventory.candidates],
    ['review_queue.json', result.reviewQueue],
    ['migration_summary.json', summary],
  ]

  const written: string[] = []
  for (const [name, data] of files) {
    const filePath = path.join(outDir, name)
    await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
    written.push(filePath)
  }
  return written
}
