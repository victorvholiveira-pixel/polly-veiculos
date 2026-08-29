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
-- o ON CONFLICT DO NOTHING cobre exatamente esse caso, então é seguro
-- colar de novo no SQL Editor sem checar antes se já rodou.

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
-- Validação — rode isto depois (também roda automaticamente se você
-- executar o arquivo inteiro de uma vez no SQL Editor).
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
