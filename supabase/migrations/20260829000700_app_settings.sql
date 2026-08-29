-- Configurações da loja. Tabela singleton (uma única linha).
-- default_commission_pct fica null propositalmente — nenhuma regra de comissão
-- é presumida (ver FASE 0.5, item G). A UI deve mostrar um estado "não
-- configurado" em vez de inventar um percentual.

create table public.app_settings (
  id boolean primary key default true check (id),
  default_commission_pct numeric(5, 2),
  store_name text not null default 'Polly Veículos',
  cnpj text,
  updated_at timestamptz not null default now()
);

comment on table public.app_settings is 'Singleton (id sempre true) — uma única linha de configuração da loja.';

create trigger app_settings_set_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

insert into public.app_settings (id) values (true)
  on conflict (id) do nothing;

alter table public.app_settings enable row level security;

create policy "app_settings_select_authenticated"
  on public.app_settings for select
  to authenticated
  using (true);

create policy "app_settings_update_authenticated"
  on public.app_settings for update
  to authenticated
  using (true)
  with check (true);

-- No insert/delete policy: the singleton row is seeded by this migration only.
