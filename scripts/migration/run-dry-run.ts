import path from 'node:path'
import { writeFile } from 'node:fs/promises'
import { runPipeline } from './pipeline'
import { writeJsonArtifacts } from './report/json-artifacts'
import { renderMarkdownReport } from './report/markdown'
import { buildSummary } from './report/summary'

const ROOT = path.resolve(import.meta.dirname, '..', '..')
const DEFAULT_SOURCE = path.join(ROOT, 'data', 'source', 'Venda POLY Atual.xlsx')
const OUT_DIR = path.join(ROOT, 'artifacts', 'migration')

async function main() {
  const sourcePath = process.env.MIGRATION_SOURCE_XLSX ?? process.argv[2] ?? DEFAULT_SOURCE

  console.log(`==> Migration dry-run`)
  console.log(`    source: ${sourcePath}`)

  const start = Date.now()
  const result = await runPipeline(sourcePath)
  const summary = buildSummary(result)

  if (result.unclassifiedSheets.length > 0) {
    console.warn(`!!  ${result.unclassifiedSheets.length} sheet(s) have no known layout and were skipped:`)
    for (const s of result.unclassifiedSheets) console.warn(`    - ${s}`)
  }

  const jsonFiles = await writeJsonArtifacts(OUT_DIR, result, summary)
  const reportPath = path.join(OUT_DIR, 'MIGRATION_DRY_RUN_REPORT.md')
  await writeFile(reportPath, renderMarkdownReport(result, summary), 'utf8')

  const elapsedS = ((Date.now() - start) / 1000).toFixed(1)

  console.log('')
  console.log(`==> Done in ${elapsedS}s. No writes to Supabase were made.`)
  console.log(`    Occurrences: ${summary.rows.totalDataRows}`)
  console.log(`    Canonical vehicles (estimated): ${summary.vehicles.canonicalVehiclesEstimated}`)
  console.log(`    Sales detected: ${summary.sales.detected}`)
  console.log(`    Current inventory candidates: ${summary.currentInventory.count}`)
  console.log(`    Review queue: ${summary.reviewQueue.totalEntries}`)
  console.log('')
  console.log(`    Report:    ${reportPath}`)
  for (const f of jsonFiles) console.log(`    Artifact:  ${f}`)
}

main().catch((err: unknown) => {
  console.error('Migration dry-run failed:')
  console.error(err)
  process.exitCode = 1
})
