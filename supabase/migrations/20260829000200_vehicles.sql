-- Canonical vehicle identity (see ARCHITECTURE.md — FASE 0.5, item B).
-- vehicles.id is the ONLY identity that sales/audit_log reference. Plate is an
-- attribute, never an identity — it can be corrected without changing vehicles.id.
--
-- `founding_occurrence_id` is added later (20260829000400) once vehicle_occurrences
-- exists, to break the circular FK between the two tables.

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),

  brand text not null,
  model text not null,
  trim text,
  model_year smallint check (model_year between 1950 and 2100),
  manufacture_year smallint check (manufacture_year between 1950 and 2100),

  plate text,
  plate_format text check (plate_format in ('old', 'mercosul', 'unknown')),

  asking_price numeric(12, 2) check (asking_price >= 0),
  entry_date date,
  origin text not null default 'manual' check (origin in ('manual', 'migration')),
  status text not null default 'available' check (status in ('available', 'reserved', 'sold')),
  observations text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.vehicles is
  'Identidade canônica do veículo real. Criada por cadastro manual ou por resolução de identidade na migração (origin=migration) — nunca implicitamente por uma venda.';
comment on column public.vehicles.plate is
  'Atributo, não identidade. Pode ser corrigido sem afetar vehicles.id.';

-- Only one *active* vehicle may hold a given plate at a time. Sold vehicles keep
-- their historical plate without blocking a later active vehicle that reuses it.
create unique index vehicles_active_plate_uk
  on public.vehicles (plate)
  where plate is not null and status in ('available', 'reserved');

create index vehicles_status_idx on public.vehicles (status);

-- Instant search across brand/model/plate (mobile UX requirement — busca instantânea).
create index vehicles_search_trgm_idx
  on public.vehicles using gin (
    (coalesce(brand, '') || ' ' || coalesce(model, '') || ' ' || coalesce(plate, '')) gin_trgm_ops
  );

create trigger vehicles_set_updated_at
  before update on public.vehicles
  for each row execute function public.set_updated_at();

alter table public.vehicles enable row level security;

-- Trusted-staff model: any authenticated user is store staff (see ARCHITECTURE.md,
-- decision I.6 in FASE 0.5 — the item most likely to need revisiting if the
-- business grows to multiple sellers needing restricted visibility).
create policy "vehicles_select_authenticated"
  on public.vehicles for select
  to authenticated
  using (true);

create policy "vehicles_insert_authenticated"
  on public.vehicles for insert
  to authenticated
  with check (true);

create policy "vehicles_update_authenticated"
  on public.vehicles for update
  to authenticated
  using (true)
  with check (true);

-- No delete policy anywhere in this schema: vehicles are never hard-deleted.
