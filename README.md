# Polly Veículos

Sistema de estoque, vendas e comissão da Polly Veículos — substitui o controle
histórico por planilha Excel/Google Sheets por um app mobile-first simples,
com engenharia séria por trás.

Ver também: [`ARCHITECTURE.md`](./ARCHITECTURE.md) · [`ROADMAP.md`](./ROADMAP.md) ·
[`MIGRATION.md`](./MIGRATION.md) · [`GO_LIVE_CHECKLIST.md`](./GO_LIVE_CHECKLIST.md)

## Status atual

**Ondas 1–7 concluídas** (ver `ROADMAP.md` para o detalhe de cada uma). O
core operacional está funcional: login, Estoque (listar/buscar/cadastrar/
editar), Vender, Histórico com cancelamento, painel Início com os 6
indicadores, comissão manual/configurável, Central de Revisão da migração,
auditoria e exportação de dados.

**O backend (Google Apps Script + Sheets) ainda não foi implantado** — toda
a implementação está pronta e testada (`gas/__tests__/`), mas criar e
implantar o projeto Apps Script exige uma ação manual única do usuário (ver
"Rodando com o backend real" abaixo e `GO_LIVE_CHECKLIST.md`).

O cutover histórico completo (as 602/23/263 vendas da planilha antiga, os
~1.023 veículos candidatos a identidade canônica) segue deliberadamente não
executado — fica para quando a revisão humana na Central de Revisão
estiver pronta, contra o backend real.

## Stack

- **Frontend**: React 19 + TypeScript (strict) + Vite + Tailwind CSS v4, PWA
- **Backend**: Google Apps Script (Web App) + Google Sheets — ver `gas/` e `ARCHITECTURE.md`
- **Testes**: Vitest + Testing Library (unitário/componente/backend) e Playwright (smoke e2e)

## Rodando localmente

```bash
npm install
cp .env.example .env   # preencha depois de implantar o backend (abaixo)
npm run dev
```

Sem `VITE_APPS_SCRIPT_URL` configurada, o app sobe normalmente mas qualquer
chamada ao backend falha com um erro claro (nunca com dado inventado).

### Rodando com o backend real

Não é possível provisionar um projeto Apps Script/Web App autonomamente —
criar e implantar exige o editor script.google.com. Passos únicos (ver
`ARCHITECTURE.md`, "Deploy do backend", para o detalhe completo):

1. script.google.com → novo projeto → colar `gas/Store.js`, `gas/Auth.js`,
   `gas/Logic.js`, `gas/Router.js` (um arquivo de script cada) e o manifesto
   `gas/appsscript.json`.
2. Rodar a função `setup()` uma vez (autorizar o pedido de permissão do
   próprio Apps Script) — anota a senha de login e o `ADMIN_SECRET` gerados
   no log de execução.
3. Implantar → Nova implantação → App da Web → executar como "Eu", acesso
   "Qualquer pessoa" → copiar a URL.
4. `VITE_APPS_SCRIPT_URL=<url>` no `.env`.

### Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Typecheck + build de produção |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript em modo strict, sem emitir arquivos |
| `npm run test` | Testes unitários/componente + backend (Vitest) |
| `npm run test:e2e` | Smoke tests em navegador real (Playwright) |
| `npm run migration:load-ledger` | Carrega os artefatos da migração no backend real (`APPS_SCRIPT_URL`/`APPS_SCRIPT_ADMIN_SECRET`) |

## Segurança dos dados da planilha histórica

A planilha original (`Venda POLY Atual.xlsx`) contém uma aba com credenciais
sensíveis (bancos, plataformas, CPF). Essa aba está **explicitamente fora**
de qualquer migração, log, commit ou banco deste projeto — ver
[`MIGRATION.md`](./MIGRATION.md).
