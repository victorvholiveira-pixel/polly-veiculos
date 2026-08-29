#!/usr/bin/env bash
# Aplica supabase/data-migrations/*.sql pendentes, em ordem, contra o banco
# apontado pelas variáveis padrão do psql (PGHOST/PGPORT/PGUSER/PGDATABASE/
# PGPASSWORD/PGSSLMODE — já exportadas por quem chama este script: o
# workflow de deploy ou scripts/db/validate-migrations.sh).
#
# Idempotente por design, não só por convenção: cada arquivo só roda uma vez,
# registrado em public._data_migrations (id = nome do arquivo, checksum =
# sha256 do conteúdo). Rodar de novo pula tudo que já está no ledger. Se um
# arquivo já aplicado for editado depois (checksum diferente do registrado),
# este script FALHA alto em vez de reaplicar ou ignorar em silêncio — nunca
# se edita uma data-migration já aplicada; cria-se uma nova.
#
# Cada arquivo em supabase/data-migrations/ é responsável por validar o
# próprio resultado (ver 20260829002000_import_legacy_sales.sql — bloco
# `do $$ ... raise exception ... end $$;` no final). Se a validação falhar,
# a transação inteira aborta — incluindo o registro no ledger — então uma
# correção pode ser commitada e o mesmo arquivo será tentado de novo no
# próximo deploy, sem duplicar nada do que já rodou com sucesso antes.
#
# Uso: scripts/db/run-data-migrations.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DATA_DIR="$ROOT_DIR/supabase/data-migrations"

psql -v ON_ERROR_STOP=1 -q -c "
  create table if not exists public._data_migrations (
    id text primary key,
    checksum text not null,
    applied_at timestamptz not null default now()
  );
"

shopt -s nullglob
files=("$DATA_DIR"/*.sql)
if [ ${#files[@]} -eq 0 ]; then
  echo "==> nenhuma data-migration em $DATA_DIR"
  exit 0
fi

for file in "${files[@]}"; do
  id="$(basename "$file")"
  checksum="sha256:$(sha256sum "$file" | cut -d' ' -f1)"

  existing_checksum=$(psql -v ON_ERROR_STOP=1 -tAc "select checksum from public._data_migrations where id = '$id';")

  if [ -n "$existing_checksum" ]; then
    if [ "$existing_checksum" != "$checksum" ]; then
      echo "::error::data-migration '$id' já foi aplicada com checksum diferente do arquivo atual ($existing_checksum -> $checksum). Uma data-migration já aplicada nunca deve ser editada — crie um novo arquivo para qualquer correção." >&2
      exit 1
    fi
    echo "==> pular (já aplicada): $id"
    continue
  fi

  echo "==> aplicando: $id"
  wrapper="$(mktemp)"
  cat > "$wrapper" <<EOF
begin;
\i $file
insert into public._data_migrations (id, checksum) values (:'id', :'checksum');
commit;
EOF
  psql -v ON_ERROR_STOP=1 -v id="$id" -v checksum="$checksum" -f "$wrapper"
  rm -f "$wrapper"
  echo "==> aplicada e registrada no ledger: $id"
done
