# Checklist de Go-Live

Nada aqui deve ser marcado como pronto sem evidência real. Reescrito na
Onda 8 (retorno definitivo ao Supabase, projeto `xzcuhrdhccnforqkovof`,
depois do detour de Google Apps Script na Onda 7).

## Banco

- [x] Migrations versionadas e aplicadas com sucesso contra um Postgres real
      (`npm run db:validate` — via Postgres local, 33/33 asserções; não o
      projeto real ainda)
- [x] Migrations aplicadas contra o projeto Supabase real
      (`xzcuhrdhccnforqkovof`) — via `.github/workflows/supabase-deploy.yml`
      (run 33277817821, `action: deploy`). `supabase migration list --linked`
      confirma as 19 migrations com Local/Remote batendo; `db push --dry-run`
      confirma "Remote database is up to date". Precisou de um reparo único
      do ledger primeiro (`supabase migration repair`, só metadado, nenhum
      SQL): o schema de `20260829000100` a `20260829001800` já existia no
      projeto real, aplicado manualmente antes deste pipeline existir, mas
      o ledger da CLI estava vazio — confirmado objeto a objeto antes do
      reparo (ver ARCHITECTURE.md, "Conexão do CI ao Postgres real"). Só
      `20260829001900` (a tabela `_data_migrations`) foi de fato uma
      migration nova aplicada por `db push`.
- [x] Constraints (checks, unique indexes, FKs) validadas com inserts reais
- [x] RLS habilitado em todas as tabelas operacionais, testado por papel
      (anon vs. authenticated) com inserts reais, não só leitura do SQL
- [ ] Backup configurado no projeto Supabase real

## Dados

- [x] Artefato SQL de carga do ledger gerado (`artifacts/migration/load_vehicle_occurrences.sql`,
      via `npm run migration:export-ledger-sql` — mesmo mapeamento de
      `load-ledger.ts`, só que escrito como SQL em vez de chamada de rede,
      porque este ambiente não alcança `*.supabase.co`). Validado rodando
      contra um Postgres 16 local com as migrations reais aplicadas: 1.521
      ocorrências, 17 candidatos de estoque no período mais recente,
      602/23/263 vendas por classificação — todos batendo com
      `migration_summary.json`; 0 linhas vindas da aba sensível "INFORMAÇÃO";
      0 `sales`/`vehicles` criados (nada é confirmado automaticamente).
      Idempotente (testado rodando duas vezes seguidas, sem duplicar nem
      falhar).
- [x] Artefatos mobile-friendly gerados (`npm run migration:export-ledger-mobile`):
      `artifacts/migration/load_vehicle_occurrences.csv` (um arquivo, para
      Table Editor → Import data from CSV — sem colar nada) e
      `artifacts/migration/sql-batches/occurrences_NNN_of_016.sql` (16
      arquivos independentes e idempotentes de ~100 linhas, para quando o
      import de CSV não preservar os dois campos jsonb corretamente). Ambos
      os caminhos validados contra Postgres 16 local com as migrations
      reais: mesmos counts do artefato SQL único (1.521/17/602/23/263/0/0),
      round-trip de jsonb íntegro (`\copy` padrão do Postgres — o importador
      da Supabase Studio pode ter particularidades que não dá para testar
      sem rede real), lotes idempotentes (re-rodar um lote não duplica).
- [x] Artefato(s) executado(s) contra o projeto Supabase real
      (`xzcuhrdhccnforqkovof`) — confirmado indiretamente pelo deploy real
      (health check + import de vendas legadas dependem de
      `vehicle_occurrences` populado e passaram; `INSERT 0 0` no import —
      as 542 vendas já existiam, provando que o ledger de ocorrências já
      estava carregado antes deste pipeline)
- [ ] Estoque validado por humano, linha a linha, na Central de Revisão —
      **NÃO** vira estoque oficial automaticamente
- [ ] Duplicidades tratadas (fila de revisão resolvida ou conscientemente
      deixada pendente)
- [ ] Comissão: regra de negócio definida com o usuário real (hoje: nenhuma
      regra presumida, ver `MIGRATION.md`)
- [x] Vendas legadas auditadas e data-migration criada
      (`supabase/data-migrations/20260829002000_import_legacy_sales.sql`,
      Onda 10 — primeira data-migration do padrão permanente descrito em
      ARCHITECTURE.md): das 602 ocorrências `sale_classification='sale_detected'`,
      542 têm os dois campos obrigatórios de `sales` (data e valor) e um
      par plausível de data (não-futura) — essas viram
      `sales.origin='migration'`, sem `vehicle_id`, sem veículo placeholder.
      As outras 60 (58 sem valor, 2 com data de 2028 por erro de digitação
      na planilha) ficam de fora, para revisão manual — ver `MIGRATION.md`.
      Validado ponta a ponta contra Postgres 16 local com o ledger real,
      via `scripts/db/run-data-migrations.sh` (o mesmo runner que o CI
      usa): 542 importadas, 0 com vehicle_id, idempotente ao rodar duas
      vezes, e a validação interna do arquivo (bloco `raise exception`)
      testada tanto no caminho feliz quanto abortando de propósito.
- [x] Data-migration de vendas legadas executada contra o projeto Supabase
      real (`xzcuhrdhccnforqkovof`) — via `.github/workflows/supabase-deploy.yml`
      (run 33277817821): `legacy_sales_imported = 542`,
      `left_out_for_review = 60`, `legacy_sales_with_a_vehicle_id = 0`,
      período `2022-07-14` a `2026-08-28`. Registrada no ledger
      `public._data_migrations`. Nenhuma venda `origin='app'` tocada (o
      INSERT só atinge linhas com `origin='migration'` por construção da
      própria query).

## Aplicação

- [x] Login (formulário funcional; login de verdade pendente do projeto
      Supabase real estar acessível)
- [x] Estoque (lista, busca, ver, editar — funcional; validado só em
      Postgres local, não no projeto real)
- [x] Cadastro de veículo
- [x] Edição de veículo (nunca permite marcar como vendido — ver Segurança)
- [x] Venda (`register_sale` RPC transacional, fluxo "Vender" completo —
      funcional; não validado contra o projeto real)
- [x] Comissão manual por venda (campo livre no formulário de venda; regra
      automática ainda não existe — ver ROADMAP.md)
- [x] Histórico (vendas reais do app, busca por comprador/placa/marca/modelo)
- [x] Detalhe de venda (Onda 14): `SaleDetailsSheet`, reaproveitado em
      Histórico e Home/"Últimas movimentações" — venda `origin='migration'`
      hidratada de `vehicle_occurrences`, nunca com veículo placeholder
- [x] Cancelamento de venda (`cancel_sale` RPC, motivo obrigatório, reverte
      o veículo para disponível)
- [x] Filtros (estoque, histórico) — busca textual simples
- [x] Painel Início — dashboard executivo (Onda 9): KPIs principais/secundários,
      gráfico de 6 meses, estoque envelhecido, destaques, últimas
      movimentações; validado com screenshots reais (mobile, claro/escuro,
      skeleton, estado vazio) contra dados simulados — o projeto real ainda
      não tem vendas para validar com dado 100% de produção
- [x] Comissão padrão configurável (Mais → Configurações)
- [x] Auditoria (Mais → Auditoria)
- [x] Exportação de dados (Mais → Configurações) — CSV/JSON completos
- [x] PWA instalável (manifest + service worker gerados; ícone é um
      monograma "P" desenhado — não mais fonte de sistema — mas ainda não é
      necessariamente a identidade visual final da marca, decisão do usuário)
- [x] PWA atualiza sozinho (Onda 14): `registerType: 'autoUpdate'` +
      `skipWaiting`/`clientsClaim`/`cleanupOutdatedCaches` explícitos,
      navegação em `NetworkFirst` (não presa em cache-first — confirmado no
      `dist/sw.js` gerado, sem `NavigationRoute`), checagem por evento
      (abrir/foreground/online, nunca polling), proteção contra reload loop
      testada isoladamente, versão/build visível em Mais → Sobre. Validado só
      via build local + inspeção do service worker gerado — falta confirmar
      o ciclo completo (novo deploy → PWA já aberto detecta e atualiza) num
      aparelho real contra a Vercel, ver "Produção" abaixo

## Qualidade

- [x] `npm run lint` sem erros (1 warning informativo conhecido)
- [x] `npm run typecheck` sem erros (TypeScript strict)
- [x] `npm run test` — 185 testes unitários/componente passando
- [x] `npm run test:e2e` — 4/4 smoke tests em navegador real passando (sem
      backend real ainda — provam a fiação client-side, não login de verdade)
- [x] `npm run build` — build de produção sem erros
- [x] `npm run db:validate` — 33/33 asserções + health check + runner de
      data-migrations (idempotência e contagens 542/0 confirmadas) contra
      Postgres 16 local

## Segurança

- [ ] Secrets/env auditados no projeto Supabase real de produção
- [x] Nenhuma `service_role key` em código de frontend
- [x] RLS ativo em toda tabela operacional, sem policy `true` temporária
      esquecida
- [~] `vehicles` ainda permite INSERT/UPDATE direto de `authenticated` por
      RLS; o app usa só as RPCs auditadas `create_vehicle`/`update_vehicle`
      — não bloqueia o lançamento, ver "Endurecimento futuro" em ROADMAP.md
- [ ] Dados privados de cliente confirmados como não expostos publicamente
- [ ] Confirmar que as credenciais expostas na planilha original foram
      trocadas pelo usuário (fora do escopo deste projeto, ver `MIGRATION.md`)

## Produção

- [ ] `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` reais preenchidos (URL já
      conhecida: `https://xzcuhrdhccnforqkovof.supabase.co` — falta a anon/
      publishable key, disponível em Project Settings → API no painel)
- [ ] Domínio/URL de produção definido (Vercel)
- [ ] HTTPS (padrão em Vercel, mas confirmar)
- [ ] Instalação testada num Android real
- [ ] Smoke test real, com dados reais, contra o projeto Supabase de produção

## Cutover da planilha

- [ ] `migration_started_at` / `migration_completed_at` registrados
- [ ] Planilha confirmada como não mais escrita operacionalmente
- [ ] Comunicação ao usuário: planilha agora é só histórico/backup

---

Só declarar Go-Live quando todos os itens acima estiverem genuinamente
marcados — não antes.
