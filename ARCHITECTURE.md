# Arquitetura

Este documento registra as decisões de arquitetura do Polly Veículos. Para o
contrato completo do "banco" (abas, colunas, regras de negócio), ver os
arquivos em `gas/` — eles são a fonte de verdade; este documento explica o
*porquê*.

## Mudança de arquitetura (pós-Onda 6)

As Ondas 1–6 foram construídas sobre Supabase (Postgres + Auth + RLS). Sem
projeto Supabase real disponível em nenhum momento (mesmo bloqueio reportado
repetidamente — sem credenciais, Docker, CLI autenticada), e dado o volume
real esperado (~20-30 vendas/mês, uso pessoal), o backend foi trocado por
**Google Apps Script + Google Sheets**: mais simples de provisionar (o
usuário já tem conta Google), zero custo de hospedagem de banco, e
suficiente para esse volume. O frontend e a experiência do usuário foram
preservados — só a camada de dados mudou.

## Visão geral

```
React + TS + Vite + Tailwind (PWA)  →  Google Apps Script Web App  →  Google Sheets
           (frontend)                      (API + regras)              (armazenamento)
```

Um único cliente HTTP centralizado (`src/lib/api.ts`) — nenhuma outra parte
do frontend chama `fetch` no backend diretamente. A planilha em si (o
"banco") nunca é exposta ao usuário final — ele nunca a abre, nunca a edita
à mão; é só armazenamento por trás da API.

## Por que Google Apps Script + Sheets, e não outro backend

- **Zero infraestrutura para o usuário manter**: roda na conta Google que
  ele já tem, sem outro provedor para cadastrar, sem cartão de crédito, sem
  fatura mensal.
- **Suficiente para o volume real**: ~20-30 vendas/mês e dezenas de veículos
  em estoque estão muito abaixo de qualquer limite prático do Sheets ou de
  cota do Apps Script.
- **Simples de auditar**: qualquer pessoa técnica consegue abrir a planilha
  e entender o "banco" olhando as abas — não é uma caixa-preta.
- O que se perde, conscientemente: transações reais, constraints de banco,
  índices — ver "Invariantes sem banco relacional" abaixo para como cada uma
  foi preservada em código.

## O "banco" (Google Sheets)

Uma única planilha, criada automaticamente no primeiro `setup()` (ver
"Deploy do backend"). Cada aba é uma tabela — a linha 1 é o cabeçalho, cada
linha seguinte é um registro. Nomes de coluna em `gas/Store.js`
(`SHEET_COLUMNS`) são a fonte de verdade.

- `Vehicles` — identidade canônica do veículo real. `id` (uuid) é a única
  identidade que outras abas referenciam; a placa é um atributo, nunca uma
  identidade (pode ser corrigida sem afetar `Vehicles.id`).
- `VehicleOccurrences` — ledger imutável de cada linha da planilha antiga
  migrada. Também *é* o modelo de proveniência — não existe uma aba genérica
  separada para isso.
- `VehicleMatchCandidates` — evidência de possível duplicidade entre
  ocorrências, para revisão humana. Guarda **chaves de ocorrência**
  (`source_sheet#source_row`), não uma referência a um `Vehicles.id` real —
  a maioria dos 1.023 candidatos de identidade estimados na Onda 2 não
  correspondem a veículos reais ainda, e forçar essa referência exigiria
  fabricar veículos-placeholder só para guardar evidência.
- `Sellers`, `Sales`, `AppSettings` (linha única), `AuditLog`,
  `MigrationImportBatches`.

## O backend (`gas/`)

Quatro arquivos, colados como estão no editor do Apps Script (nenhum build
step — é JavaScript puro, compatível com o runtime V8 do Apps Script):

- **`Store.js`** — CRUD genérico sobre as abas (`readAll_`, `appendRow_`,
  `appendRows_`, `updateById_`, `findById_`) + `setup()`/`resetPassword()`.
- **`Auth.js`** — login simples (uma senha compartilhada — ver "Auth"
  abaixo) e o token assinado.
- **`Logic.js`** — as regras de negócio: o equivalente às antigas RPCs do
  Postgres (`registerSale_`, `cancelSale_`, `createVehicle_`,
  `updateVehicle_`, `createInitialInventory_`, etc.).
- **`Router.js`** — `doPost`/`doGet`, um único endpoint despachando por
  `action`.

Testado com Vitest via um harness que carrega esses mesmos arquivos num
`vm` do Node com mocks de `SpreadsheetApp`/`PropertiesService`/`Utilities`/
`LockService` — ver "Testando o backend" abaixo e `gas/__tests__/`.

## Auth

Sem cadastro de usuários — é um app pessoal para 1-2 pessoas (o dono da loja
e o pai dele). Uma única senha compartilhada, configurada uma vez
(`setup()` gera e imprime uma no log de execução). Quem faz login também
digita um nome — não é uma conta separada, só identifica o "actor" no
`AuditLog` (ex.: "Victor", "Pai").

Sessão: um token assinado (`base64url(JSON{name,iat,exp})` +
`base64url(HMAC-SHA256(...))`, ver `gas/Auth.js`) guardado no
`localStorage` do navegador — sem sessão armazenada no servidor, cada
chamada é verificada de novo. Expira em 30 dias; expirando, o app volta para
a tela de login.

Uma segunda credencial, **`ADMIN_SECRET`**, existe só para automação (o
script de carga da migração, `scripts/migration/load-ledger.ts`) — nunca é
a senha que uma pessoa digita, e nunca deve ir para uma variável `VITE_`
(essas são embutidas no bundle do frontend, logo públicas).

## Invariantes sem banco relacional

Cada garantia que antes era uma constraint/trigger do Postgres agora é
imposta em código, em `gas/Logic.js`:

- **"sold" só pelo caminho oficial** — `updateVehicle_` nem recebe `status`
  como parâmetro; só `registerSale_`/`cancelSale_`/`createInitialInventory_`
  escrevem nessa coluna, cada um com sua própria regra validada.
- **Placa única entre veículos ativos** — `assertPlateAvailable_` varre
  `Vehicles` antes de criar/editar. `cancelSale_` reprovisiona essa mesma
  checagem antes de reativar um veículo, para não colidir com uma placa que
  um veículo novo já reivindicou.
- **Uma venda ativa por veículo** — checado antes de inserir (segunda linha
  de defesa; o check de `status='available'` já deveria impedir isso).
- **Proveniência da migração** — `decideInventoryCandidate_`/`decideSale_`
  só escrevem nas colunas de overlay (`confirmed_*`, `review_*`), nunca nas
  colunas originais (`*_raw`, `parsed_*`).
- **Concorrência** — todo `doPost` roda dentro de
  `LockService.getScriptLock()` (Router.js), serializando escritas. No
  volume esperado o custo é irrelevante; existe para nunca deixar duas
  escritas simultâneas na mesma aba se corromperem.
- **Atomicidade parcial, um risco aceito conscientemente** — Sheets não tem
  transação real. `cancelSale_` checa o conflito de placa *antes* de
  escrever qualquer coisa (para nunca abortar no meio), mas as duas escritas
  que seguem (cancelar a venda, reverter o veículo) não são atômicas entre
  si — uma falha exatamente entre as duas deixaria estado parcial. Dado que
  ambas acontecem em sequência síncrona dentro da mesma invocação (sem
  round-trip de rede no meio) e sob o lock do script, a janela de risco é
  desprezível no volume esperado. Documentado aqui em vez de resolvido com
  mais complexidade — ver GO_LIVE_CHECKLIST.md.

## Comissão

Sem regra assumida em lugar nenhum do código. `Sales.commission_amount`/
`commission_percentage` ficam nulos até serem preenchidos manualmente;
`AppSettings.default_commission_pct` é só uma sugestão de preenchimento no
formulário de venda, nunca aplicada sozinha. Uma regra de cálculo automática
de verdade fica para quando o usuário real definir como o pagamento
funciona hoje.

## Deploy do backend

Não é possível provisionar um projeto Apps Script/Web App autonomamente
neste ambiente — a criação e o primeiro deploy exigem o editor
script.google.com (ou a Apps Script API, que pede OAuth interativo,
igualmente indisponível aqui). Passos, uma única vez:

1. script.google.com → Novo projeto.
2. Criar 4 arquivos de script (mesmos nomes) e colar o conteúdo de
   `gas/Store.js`, `gas/Auth.js`, `gas/Logic.js`, `gas/Router.js`.
3. No `appsscript.json` do projeto (⚙️ Configurações do projeto → "Mostrar
   arquivo de manifesto"), colar o conteúdo de `gas/appsscript.json`.
4. Selecionar a função `setup` no seletor de funções e clicar Executar —
   autorizar o pedido de permissão (acesso a Planilhas, próprio do Apps
   Script, não um app OAuth de terceiros). Ver o log de execução (Ver →
   Registros) para a senha de login e o `ADMIN_SECRET` gerados.
5. Implantar → Nova implantação → tipo "App da Web" → executar como "Eu",
   acesso "Qualquer pessoa" → Implantar. Copiar a URL.
6. `VITE_APPS_SCRIPT_URL=<url>` no `.env` do frontend (e nas variáveis de
   ambiente do Vercel, se aplicável).

Depois disso, tudo o mais (carregar a planilha antiga, testar os fluxos,
fazer deploy do frontend) não exige nova autorização humana.

## Testando o backend

`gas/__tests__/logic.test.ts` roda os arquivos reais de `gas/*.js` — os
mesmos que vão colados no editor — dentro de um `vm` do Node
(`gas/__tests__/gasHarness.ts`), com mocks em memória de
`SpreadsheetApp`/`PropertiesService`/`Utilities`/`LockService`. Cobre os
mesmos casos que as antigas asserções do Postgres cobriam: guarda de venda,
placa única, proveniência, idempotência da carga inicial de estoque, etc.
`npm run test` roda isso junto com o resto da suíte Vitest.

## PWA

`vite-plugin-pwa` com `generateSW`, precache do app shell
(`**/*.{js,css,html,svg,png}`). Ícones em `public/icons/` são
**placeholders** (monograma "P"), pendentes de arte de marca de verdade —
decisão do usuário, não algo para inventar. Manifest em `pt-BR`,
`display: standalone`.

## Bundle

Build de produção gera um único chunk JS de ~350-400 kB — bem menor que na
era Supabase, já que `@supabase/supabase-js` (que incluía auth, realtime,
storage, functions e postgrest) saiu por completo; o cliente HTTP do
backend agora é um `fetch` de poucas linhas.

## Decisões difíceis de mudar depois

1. `Vehicles.id` como identidade (não a placa) — baixo risco, mas caro de
   reverter depois que `Sales`/`AuditLog` referenciarem amplamente.
2. Proveniência ancorada em `VehicleOccurrences` em vez de uma aba
   genérica — reversível, mas toca todo o rastreamento histórico.
3. `Vehicles` ainda aceita `INSERT`/`UPDATE` direto de qualquer chamada
   autenticada por trás de `updateVehicle_`/`createVehicle_` (o app só usa
   essas duas ações, que auditam tudo) — não há uma segunda camada
   impedindo alguém de escrever direto na planilha por fora do app. Aceitável
   com uso pessoal e planilha não compartilhada; documentado como dívida
   técnica de baixo risco, não um bloqueio.
4. Uma senha compartilhada em vez de contas por pessoa — o item mais
   provável de precisar mudar se o negócio crescer para múltiplos
   vendedores com necessidade de identidade individual real (hoje o "nome"
   no login é auto-declarado, não verificado).
