# Polly Veículos

Sistema de estoque, vendas e comissão da Polly Veículos — substitui o controle
histórico por planilha Excel/Google Sheets por um app mobile-first simples,
com engenharia séria por trás.

Ver também: [`ARCHITECTURE.md`](./ARCHITECTURE.md) · [`ROADMAP.md`](./ROADMAP.md) ·
[`MIGRATION.md`](./MIGRATION.md) · [`GO_LIVE_CHECKLIST.md`](./GO_LIVE_CHECKLIST.md)

## Status atual

**Ondas 1–8 concluídas** (ver `ROADMAP.md`). O core operacional está
funcional: login, Estoque (listar/buscar/cadastrar/editar), Vender,
Histórico com cancelamento, painel Início com os 6 indicadores, comissão
manual/configurável, Central de Revisão da migração, auditoria e
exportação de dados.

**Backend definitivo: Supabase** (projeto `xzcuhrdhccnforqkovof`). Um
detour por Google Apps Script + Sheets (Onda 7) foi implementado, testado e
depois abandonado — ver `ARCHITECTURE.md` para o porquê. Nada dessa fase
continua em uso.

**Ainda não há acesso de rede a `*.supabase.co` neste ambiente de
desenvolvimento** — todas as migrations foram validadas só contra um
Postgres 16 local (`npm run db:validate`, 27/27 asserções), nunca contra o
projeto real. Ver `GO_LIVE_CHECKLIST.md` para o que falta antes do
lançamento.

O cutover histórico completo (as 602/23/263 vendas da planilha antiga, os
~1.023 veículos candidatos a identidade canônica) segue deliberadamente não
executado — fica para quando a revisão humana na Central de Revisão
estiver pronta, contra o projeto real.

## Stack

- **Frontend**: React 19 + TypeScript (strict) + Vite + Tailwind CSS v4, PWA
- **Backend**: Supabase (Postgres + Auth + Row Level Security)
- **Testes**: Vitest + Testing Library (unitário/componente) e Playwright (smoke e2e)

## Rodando localmente

```bash
npm install
cp .env.example .env   # preencha com os dados do projeto Supabase
npm run dev
```

### Configurar o projeto Supabase real

Projeto definitivo já criado: `xzcuhrdhccnforqkovof`
(`https://xzcuhrdhccnforqkovof.supabase.co`). Falta:

1. Em *Project Settings → API*, copiar a **Project URL** e a **anon/publishable
   key** para o `.env` (nunca a `service_role key`).
2. As migrations e as data-migrations (import de vendas legadas incluído)
   rodam sozinhas contra o projeto real a cada push em `main` — ver "Deploy
   automático contra o projeto real" abaixo. Nada a clicar. (Alternativa
   manual, sem CI: `supabase link --project-ref xzcuhrdhccnforqkovof` +
   `supabase db push`, ou colar o conteúdo de `supabase/migrations/*.sql`,
   em ordem, no SQL Editor do projeto.)
3. Criar o primeiro usuário em *Authentication → Users* (e-mail + senha) —
   não há tela de cadastro no app de propósito.

### Deploy automático contra o projeto real (GitHub Actions)

Este ambiente de desenvolvimento não alcança `*.supabase.co` na rede (ver
`ARCHITECTURE.md`) — mas isso não é mais um bloqueio para produção: o
GitHub Actions é o executor oficial. A cada push em `main` que altere
`supabase/migrations/**` ou `supabase/data-migrations/**`, o workflow
[`.github/workflows/supabase-deploy.yml`](./.github/workflows/supabase-deploy.yml)
dispara sozinho contra o projeto real (`xzcuhrdhccnforqkovof`) — aplica
migrations pendentes, roda data-migrations pendentes, valida e publica um
Job Summary. Ninguém precisa clicar em "Run workflow" para o fluxo normal.
Fluxo completo: **Claude (ou qualquer contribuidor) implementa → testa
localmente (`npm run db:validate`) → commita/pusha em `main` → GitHub
Actions aplica no projeto real → valida → Job Summary.**

`workflow_dispatch` continua disponível como escape hatch manual (reexecutar
um deploy, ou rodar `validate-only` para um relatório de leitura a qualquer
momento) — só não é necessário para o dia a dia.

#### 1. Secrets (já configurados)

**Settings → Environments → `production` → Environment secrets**:
`SUPABASE_ACCESS_TOKEN` (personal access token, [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens))
e `SUPABASE_DB_PASSWORD` (senha do Postgres do projeto, em Project Settings
→ Database). O project ref (`xzcuhrdhccnforqkovof`) não é secret — está
hardcoded no workflow, é um identificador público.

**Importante para o pipeline continuar 100% automático**: não configure
*required reviewers* nesse Environment `production` — isso pausaria todo
push esperando aprovação manual, o oposto do objetivo. O Environment aqui
existe só para isolar os secrets (só este job os enxerga) e separar o
histórico de execuções, não como gate de aprovação.

#### 2. Dois jeitos de disparar

- **Normal (automático)**: `git push` em `main` tocando `supabase/migrations/**`
  ou `supabase/data-migrations/**`. Acompanhe pela aba **Actions** do
  GitHub (web ou app mobile) — abra a execução e veja o **Summary** (tabela
  pronta, não precisa ler log linha a linha).
- **Manual (escape hatch)**: aba **Actions** → "Supabase — deploy automático
  (schema + dados)" → **Run workflow** → escolha `deploy` (repete o que o
  push faria) ou `validate-only` (só relatório de leitura — ledger de
  data-migrations aplicadas + o que `supabase db push --dry-run` reportaria
  como pendente — não altera nada).

#### 3. O que o job faz, em ordem

1. **Migrations de schema** — `supabase db push --linked`: aplica só o que
   ainda não está no ledger oficial da CLI (`supabase_migrations.schema_migrations`).
   Reexecução nunca reaplica uma migration já aplicada.
2. **Health check** (`scripts/db/health-check.sql`) — confirma extensões,
   tabelas núcleo, RLS habilitado em toda tabela de `public` e as 5 RPCs que
   o app chama diretamente. Read-only.
3. **Data migrations** (`scripts/db/run-data-migrations.sh`) — aplica, em
   ordem, os arquivos de `supabase/data-migrations/` que ainda não estão no
   ledger `public._data_migrations` (por nome de arquivo + checksum sha256
   do conteúdo). Ver "Padrão de data-migrations" abaixo.
4. **Relatório do ledger** — sempre roda, só leitura: mostra quais
   data-migrations já foram aplicadas e o que ficaria pendente de schema.

Passos 1 e 3 só rodam em `deploy` (push normal, ou `workflow_dispatch` com
`action: deploy`); em `validate-only` só os passos 2 e 4 rodam.

#### 4. Padrão de data-migrations (`supabase/data-migrations/`)

Para qualquer carga/alteração de dados reais (o import de vendas legadas é
o primeiro exemplo, `20260829002000_import_legacy_sales.sql`) — o
equivalente, para dados, do que `supabase/migrations/` já é para schema:

- **Nome do arquivo = identificador único e versionado**, mesma convenção
  de timestamp de `supabase/migrations/` (`YYYYMMDDHHMMSS_descrição.sql`).
- **Idempotente por design**: `scripts/db/run-data-migrations.sh` registra
  cada arquivo aplicado em `public._data_migrations` (id = nome do arquivo,
  checksum = sha256 do conteúdo). Rodar de novo pula tudo que já está no
  ledger — nunca duplica.
- **Editar um arquivo já aplicado é um erro, não um no-op**: se o checksum
  do arquivo não bate com o que está registrado no ledger, o runner **falha
  alto** em vez de reaplicar ou ignorar em silêncio. Uma correção sempre
  vira um novo arquivo.
- **Cada arquivo valida o próprio resultado**: um bloco
  `do $$ ... raise exception ... end $$;` no final aborta a transação
  inteira (dado inserido + registro no ledger) se o resultado não for o
  esperado — nunca fica "meio aplicado", e uma correção pode ser commitada
  e será tentada de novo no próximo push, sem duplicar o que já rodou.
- Continua funcionando colado manualmente no SQL Editor, se precisar
  depurar — só o registro automático no ledger não acontece fora do runner.

Testado localmente, de ponta a ponta, contra os dados reais da planilha
antes deste pipeline existir: `npm run db:validate` carrega o ledger real
de `vehicle_occurrences` (1.521 linhas) num Postgres descartável, roda o
runner duas vezes seguidas (prova idempotência) e confere 542 vendas
importadas / 0 com `vehicle_id`.

#### 5. Proteções do workflow

- Só dispara em push em `main` (com path filter) ou `workflow_dispatch` —
  nunca em PR, nunca em outro branch.
- `concurrency` — impede duas execuções ao mesmo tempo no mesmo banco (a
  segunda espera a primeira terminar, nunca cancela um deploy em andamento).
- Secrets nunca aparecem em log (senha só existe como variável de ambiente,
  nunca em linha de comando; o GitHub também mascara automaticamente
  qualquer secret que aparecer por engano).
- `set -euo pipefail` em todo passo — nenhuma falha é engolida.
- Migrations de schema pelo ledger oficial da CLI; data-migrations pelo
  ledger próprio (`public._data_migrations`) com checagem de checksum —
  reexecução é sempre segura nos dois casos.

#### Limitação real

Nem o workflow nem o runner de data-migrations foram executados contra o
projeto real ainda (este ambiente de desenvolvimento não alcança
`*.supabase.co`) — só validados: sintaxe (`actionlint` + `shellcheck`, 0
achados) e o runner de data-migrations de ponta a ponta contra os dados
reais da planilha, num Postgres local (`npm run db:validate`), incluindo os
casos de idempotência, checksum divergente e falha de validação interna. A
primeira execução real será o próximo push em `main` que altere
`supabase/migrations/**` ou `supabase/data-migrations/**` — ou
`workflow_dispatch` → `validate-only` antes disso, se quiser conferir que os
secrets estão certos sem alterar nada.

### Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Typecheck + build de produção |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript em modo strict, sem emitir arquivos |
| `npm run test` | Testes unitários/componente (Vitest) |
| `npm run test:e2e` | Smoke tests em navegador real (Playwright) |
| `npm run db:validate` | Aplica as migrations a um Postgres local descartável e valida constraints/RLS (ver `ARCHITECTURE.md`) |
| `npm run migration:load-ledger` | Carrega os artefatos da migração no Supabase real (`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`) |
| `npm run migration:export-ledger-sql` | Gera `artifacts/migration/load_vehicle_occurrences.sql` — mesma carga acima, como SQL pronto para colar no SQL Editor do Supabase, para quando não há rede até `*.supabase.co` |
| `npm run migration:export-ledger-mobile` | Mesma carga, em formato para operar pelo celular: `load_vehicle_occurrences.csv` (Table Editor → Import data from CSV, um arquivo, sem colar nada) + `sql-batches/occurrences_NNN_of_016.sql` (lotes pequenos, independentes e idempotentes, como alternativa se o CSV não preservar os campos jsonb) |

## Segurança dos dados da planilha histórica

A planilha original (`Venda POLY Atual.xlsx`) contém uma aba com credenciais
sensíveis (bancos, plataformas, CPF). Essa aba está **explicitamente fora**
de qualquer migração, log, commit ou banco deste projeto — ver
[`MIGRATION.md`](./MIGRATION.md).
