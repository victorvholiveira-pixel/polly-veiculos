-- Importa vendas históricas de alta confiança da planilha antiga para
-- `sales`, com origin='migration' e sem vehicle_id (nenhum veículo
-- placeholder é criado — ver 20260829001800_sales_legacy_provenance.sql).
--
-- Fonte: vehicle_occurrences, já carregado no projeto real (ver
-- GO_LIVE_CHECKLIST.md — carga do ledger). Não depende de nenhum arquivo
-- externo: roda inteiramente dentro do banco.
--
-- Critério de segurança (auditoria de 2026-08-29, ver relatório da
-- conversa): das 602 ocorrências classificadas como sale_classification=
-- 'sale_detected' (a classificação de alta confiança da migração), 58 não
-- têm valor de venda registrado na planilha original e 2 têm data de venda
-- no futuro (typo real da planilha: "2028" em sheets de 2025) — nenhuma das
-- duas fica de fora por acaso, e nenhum dado ausente é inventado para
-- completá-las. Sobram 542 realmente seguras para importar automaticamente.
--
-- Idempotente: a constraint sales_source_occurrence_uk (unique) garante que
-- rodar este script mais de uma vez nunca duplica uma venda já importada —
-- o ON CONFLICT DO NOTHING cobre exatamente esse caso.
--
-- Este é o padrão permanente de "data migration" do projeto (ver
-- ARCHITECTURE.md, "Data migrations"): arquivos aqui em
-- supabase/data-migrations/ são aplicados automaticamente por
-- scripts/db/run-data-migrations.sh (chamado tanto pelo workflow de deploy
-- quanto por `npm run db:validate` localmente), que registra cada um por
-- nome de arquivo + checksum em public._data_migrations — nunca reaplica um
-- já aplicado, e nunca reaplica silenciosamente um que foi editado depois
-- (isso vira erro alto, de propósito). Continua seguro colar este arquivo
-- inteiro no SQL Editor manualmente também, se precisar — o bloco de
-- validação no fim aborta a transação e mostra o erro do mesmo jeito; só o
-- registro automático no ledger não acontece fora do runner.

insert into public.sales (
  sale_date, sale_value, customer_name, customer_phone,
  trade_in_description, channel, observations,
  status, origin, source_occurrence_id
)
select
  o.sale_date_parsed,
  coalesce(o.confirmed_value, o.value_parsed),
  o.buyer_name_raw,
  o.buyer_phone_raw,
  o.trade_in_raw,
  o.channel_raw,
  o.observations_raw,
  'completed',
  'migration',
  o.id
from public.vehicle_occurrences o
where o.observed_status = 'sold'
  and o.sale_classification = 'sale_detected'
  and o.sale_date_parsed is not null
  and o.sale_date_parsed <= current_date
  and coalesce(o.confirmed_value, o.value_parsed) is not null
on conflict (source_occurrence_id) do nothing;

-- ================================================================
-- Leitura para acompanhar no log (sempre roda, não altera nada).
-- ================================================================

-- Esperado: 542
select count(*) as legacy_sales_imported from public.sales where origin = 'migration';

-- Período coberto pelo histórico importado
select min(sale_date) as earliest_sale, max(sale_date) as latest_sale
from public.sales where origin = 'migration';

-- Esperado: 60 (deixadas de fora conscientemente — 58 sem valor + 2 com
-- data futura — para revisão manual, nunca para import automático)
select count(*) as left_out_for_review
from public.vehicle_occurrences o
where o.observed_status = 'sold'
  and o.sale_classification = 'sale_detected'
  and (
    o.sale_date_parsed is null
    or o.sale_date_parsed > current_date
    or coalesce(o.confirmed_value, o.value_parsed) is null
  )
  and not exists (select 1 from public.sales s where s.source_occurrence_id = o.id);

-- Nenhuma venda importada aqui tem vehicle_id (deve retornar 0 — nenhum
-- veículo placeholder foi ou precisa ser criado para isso funcionar)
select count(*) as legacy_sales_with_a_vehicle_id
from public.sales where origin = 'migration' and vehicle_id is not null;

-- ================================================================
-- Gate: aborta a transação (e por isso o registro no ledger, feito pelo
-- runner *depois* deste \i) se qualquer número acima não bater. Sem isto,
-- um pipeline automático poderia marcar como "aplicada com sucesso" uma
-- importação que na verdade saiu errada.
-- ================================================================

do $$
declare
  v_imported int;
  v_left_out int;
  v_with_vehicle int;
begin
  select count(*) into v_imported from public.sales where origin = 'migration';
  if v_imported <> 542 then
    raise exception 'import_legacy_sales: esperado 542 vendas com origin=migration, obtido %', v_imported;
  end if;

  select count(*) into v_left_out
  from public.vehicle_occurrences o
  where o.observed_status = 'sold'
    and o.sale_classification = 'sale_detected'
    and (
      o.sale_date_parsed is null
      or o.sale_date_parsed > current_date
      or coalesce(o.confirmed_value, o.value_parsed) is null
    )
    and not exists (select 1 from public.sales s where s.source_occurrence_id = o.id);
  if v_left_out <> 60 then
    raise exception 'import_legacy_sales: esperado 60 ocorrências deixadas para revisão, obtido %', v_left_out;
  end if;

  select count(*) into v_with_vehicle
  from public.sales where origin = 'migration' and vehicle_id is not null;
  if v_with_vehicle <> 0 then
    raise exception 'import_legacy_sales: nenhuma venda migrada pode ter vehicle_id, obtido %', v_with_vehicle;
  end if;
end $$;
