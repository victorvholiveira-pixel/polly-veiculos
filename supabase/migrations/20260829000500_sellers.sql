-- Vendedores. Modelado com identidade própria desde já mesmo havendo um único
-- vendedor hoje, para permitir mais de um no futuro sem migração de schema.

create table public.sellers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger sellers_set_updated_at
  before update on public.sellers
  for each row execute function public.set_updated_at();

alter table public.sellers enable row level security;

create policy "sellers_select_authenticated"
  on public.sellers for select
  to authenticated
  using (true);

create policy "sellers_insert_authenticated"
  on public.sellers for insert
  to authenticated
  with check (true);

create policy "sellers_update_authenticated"
  on public.sellers for update
  to authenticated
  using (true)
  with check (true);

-- No delete policy: a seller who leaves is deactivated (active = false), never removed,
-- to preserve historical attribution on past sales.
