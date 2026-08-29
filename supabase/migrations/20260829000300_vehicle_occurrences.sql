-- Immutable migration-lineage ledger (see ARCHITECTURE.md — FASE 0.5, items B/C/D).
--
-- This table is the provenance record itself — there is deliberately no separate
-- generic `migration_provenance` table. Every row here answers, on its own,
-- "which sheet/row did this come from?" via the (source_sheet, source_row)
-- natural key. Operational tables (vehicles, sales) reference this table by FK
-- instead of duplicating source_sheet/source_row/original_payload.
--
-- Populated ONLY by the migration pipeline (Onda 2), running with elevated
-- (service_role / backend) access — never written to by the frontend, hence no
-- insert/update policy for the `authenticated` role below.
--
-- One row = one occurrence of a vehicle in one monthly sheet. A given real
-- vehicle normally has MANY rows here (one per month it appeared), resolved
-- to the same `vehicle_id` once identity is established (see
-- 20260829000400_vehicle_match_candidates.sql for the review-queue table).

create table public.vehicle_occurrences (
  id uuid primary key default gen_random_uuid(),

  source_sheet text not null,
  source_row int not null,

  period date not null,  -- normalized to the first day of the sheet's month
  observed_status text not null check (observed_status in ('stock', 'sold')),

  brand_raw text,
  model_raw text,
  plate_raw text,
  value_raw numeric(12, 2),
  sale_date_raw date,
  buyer_name_raw text,
  buyer_phone_raw text,
  channel_raw text,
  seller_raw text,
  trade_in_raw text,
  observations_raw text,

  original_payload jsonb not null,

  data_quality text not null check (data_quality in ('reliable', 'partially_reliable', 'ambiguous', 'invalid')),

  vehicle_id uuid references public.vehicles (id),  -- null = pending identity resolution
  match_status text not null default 'pending_review' check (
    match_status in (
      'resolved_exact_plate',
      'resolved_high_confidence',
      'resolved_manual',
      'pending_review',
      'unresolved_no_signal'
    )
  ),
  match_score numeric,

  migration_run_id uuid not null,
  imported_at timestamptz not null default now(),
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,

  unique (source_sheet, source_row)
);

comment on table public.vehicle_occurrences is
  'Ledger imutável de cada linha de planilha migrada. Identidade do registro de origem = (source_sheet, source_row). Nunca escrita pelo frontend.';
comment on column public.vehicle_occurrences.original_payload is
  'Dump bruto verbatim da linha de origem. NUNCA usar para a aba INFORMAÇÃO — essa aba é excluída inteiramente da migração (ver MIGRATION.md).';

create index vehicle_occurrences_vehicle_id_idx on public.vehicle_occurrences (vehicle_id);
create index vehicle_occurrences_period_idx on public.vehicle_occurrences (period);

-- Review queue: partial index keeps it cheap even as the ledger grows.
create index vehicle_occurrences_pending_idx
  on public.vehicle_occurrences (match_status)
  where match_status in ('pending_review', 'unresolved_no_signal');

alter table public.vehicles
  add column founding_occurrence_id uuid references public.vehicle_occurrences (id);

comment on column public.vehicles.founding_occurrence_id is
  'Informativo: qual ocorrência originou este veículo durante a migração. Null para veículos cadastrados manualmente.';

alter table public.vehicle_occurrences enable row level security;

-- Read-only for the app: staff can inspect provenance ("de qual aba/linha veio
-- esse registro?"), but only the migration pipeline (service_role, backend) writes here.
create policy "vehicle_occurrences_select_authenticated"
  on public.vehicle_occurrences for select
  to authenticated
  using (true);
