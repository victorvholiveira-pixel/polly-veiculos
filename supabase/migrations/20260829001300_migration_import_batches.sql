-- Tracks each "Criar estoque inicial" action (Onda 3 §8): a batch/version
-- per import run, so it's always possible to answer "quando e por quem foi
-- criado este veículo migrado, e em que lote?" Idempotency itself is
-- enforced by vehicles.founding_occurrence_id (never two vehicles for the
-- same occurrence) — this table is the audit/traceability layer on top.

create table public.migration_import_batches (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  occurrence_count int not null check (occurrence_count >= 0),
  vehicle_ids uuid[] not null default '{}'
);

comment on table public.migration_import_batches is
  'One row per confirmed inventory-import run (Onda 3 "Criar estoque inicial"). Never auto-created.';

alter table public.migration_import_batches enable row level security;

create policy "migration_import_batches_select_authenticated"
  on public.migration_import_batches for select
  to authenticated
  using (true);

create policy "migration_import_batches_insert_authenticated"
  on public.migration_import_batches for insert
  to authenticated
  with check (true);

-- No update/delete policy: a batch record, once created, is permanent history.
