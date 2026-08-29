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
2. Aplicar as migrations e importar as vendas legadas pelo workflow manual do
   GitHub Actions — ver "Rodando migrations/imports contra o projeto real"
   abaixo. (Alternativa manual, sem CI: `supabase link --project-ref
   xzcuhrdhccnforqkovof` + `supabase db push`, ou colar o conteúdo de
   `supabase/migrations/*.sql`, em ordem, no SQL Editor do projeto.)
3. Criar o primeiro usuário em *Authentication → Users* (e-mail + senha) —
   não há tela de cadastro no app de propósito.

### Rodando migrations/imports contra o projeto real (GitHub Actions)

Este ambiente de desenvolvimento não alcança `*.supabase.co` na rede (ver
`ARCHITECTURE.md`), então migrations e o import de vendas legadas contra o
projeto real (`xzcuhrdhccnforqkovof`) rodam por um workflow manual do GitHub
Actions: [`.github/workflows/supabase-manual-migration.yml`](./.github/workflows/supabase-manual-migration.yml).
Ele **nunca** roda em push/PR — só quando alguém dispara manualmente.

#### 1. Secrets a criar (uma vez)

No GitHub: **Settings → Environments → `production`** (o workflow está
vinculado a esse Environment; crie-o se ainda não existir) **→ Environment
secrets → Add secret**. Se preferir, também funciona como *Repository
secret* em Settings → Secrets and variables → Actions, mas o Environment é
melhor porque permite exigir aprovação manual antes do job rodar (ver
"Proteções" abaixo).

| Nome exato do secret | Valor | Onde conseguir |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | Personal access token da sua conta Supabase | [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) → Generate new token |
| `SUPABASE_DB_PASSWORD` | Senha do Postgres do projeto `xzcuhrdhccnforqkovof` | Project Settings → Database → Database password (a que você definiu ao criar o projeto; "Reset database password" se não lembrar) |

O project ref (`xzcuhrdhccnforqkovof`) **não** é secret — já está hardcoded
no workflow, porque é um identificador público (aparece na própria URL do
projeto).

#### 2. Como rodar pelo celular ou pelo navegador

1. Abra o repositório no app do GitHub (ou `github.com` no navegador do
   celular).
2. Aba **Actions** → workflow **"Supabase — migração/import manual (projeto
   real)"**.
3. Botão **Run workflow** → escolha o branch (`main`) → escolha a opção em
   **action** → **Run workflow**.
4. Se o Environment `production` tiver aprovação obrigatória configurada, o
   job fica "Waiting" até alguém aprovar (mesma tela, botão **Review
   deployments**).
5. Acompanhe o job rodando; ao final, abra o **Summary** da execução — ele
   mostra uma tabela com o resultado (não precisa ler o log linha a linha).

#### 3. O que cada `action` faz

| `action` | O que roda | Altera o banco? |
|---|---|---|
| `validate-legacy-sales` (padrão) | 3 queries de leitura: quantas vendas `origin='migration'` existem, quantas ocorrências ficaram de fora para revisão, e se alguma venda migrada tem `vehicle_id` | **Não** — só leitura |
| `migrations-only` | `supabase db push` — aplica no projeto real só as migrations de `supabase/migrations/` que ainda não estão no ledger remoto (não reaplica as já aplicadas) | Sim — schema (DDL), nunca dados de vendas |
| `legacy-sales` | Aplica migrations pendentes (inclui `20260829001800_sales_legacy_provenance.sql` se ainda não aplicada) → roda `artifacts/migration/import_legacy_sales.sql` (insere as 542 vendas legadas seguras, `ON CONFLICT DO NOTHING` — seguro rodar de novo) → valida as contagens e **falha o job** se não baterem | Sim — schema + as vendas legadas (nunca mexe em `origin='app'`, e o job confere isso) |

#### 4. Como interpretar o resultado

- Job **verde**: para `legacy-sales`, significa que as 3 métricas bateram
  exatamente (542 importadas / 60 para revisão / 0 com `vehicle_id`) **e**
  que a quantidade e o conteúdo das vendas `origin='app'` não mudaram. Para
  `migrations-only`, significa que `supabase db push` terminou sem erro.
- Job **vermelho**: alguma migration falhou, o import falhou, ou uma das
  validações não bateu — o Summary mostra qual métrica ficou diferente do
  esperado. Nada é mascarado; investigue antes de rodar de novo.
- O Summary sempre lembra que "Home exibindo o histórico mensal" é visual —
  não dá para confirmar por SQL. Depois de um `legacy-sales` verde, abra o
  app de verdade e confira o painel Início.

#### 5. Proteções já no workflow

- `workflow_dispatch` apenas — nada roda em push/PR/merge.
- Job vinculado ao Environment `production` (permite exigir aprovação manual
  antes de rodar, se você configurar "required reviewers" nesse Environment).
- `concurrency` — impede duas execuções ao mesmo tempo no mesmo banco.
- Secrets nunca aparecem em log (senha só existe como variável de ambiente,
  nunca em linha de comando; o GitHub também mascara automaticamente
  qualquer secret que aparecer por engano).
- `set -euo pipefail` em todo passo — nenhuma falha é engolida.
- Migrations aplicadas pelo ledger oficial da CLI (`supabase db push`), não
  por DDL colado às cegas — reexecução é sempre segura.
- Import de vendas usa o mesmo `ON CONFLICT DO NOTHING` do artefato SQL —
  reexecução nunca duplica.

#### Limitação real

Este workflow ainda não é executável a partir deste ambiente de
desenvolvimento (que não alcança `*.supabase.co`) nem foi rodado contra o
projeto real ainda — só validado sintaticamente (`actionlint`). A primeira
execução real deve ser `validate-legacy-sales` (só leitura) para confirmar
que os secrets estão certos, antes de rodar `migrations-only` ou
`legacy-sales`.

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
