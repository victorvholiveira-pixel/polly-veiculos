-- Vendas. Nunca há DELETE — cancelamento é sempre status='cancelled' com motivo
-- e timestamp obrigatórios (soft cancel), preservando o histórico completo.
--
-- Comissão fica deliberadamente sem regra: commission_amount/commission_percentage
-- são preenchidos manualmente (ou ficam null) até a regra de negócio ser definida
-- com o usuário real (ver FASE 0.5, item G). commission_rule_snapshot existe para,
-- quando uma regra existir, congelar os parâmetros vigentes por venda — uma mudança
-- futura de regra nunca deve recalcular comissões passadas.

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id),
  seller_id uuid references public.sellers (id),

  sale_date date not null,
  customer_name text,
  customer_phone text,
  sale_value numeric(12, 2) not null check (sale_value >= 0),
  deal_type text,
  trade_in_description text,
  channel text,  -- Plataforma: Carteira, iCarros, WebMotors, Mercado Livre, Mobiauto, Site Loja...

  commission_amount numeric(12, 2),
  commission_percentage numeric(5, 2),
  commission_rule_snapshot jsonb,

  observations text,
  status text not null default 'completed' check (status in ('completed', 'cancelled')),
  cancelled_reason text,
  cancelled_at timestamptz,

  source_occurrence_id uuid references public.vehicle_occurrences (id),  -- null = venda ao vivo, não migrada
  created_by uuid references auth.users (id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (status <> 'cancelled' or (cancelled_reason is not null and cancelled_at is not null))
);

comment on table public.sales is
  'Vendas. DELETE nunca é usado — cancelamento é sempre soft (status=cancelled + motivo + timestamp).';

-- Só pode existir uma venda ATIVA por veículo por vez — segunda linha de defesa
-- (a primeira é o RPC transacional que fará essa checagem antes de inserir).
create unique index sales_one_active_per_vehicle_uk
  on public.sales (vehicle_id)
  where status = 'completed';

create index sales_sale_date_idx on public.sales (sale_date);
create index sales_vehicle_id_idx on public.sales (vehicle_id);
create index sales_seller_id_idx on public.sales (seller_id);
create index sales_channel_idx on public.sales (channel);

create trigger sales_set_updated_at
  before update on public.sales
  for each row execute function public.set_updated_at();

alter table public.sales enable row level security;

-- Read-only for the app via direct table access. Writes happen exclusively
-- through the register_sale/cancel_sale RPC functions (SECURITY DEFINER,
-- introduced in the wave that implements the Vender flow — Onda 1 intentionally
-- ships no sales writes at all), which bypass RLS by running as the function
-- owner. This keeps every write within the atomic transaction contract approved
-- in FASE 0.5, instead of trusting arbitrary direct inserts/updates to respect it.
create policy "sales_select_authenticated"
  on public.sales for select
  to authenticated
  using (true);

-- No insert/update/delete policy for `authenticated` here on purpose.
