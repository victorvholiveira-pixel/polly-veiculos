-- Onda 10 — permite que uma venda em `sales` represente uma venda histórica
-- da planilha (antes do Go-Live), sem exigir um `vehicles` real correspondente
-- e sem fabricar veículo-placeholder só para satisfazer a FK.
--
-- Mesma lógica de proveniência que `vehicles.origin` já usa desde a Onda 1 —
-- não é um conceito novo, só estendido para `sales`. Nenhuma tabela nova.
--
-- Uma venda agora é de exatamente uma origem:
--   - origin='app'       -> sempre tem vehicle_id (um veículo real, RPC
--                            register_sale, como sempre foi).
--   - origin='migration' -> nunca tem vehicle_id (não existe veículo oficial
--                            correspondente); sempre tem source_occurrence_id,
--                            que já aponta para a linha original da planilha
--                            em vehicle_occurrences — de onde marca/modelo/
--                            placa/comprador/vendedor são lidos quando
--                            precisam aparecer na tela (sales não duplica
--                            esses campos).
--
-- sales_one_active_per_vehicle_uk (índice único parcial em vehicle_id) não
-- precisa mudar: Postgres nunca considera dois NULLs iguais num índice
-- único, então múltiplas vendas com vehicle_id=null nunca colidem entre si.

alter table public.sales
  alter column vehicle_id drop not null,
  add column origin text not null default 'app' check (origin in ('app', 'migration')),
  add constraint sales_app_requires_vehicle
    check (origin <> 'app' or vehicle_id is not null),
  add constraint sales_migration_requires_occurrence
    check (origin <> 'migration' or source_occurrence_id is not null),
  add constraint sales_source_occurrence_uk unique (source_occurrence_id);

comment on column public.sales.origin is
  'Proveniência: app = vendida pelo sistema (sempre com vehicle_id real). migration = venda histórica da planilha, importada só a partir de vehicle_occurrences de alta confiança (sale_classification=sale_detected) — nunca tem vehicle_id, sempre tem source_occurrence_id.';
