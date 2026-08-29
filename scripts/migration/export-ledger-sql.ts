/**
 * Emits a single, ready-to-run SQL file that loads the Onda 2 dry-run
 * artifact (normalized_occurrences.json) into the real `vehicle_occurrences`
 * table — for use when this environment cannot reach the Supabase project
 * directly (see ARCHITECTURE.md, "Bloqueio de acesso real ao Supabase").
 *
 * Same target, same row shape, same idempotency key as
 * scripts/migration/load-ledger.ts — this only reuses its toDbRow/
 * classifySale mapping and writes SQL instead of calling supabase-js over
 * the network. It does NOT touch vehicles/sales, and it does NOT load
 * match_candidates.json (see load-ledger.ts's doc comment for why: doing so
 * would require fabricating placeholder `vehicles` rows to satisfy the FK —
 * a disguised full identity cutover, which Onda 3 forbids).
 *
 * Run: npm run migration:export-ledger-sql
 * Output: artifacts/migration/load_vehicle_occurrences.sql
 *
 * The generated file wraps all inserts in one transaction and uses
 * `on conflict (source_sheet, source_row) do nothing`, so pasting it into
 * the Supabase SQL Editor is safe to run more than once — already-loaded
 * rows are simply skipped (never updated: vehicle_occurrences.raw/parsed
 * columns are immutable after import by design, enforced by the
 * vehicle_occurrences_protect_raw trigger).
 */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { NormalizedOccurrence } from './types'
import { toDbRow } from './load-ledger'

const ROOT = path.resolve(import.meta.dirname, '..', '..')
const ARTIFACTS_DIR = path.join(ROOT, 'artifacts', 'migration')
const OUTPUT_PATH = path.join(ARTIFACTS_DIR, 'load_vehicle_occurrences.sql')
const BATCH_SIZE = 300

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

type DbRow = ReturnType<typeof toDbRow>

function sqlText(v: string | null | undefined): string {
  if (v === null || v === undefined) return 'null'
  return `'${v.replace(/'/g, "''")}'`
}

function sqlNumber(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return 'null'
  return String(v)
}

function sqlDate(v: string | null | undefined): string {
  return sqlText(v)
}

function sqlJsonb(v: unknown): string {
  return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`
}

function rowToTuple(row: DbRow): string {
  const cells: Record<(typeof COLUMNS)[number], string> = {
    source_sheet: sqlText(row.source_sheet),
    source_row: sqlNumber(row.source_row),
    period: sqlDate(row.period),
    observed_status: sqlText(row.observed_status),
    brand_raw: sqlText(row.brand_raw),
    model_raw: sqlText(row.model_raw),
    plate_raw: sqlText(row.plate_raw),
    value_raw: sqlNumber(row.value_raw),
    sale_date_raw: sqlDate(row.sale_date_raw),
    buyer_name_raw: sqlText(row.buyer_name_raw),
    buyer_phone_raw: sqlText(row.buyer_phone_raw),
    channel_raw: sqlText(row.channel_raw),
    seller_raw: sqlText(row.seller_raw),
    trade_in_raw: sqlText(row.trade_in_raw),
    observations_raw: sqlText(row.observations_raw),
    original_payload: sqlJsonb(row.original_payload),
    data_quality: sqlText(row.data_quality),
    // One independent random id per row, generated server-side — mirrors
    // load-ledger.ts calling crypto.randomUUID() per row via toDbRow().
    migration_run_id: 'gen_random_uuid()',
    plate_normalized: sqlText(row.plate_normalized),
    plate_format: sqlText(row.plate_format),
    sale_date_parsed: sqlDate(row.sale_date_parsed),
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

async function main() {
  const raw = await readFile(path.join(ARTIFACTS_DIR, 'normalized_occurrences.json'), 'utf8')
  const occurrences = JSON.parse(raw) as NormalizedOccurrence[]
  const rows = occurrences.map(toDbRow)

  const insertBlocks: string[] = []
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    insertBlocks.push(
      [
        `insert into public.vehicle_occurrences (${COLUMNS.join(', ')})`,
        'values',
        batch.map(rowToTuple).join(',\n'),
        'on conflict (source_sheet, source_row) do nothing;',
      ].join('\n'),
    )
  }

  const sql = `-- Carga do ledger de migração (vehicle_occurrences) — gerado por
-- scripts/migration/export-ledger-sql.ts a partir de
-- artifacts/migration/normalized_occurrences.json em ${new Date().toISOString()}.
--
-- ${rows.length} ocorrências, ${new Set(occurrences.map((o) => o.sourceSheet)).size} planilhas mensais.
-- A aba sensível "INFORMAÇÃO" já está excluída do artefato de origem (ver
-- MIGRATION.md) — nenhuma linha aqui vem dela.
--
-- Só toca vehicle_occurrences. Não cria/edita vehicles nem sales — nenhum
-- veículo vira estoque oficial e nenhuma venda vira venda confirmada por
-- rodar este script. Isso continua exigindo decisão humana na Central de
-- Revisão do app (Mais → Revisão), como já era antes deste carregamento.
--
-- Idempotente: "on conflict (source_sheet, source_row) do nothing" — pode
-- ser executado mais de uma vez sem duplicar nem falhar; linhas já
-- carregadas são simplesmente ignoradas (o gatilho
-- vehicle_occurrences_protect_raw torna os campos brutos/derivados
-- imutáveis depois do import, então este script nunca tenta atualizá-los).
--
-- Como rodar: cole o arquivo inteiro no SQL Editor do projeto Supabase
-- (${'xzcuhrdhccnforqkovof'}) e execute. Não precisa editar nada.

begin;

${insertBlocks.join('\n\n')}

commit;

-- ================================================================
-- Validação — rode isto depois (também incluído automaticamente se você
-- executar o arquivo inteiro de uma vez no SQL Editor).
-- ================================================================

-- Total de ocorrências carregadas (esperado: ${rows.length})
select count(*) as total_occurrences from public.vehicle_occurrences;

-- Estoque atual — período mais recente da planilha (esperado: 17)
select count(*) as current_stock_count
from public.vehicle_occurrences
where observed_status = 'stock'
  and period = (select max(period) from public.vehicle_occurrences);

-- Vendas por classificação (esperado: sale_detected ~602, sale_detected_with_invalid_date ~23, sale_ambiguous ~263)
select sale_classification, count(*) as total
from public.vehicle_occurrences
where observed_status = 'sold'
group by sale_classification
order by sale_classification;

-- Nenhuma linha deve ter vindo da aba sensível (deve retornar 0 linhas)
select source_sheet, count(*)
from public.vehicle_occurrences
where source_sheet ilike '%informa%'
group by source_sheet;

-- Nenhuma venda foi confirmada e nenhum veículo foi criado por este script
-- (deve retornar 0 em ambas)
select count(*) as sales_created from public.sales;
select count(*) as vehicles_created from public.vehicles;
`

  await writeFile(OUTPUT_PATH, sql, 'utf8')
  console.log(`==> Wrote ${rows.length} rows across ${insertBlocks.length} insert statement(s) to ${OUTPUT_PATH}`)
}

main().catch((err: unknown) => {
  console.error('export-ledger-sql failed:', err)
  process.exitCode = 1
})
