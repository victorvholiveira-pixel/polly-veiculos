-- Trilha de auditoria de operações críticas (criação/edição de veículo, venda,
-- cancelamento, alteração manual de comissão). Sem UI dedicada nesta fase —
-- só a tabela, como requisito do produto.
--
-- Sem policy de insert/update/delete para `authenticated`: linhas de auditoria só
-- devem ser gravadas por funções SECURITY DEFINER (RPCs) ou triggers do servidor,
-- nunca diretamente pelo frontend — senão o próprio log deixaria de ser confiável.

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('vehicle', 'sale', 'vehicle_occurrence', 'settings')),
  entity_id uuid not null,
  action text not null,
  actor uuid references auth.users (id),
  diff jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_entity_idx on public.audit_log (entity_type, entity_id);
create index audit_log_created_at_idx on public.audit_log (created_at);

alter table public.audit_log enable row level security;

create policy "audit_log_select_authenticated"
  on public.audit_log for select
  to authenticated
  using (true);

-- No insert/update/delete policy for `authenticated` on purpose (see header comment).
