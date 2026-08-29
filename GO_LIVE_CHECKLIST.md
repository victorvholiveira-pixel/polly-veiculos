# Checklist de Go-Live

Nada aqui deve ser marcado como pronto sem evidência real. Reescrito na
Onda 8 (retorno definitivo ao Supabase, projeto `xzcuhrdhccnforqkovof`,
depois do detour de Google Apps Script na Onda 7).

## Banco

- [x] Migrations versionadas e aplicadas com sucesso contra um Postgres real
      (`npm run db:validate` — via Postgres local, 33/33 asserções; não o
      projeto real ainda)
- [ ] Migrations aplicadas contra o projeto Supabase real
      (`xzcuhrdhccnforqkovof`) — **bloqueado neste ambiente**: o proxy de
      saída rejeita qualquer conexão a `*.supabase.co`/`api.supabase.com`
      por política da organização, não por falta de credencial (ver
      `ARCHITECTURE.md`, "Bloqueio de acesso real ao Supabase"). Precisa
      rodar de fora deste ambiente — a máquina do usuário ou CI. Caminho
      recomendado agora: workflow manual `.github/workflows/supabase-manual-migration.yml`
      (`action: migrations-only`, pelo GitHub Actions — ver README.md,
      "Rodando migrations/imports contra o projeto real"). Ainda não
      executado contra o projeto real.
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
- [ ] Artefato(s) executado(s) contra o projeto Supabase real
      (`xzcuhrdhccnforqkovof`) — falta o usuário rodar pelo painel (CSV
      primeiro; lotes SQL pequenos como alternativa) e confirmar os mesmos
      counts. Caminho recomendado agora: mesmo workflow manual do GitHub
      Actions citado acima (dá pra disparar pelo celular, sem precisar
      colar nada no painel) — ver README.md.
- [ ] Estoque validado por humano, linha a linha, na Central de Revisão —
      **NÃO** vira estoque oficial automaticamente
- [ ] Duplicidades tratadas (fila de revisão resolvida ou conscientemente
      deixada pendente)
- [ ] Comissão: regra de negócio definida com o usuário real (hoje: nenhuma
      regra presumida, ver `MIGRATION.md`)
- [x] Vendas legadas auditadas e artefato de importação gerado
      (`artifacts/migration/import_legacy_sales.sql`, Onda 10): das 602
      ocorrências `sale_classification='sale_detected'`, 542 têm os dois
      campos obrigatórios de `sales` (data e valor) e um par plausível de
      data (não-futura) — essas viram `sales.origin='migration'`, sem
      `vehicle_id`, sem veículo placeholder. As outras 60 (58 sem valor, 2
      com data de 2028 por erro de digitação na planilha) ficam de fora,
      para revisão manual — ver `MIGRATION.md`. Validado ponta a ponta
      contra Postgres 16 local com o ledger real: 542 importadas, 0 com
      vehicle_id, idempotente ao rodar duas vezes.
- [ ] Artefato de vendas legadas executado contra o projeto Supabase real
      (`xzcuhrdhccnforqkovof`) — falta rodar
      `artifacts/migration/import_legacy_sales.sql` (roda inteiramente a
      partir do `vehicle_occurrences` já carregado, sem depender de nenhum
      arquivo externo — só depende do item anterior de carga do ledger já
      ter rodado). Duas formas: colar no SQL Editor, **ou** disparar o
      workflow manual `.github/workflows/supabase-manual-migration.yml`
      com `action: legacy-sales` (aplica a migration
      `20260829001800_sales_legacy_provenance.sql`, importa e já valida os
      3 números — 542/60/0 — falhando o job se algum não bater; ver
      README.md).

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
- [x] PWA instalável (manifest + service worker gerados; ícones são placeholder)

## Qualidade

- [x] `npm run lint` sem erros (1 warning informativo conhecido)
- [x] `npm run typecheck` sem erros (TypeScript strict)
- [x] `npm run test` — 132 testes unitários/componente passando
- [x] `npm run test:e2e` — 4/4 smoke tests em navegador real passando (sem
      backend real ainda — provam a fiação client-side, não login de verdade)
- [x] `npm run build` — build de produção sem erros
- [x] `npm run db:validate` — 33/33 asserções contra Postgres 16 local

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
