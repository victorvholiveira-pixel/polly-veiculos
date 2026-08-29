-- Ledger das "data migrations" (supabase/data-migrations/*.sql) — o
-- equivalente, para carga/alteração de dados, do que
-- supabase_migrations.schema_migrations já é para DDL (mantido pela própria
-- Supabase CLI). Gerenciado só por scripts/db/run-data-migrations.sh; não
-- editar manualmente.
--
-- id = nome do arquivo (ex.: '20260829002000_import_legacy_sales.sql'), a
-- mesma convenção de nome com timestamp de supabase/migrations/. checksum
-- (sha256 do conteúdo do arquivo) existe para detectar — e recusar — um
-- arquivo já aplicado que foi editado depois, em vez de reaplicar ou
-- ignorar isso em silêncio.

create table if not exists public._data_migrations (
  id text primary key,
  checksum text not null,
  applied_at timestamptz not null default now()
);

comment on table public._data_migrations is
  'Ledger de data-migrations aplicadas (supabase/data-migrations/*.sql), mantido por scripts/db/run-data-migrations.sh. Não editar manualmente — ver ARCHITECTURE.md, "Data migrations".';

-- RLS habilitado, sem nenhuma policy: só o role postgres (superuser, o que
-- o runner de CI usa) enxerga esta tabela. anon/authenticated nunca devem
-- ler nem escrever aqui — não é dado de app, é metadado interno do pipeline.
alter table public._data_migrations enable row level security;
