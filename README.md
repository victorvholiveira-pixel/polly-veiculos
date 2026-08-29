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
2. Aplicar as migrations: `supabase link --project-ref xzcuhrdhccnforqkovof`
   + `supabase db push` (ou colar o conteúdo de `supabase/migrations/*.sql`,
   em ordem, no SQL Editor do projeto).
3. Criar o primeiro usuário em *Authentication → Users* (e-mail + senha) —
   não há tela de cadastro no app de propósito.

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

## Segurança dos dados da planilha histórica

A planilha original (`Venda POLY Atual.xlsx`) contém uma aba com credenciais
sensíveis (bancos, plataformas, CPF). Essa aba está **explicitamente fora**
de qualquer migração, log, commit ou banco deste projeto — ver
[`MIGRATION.md`](./MIGRATION.md).
