/**
 * Same target and row mapping as load-ledger.ts / export-ledger-sql.ts, but
 * split into artifacts sized for operating the cutover from a phone:
 *
 *  - artifacts/migration/load_vehicle_occurrences.csv — one file, for
 *    Table Editor → Insert → "Import data from CSV" (a file picker, not a
 *    paste). Try this first.
 *  - artifacts/migration/sql-batches/occurrences_XXX.sql — the same data
 *    split into small (~100-row) independent, idempotent SQL files, for
 *    when CSV import doesn't preserve the two jsonb columns
 *    (original_payload, warnings) correctly. Each file is small enough to
 *    open and copy in full on a phone — never all 1.521 rows at once.
 *
 * Only touches vehicle_occurrences — same scope, same caveats as
 * load-ledger.ts (see its doc comment for why vehicle_match_candidates is
 * never included here).
 *
 * Run: npm run migration:export-ledger-mobile
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { NormalizedOccurrence } from './types'
import { toDbRow } from './load-ledger'

const ROOT = path.resolve(import.meta.dirname, '..', '..')
const ARTIFACTS_DIR = path.join(ROOT, 'artifacts', 'migration')
const BATCH_DIR = path.join(ARTIFACTS_DIR, 'sql-batches')
const CSV_PATH = path.join(ARTIFACTS_DIR, 'load_vehicle_occurrences.csv')
const SQL_BATCH_SIZE = 100

const COLUMNS = [
  'source_sheet',
  'source_row',
  'period',
  'observed_status',
  'brand_raw',
  'model_raw',
  'plate_raw',
  'value_raw',
  'sale_date_raw',
  'buyer_name_raw',
  'buyer_phone_raw',
  'channel_raw',
  'seller_raw',
  'trade_in_raw',
  'observations_raw',
  'original_payload',
  'data_quality',
  'migration_run_id',
  'plate_normalized',
  'plate_format',
  'sale_date_parsed',
  'value_parsed',
  'parsed_brand',
  'parsed_model',
  'parsed_year',
  'observed_status_basis',
  'warnings',
  'sale_classification',
] as const

type DbRow = ReturnType<typeof toDbRow> & { migration_run_id: string }

// --- CSV ---------------------------------------------------------------

/** RFC 4180: quote a field only when needed, doubling any embedded quote. */
function csvCell(v: string | number | null): string {
  if (v === null) return ''
  const s = String(v)
  if (s === '') return ''
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function rowToCsvLine(row: DbRow): string {
  const values: Record<(typeof COLUMNS)[number], string | number | null> = {
    source_sheet: row.source_sheet,
    source_row: row.source_row,
    period: row.period,
    observed_status: row.observed_status,
    brand_raw: row.brand_raw,
    model_raw: row.model_raw,
    plate_raw: row.plate_raw,
    value_raw: row.value_raw,
    sale_date_raw: row.sale_date_raw,
    buyer_name_raw: row.buyer_name_raw,
    buyer_phone_raw: row.buyer_phone_raw,
    channel_raw: row.channel_raw,
    seller_raw: row.seller_raw,
    trade_in_raw: row.trade_in_raw,
    observations_raw: row.observations_raw,
    original_payload: JSON.stringify(row.original_payload),
    data_quality: row.data_quality,
    migration_run_id: row.migration_run_id,
    plate_normalized: row.plate_normalized,
    plate_format: row.plate_format,
    sale_date_parsed: row.sale_date_parsed,
    value_parsed: row.value_parsed,
    parsed_brand: row.parsed_brand,
    parsed_model: row.parsed_model,
    parsed_year: row.parsed_year,
    observed_status_basis: row.observed_status_basis,
    warnings: JSON.stringify(row.warnings),
    sale_classification: row.sale_classification,
  }
  return COLUMNS.map((c) => csvCell(values[c])).join(',')
}

// --- small SQL batches (same escaping as export-ledger-sql.ts) --------

function sqlText(v: string | null | undefined): string {
  if (v === null || v === undefined) return 'null'
  return `'${v.replace(/'/g, "''")}'`
}
function sqlNumber(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return 'null'
  return String(v)
}
function sqlJsonb(v: unknown): string {
  return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`
}

function rowToTuple(row: DbRow): string {
  const cells: Record<(typeof COLUMNS)[number], string> = {
    source_sheet: sqlText(row.source_sheet),
    source_row: sqlNumber(row.source_row),
    period: sqlText(row.period),
    observed_status: sqlText(row.observed_status),
    brand_raw: sqlText(row.brand_raw),
    model_raw: sqlText(row.model_raw),
    plate_raw: sqlText(row.plate_raw),
    value_raw: sqlNumber(row.value_raw),
    sale_date_raw: sqlText(row.sale_date_raw),
    buyer_name_raw: sqlText(row.buyer_name_raw),
    buyer_phone_raw: sqlText(row.buyer_phone_raw),
    channel_raw: sqlText(row.channel_raw),
    seller_raw: sqlText(row.seller_raw),
    trade_in_raw: sqlText(row.trade_in_raw),
    observations_raw: sqlText(row.observations_raw),
    original_payload: sqlJsonb(row.original_payload),
    data_quality: sqlText(row.data_quality),
    migration_run_id: sqlText(row.migration_run_id),
    plate_normalized: sqlText(row.plate_normalized),
    plate_format: sqlText(row.plate_format),
    sale_date_parsed: sqlText(row.sale_date_parsed),
    value_parsed: sqlNumber(row.value_parsed),
    parsed_brand: sqlText(row.parsed_brand),
    parsed_model: sqlText(row.parsed_model),
    parsed_year: sqlNumber(row.parsed_year),
    observed_status_basis: sqlText(row.observed_status_basis),
    warnings: sqlJsonb(row.warnings),
    sale_classification: sqlText(row.sale_classification),
  }
  return `  (${COLUMNS.map((c) => cells[c]).join(', ')})`
}

function batchSql(rows: DbRow[], fileIndex: number, fileCount: number): string {
  return `-- Lote ${fileIndex}/${fileCount} da carga de vehicle_occurrences — ${rows.length} linhas.
-- Gerado por scripts/migration/export-ledger-mobile.ts. Independente: pode
-- rodar este arquivo sozinho, em qualquer ordem, sem depender dos outros
-- lotes. Idempotente: "on conflict ... do nothing" — seguro rodar de novo.
-- Só toca vehicle_occurrences. Não cria vehicles nem sales.

begin;

insert into public.vehicle_occurrences (${COLUMNS.join(', ')})
values
${rows.map(rowToTuple).join(',\n')}
on conflict (source_sheet, source_row) do nothing;

commit;
`
}

async function main() {
  const raw = await readFile(path.join(ARTIFACTS_DIR, 'normalized_occurrences.json'), 'utf8')
  const occurrences = JSON.parse(raw) as NormalizedOccurrence[]
  const migrationRunId = crypto.randomUUID()
  const rows: DbRow[] = occurrences.map((o) => ({ ...toDbRow(o), migration_run_id: migrationRunId }))

  // --- CSV ---
  const csv = [COLUMNS.join(','), ...rows.map(rowToCsvLine)].join('\r\n') + '\r\n'
  await writeFile(CSV_PATH, csv, 'utf8')

  // --- small SQL batches ---
  await rm(BATCH_DIR, { recursive: true, force: true })
  await mkdir(BATCH_DIR, { recursive: true })
  const fileCount = Math.ceil(rows.length / SQL_BATCH_SIZE)
  for (let i = 0; i < fileCount; i++) {
    const batch = rows.slice(i * SQL_BATCH_SIZE, (i + 1) * SQL_BATCH_SIZE)
    const name = `occurrences_${String(i + 1).padStart(3, '0')}_of_${String(fileCount).padStart(3, '0')}.sql`
    await writeFile(path.join(BATCH_DIR, name), batchSql(batch, i + 1, fileCount), 'utf8')
  }

  console.log(`==> CSV: ${rows.length} rows -> ${CSV_PATH}`)
  console.log(`==> SQL batches: ${fileCount} files (~${SQL_BATCH_SIZE} rows each) -> ${BATCH_DIR}/`)
}

main().catch((err: unknown) => {
  console.error('export-ledger-mobile failed:', err)
  process.exitCode = 1
})
