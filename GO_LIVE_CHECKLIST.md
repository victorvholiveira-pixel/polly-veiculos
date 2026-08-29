# Checklist de Go-Live

Nada aqui deve ser marcado como pronto sem evidência real. Reescrito na
Onda 8 (retorno definitivo ao Supabase, projeto `xzcuhrdhccnforqkovof`,
depois do detour de Google Apps Script na Onda 7).

## Banco

- [x] Migrations versionadas e aplicadas com sucesso contra um Postgres real
      (`npm run db:validate` — via Postgres local, 27/27 asserções; não o
      projeto real ainda)
- [ ] Migrations aplicadas contra o projeto Supabase real
      (`xzcuhrdhccnforqkovof`) — **bloqueado neste ambiente**: o proxy de
      saída rejeita qualquer conexão a `*.supabase.co`/`api.supabase.com`
      por política da organização, não por falta de credencial (ver
      `ARCHITECTURE.md`, "Bloqueio de acesso real ao Supabase"). Precisa
      rodar de fora deste ambiente — a máquina do usuário ou CI.
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
- [ ] Artefato executado contra o projeto Supabase real (`xzcuhrdhccnforqkovof`)
      — falta colar `artifacts/migration/load_vehicle_occurrences.sql` no SQL
      Editor do projeto; o próprio arquivo já traz, no final, as queries de
      validação de contagem
- [ ] Estoque validado por humano, linha a linha, na Central de Revisão —
      **NÃO** vira estoque oficial automaticamente
- [ ] Duplicidades tratadas (fila de revisão resolvida ou conscientemente
      deixada pendente)
- [ ] Comissão: regra de negócio definida com o usuário real (hoje: nenhuma
      regra presumida, ver `MIGRATION.md`)

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
- [x] Painel Início com os 6 indicadores aprovados
- [x] Comissão padrão configurável (Mais → Configurações)
- [x] Auditoria (Mais → Auditoria)
- [x] Exportação de dados (Mais → Configurações) — CSV/JSON completos
- [x] PWA instalável (manifest + service worker gerados; ícones são placeholder)

## Qualidade

- [x] `npm run lint` sem erros (1 warning informativo conhecido)
- [x] `npm run typecheck` sem erros (TypeScript strict)
- [x] `npm run test` — 81 testes unitários/componente passando
- [x] `npm run test:e2e` — 4/4 smoke tests em navegador real passando (sem
      backend real ainda — provam a fiação client-side, não login de verdade)
- [x] `npm run build` — build de produção sem erros
- [x] `npm run db:validate` — 27/27 asserções contra Postgres 16 local

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
