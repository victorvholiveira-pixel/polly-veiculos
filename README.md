# Polly Veículos

Sistema de estoque, vendas e comissão da Polly Veículos — substitui o controle
histórico por planilha Excel/Google Sheets por um app mobile-first simples,
com engenharia séria por trás.

Ver também: [`ARCHITECTURE.md`](./ARCHITECTURE.md) · [`ROADMAP.md`](./ROADMAP.md) ·
[`MIGRATION.md`](./MIGRATION.md) · [`GO_LIVE_CHECKLIST.md`](./GO_LIVE_CHECKLIST.md)

## Status atual

**Ondas 1–6 concluídas** (ver `ROADMAP.md` para o detalhe de cada uma). O
core operacional está funcional: login, Estoque (listar/buscar/cadastrar/
editar), Vender (RPC transacional), Histórico com cancelamento, painel
Início com os 6 indicadores, comissão manual/configurável, Central de
Revisão da migração, auditoria e exportação de dados.

**Ainda não há um projeto Supabase real vinculado** — todo o banco (25+
migrations) foi validado só contra um Postgres 16 local, nunca contra
produção. Ver "Pendência" abaixo antes de rodar o app de verdade, e
`GO_LIVE_CHECKLIST.md` para o que falta antes do lançamento.

O cutover histórico completo (as 602/23/263 vendas da planilha antiga, os
~1.023 veículos candidatos a identidade canônica) segue deliberadamente
não executado — fica para quando a revisão humana na Central de Revisão
estiver pronta, contra o projeto real.

## Stack

- **Frontend**: React 19 + TypeScript (strict) + Vite + Tailwind CSS v4
- **Backend**: Supabase (Postgres + Auth + Row Level Security)
- **PWA**: manifest + service worker via `vite-plugin-pwa` (precache do app shell apenas)
- **Testes**: Vitest + Testing Library (unitário/componente) e Playwright (smoke e2e)

## Rodando localmente

```bash
npm install
cp .env.example .env   # preencha com os dados do seu projeto Supabase
npm run dev
```

### Pendência: projeto Supabase real

Este ambiente de desenvolvimento não tem acesso a Docker nem a uma conta
Supabase para criar um projeto automaticamente. Para rodar o app de verdade
(login, dados reais):

1. Crie um projeto em [supabase.com](https://supabase.com) (gratuito).
2. Em *Project Settings → API*, copie a **Project URL** e a **anon public key**
   para o seu `.env` (nunca a `service_role key`).
3. Aplique as migrations: `supabase link` + `supabase db push` (ou cole o
   conteúdo de `supabase/migrations/*.sql`, em ordem, no SQL Editor do projeto).
4. Crie o primeiro usuário em *Authentication → Users* (e-mail + senha).

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

## Segurança dos dados da planilha histórica

A planilha original (`Venda POLY Atual.xlsx`) contém uma aba com credenciais
sensíveis (bancos, plataformas, CPF). Essa aba está **explicitamente fora**
de qualquer migração, log, commit ou banco deste projeto — ver
[`MIGRATION.md`](./MIGRATION.md).
