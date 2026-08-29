-- Health check pós-deploy: só leitura, roda depois de `supabase db push`
-- (schema) e depois do runner de data-migrations. Confirma o básico que
-- todo o resto do app assume que sempre é verdade — não é um substituto
-- para scripts/db/assertions.sql (que testa constraints/RLS/RPCs a fundo
-- num Postgres descartável), é uma checagem rápida e barata contra o banco
-- de verdade depois de cada deploy real.
--
-- Cada falha aborta a transação com RAISE EXCEPTION — mensagem clara,
-- job de CI vermelho, nada mascarado.

do $$
declare
  v_missing text;
begin
  -- Extensões que toda migration em supabase/migrations/ assume que existem.
  if not exists (select 1 from pg_extension where extname = 'pgcrypto') then
    raise exception 'health-check: extensão pgcrypto ausente';
  end if;
  if not exists (select 1 from pg_extension where extname = 'pg_trgm') then
    raise exception 'health-check: extensão pg_trgm ausente';
  end if;

  -- Tabelas núcleo do schema operacional (uma por migration em
  -- supabase/migrations/) + o ledger de data-migrations.
  select string_agg(t, ', ') into v_missing
  from unnest(array[
    'vehicles', 'sales', 'vehicle_occurrences', 'vehicle_match_candidates',
    'sellers', 'app_settings', 'audit_log', 'migration_import_batches',
    '_data_migrations'
  ]) as t
  where not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = t
  );
  if v_missing is not null then
    raise exception 'health-check: tabelas esperadas ausentes: %', v_missing;
  end if;

  -- RLS precisa estar ligado em toda tabela de public — nenhuma exceção,
  -- nem para tabelas internas do pipeline (ver GO_LIVE_CHECKLIST.md,
  -- "RLS habilitado em todas as tabelas operacionais").
  select string_agg(c.relname, ', ') into v_missing
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and not c.relrowsecurity;
  if v_missing is not null then
    raise exception 'health-check: RLS desabilitado em: %', v_missing;
  end if;

  -- As RPCs que o app chama diretamente (Vender, Cancelar, Cadastrar
  -- veículo) precisam existir — um `db push` que falhar/pular alguma
  -- migration silenciosamente quebraria o app inteiro sem isso.
  select string_agg(f, ', ') into v_missing
  from unnest(array[
    'register_sale', 'cancel_sale', 'create_vehicle', 'update_vehicle',
    'create_initial_inventory'
  ]) as f
  where not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = f
  );
  if v_missing is not null then
    raise exception 'health-check: funções/RPCs esperadas ausentes: %', v_missing;
  end if;
end $$;

select 'health-check OK' as status;
