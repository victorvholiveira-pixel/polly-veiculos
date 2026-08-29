# Arquitetura

Este documento registra as decisões de arquitetura aprovadas e como elas
foram implementadas. Para o contrato completo de schema, ver os arquivos em
`supabase/migrations/` — eles são a fonte de verdade; este documento explica
o *porquê*.

## Histórico de arquitetura

O Polly passou por três decisões de backend:

1. **Ondas 1–6**: Supabase (Postgres + Auth + RLS).
2. **Onda 7**: trocado por Google Apps Script + Google Sheets, na ausência
   de um projeto Supabase acessível. Funcionou (backend testado, 20 testes
   passando), mas essa direção foi abandonada — decisão do usuário de manter
   uma base técnica de aplicação real (frontend próprio + backend/banco
   reais), não uma planilha como banco de produção.
3. **Onda 8 (atual e definitiva)**: volta ao Supabase, com o schema/RLS/RPCs
   deliberadamente mais enxutos do que a versão original das Ondas 1–6 tinha
   se tornado — ver "Por que restaurar em vez de reconstruir do zero"
   abaixo.

Nada do trabalho de Apps Script continua em uso — `gas/` foi removido. O que
sobreviveu da Onda 7: a normalização de nomenclatura e alguns ajustes de
precisão de copy/documentação, já incorporados abaixo.

## Visão geral

```
React + TS + Vite + Tailwind  →  Supabase (Postgres + Auth + RLS)
        (frontend)                      (único backend)
```

Sem servidor próprio. Um único cliente Supabase centralizado
(`src/lib/supabase.ts`) — nenhuma outra parte do código deve chamar
`createClient` diretamente.

## Projeto Supabase definitivo

- **Project ref**: `xzcuhrdhccnforqkovof`
- **Project URL**: `https://xzcuhrdhccnforqkovof.supabase.co`

Este é o projeto de produção — não criar outro, não mudar de região. Ver
"Bloqueio de acesso real" abaixo para o estado atual de conectividade.

## Por que restaurar em vez de reconstruir do zero

O schema das Ondas 1–6 (`supabase/migrations/`, 17 arquivos) já representa
corretamente o modelo mínimo necessário — cada migration tem uma
responsabilidade única e nenhuma foi motivada por complexidade
especulativa:

- **5 tabelas operacionais** (`vehicles`, `sales`, `sellers`, `app_settings`,
  `audit_log`) mais **3 tabelas só de migração** (`vehicle_occurrences`,
  `vehicle_match_candidates`, `migration_import_batches`) — necessárias para
  a Central de Revisão que o produto já tem (estoque candidato, conflitos,
  vendas ambíguas, demais itens) e que precisava ser preservada.
- **5 funções `SECURITY DEFINER`** (`register_sale`, `cancel_sale`,
  `create_initial_inventory`, `create_vehicle`, `update_vehicle`) — uma por
  operação que precisa de mais de uma escrita atômica ou de auditoria
  automática. Não há RPC para operações simples de leitura.
- **RLS de duas camadas** (`anon` sem acesso nenhum, `authenticated` com
  acesso completo às tabelas operacionais) — sem roles customizadas, sem
  políticas por linha, sem multiempresa. É o modelo "equipe confiável": todo
  usuário autenticado é staff da loja.

Reconstruir isso do zero, mais simples, arriscaria perder garantias já
testadas (guarda de "sold", placa única, proveniência da migração) sem
ganho real — o schema já era enxuto para o que o produto precisa. Por isso
a Onda 8 restaura essas migrations tal como estavam (via histórico do git,
não reescritas), em vez de redesenhar.

## Banco de dados

Sete tabelas, todas com RLS habilitado desde a migration que as cria:

- `vehicles` — identidade canônica do veículo real. `id` (uuid) é a única
  identidade que outras tabelas referenciam; a placa é um atributo, nunca uma
  identidade (pode ser corrigida sem afetar `vehicles.id`).
- `vehicle_occurrences` — ledger imutável de cada linha da planilha migrada.
  Também *é* o modelo de provenance — não existe uma tabela genérica
  `migration_provenance` separada.
- `vehicle_match_candidates` — fila de revisão para ocorrências que a
  migração não conseguiu resolver com confiança.
- `sellers`, `sales`, `app_settings`, `audit_log`.

Detalhes completos (tipos, constraints, índices, políticas de RLS) estão
comentados diretamente em cada arquivo de migration.

### Identidade vs. deduplicação (resumo)

Três conceitos, nunca confundidos:

1. **Identidade do registro de origem** — `(source_sheet, source_row)`,
   natural key de `vehicle_occurrences`. Determinística, imutável.
2. **Identidade do veículo real** — `vehicles.id` (uuid surrogate).
3. **Ocorrência mensal** — cada linha de `vehicle_occurrences`; um mesmo
   veículo normalmente tem várias.

A migração (Onda 2) resolve identidade com uma estratégia hierárquica
conservadora — placa exata + continuidade de mês > atributos combinados sem
ambiguidade > revisão humana — e **nunca funde dois veículos automaticamente
quando há dúvida**. Detalhe completo em `MIGRATION.md`.

### `sales.origin` — venda do app vs. venda histórica (Onda 10)

`sales.vehicle_id` é opcional desde a Onda 10, e uma nova coluna `origin`
('app' | 'migration') diz por quê:

- **`origin='app'`** — sempre tem `vehicle_id` real (um veículo cadastrado
  no sistema). Único caso possível antes da Onda 10; `register_sale`
  continua funcionando exatamente igual, sem nenhuma mudança na RPC — o
  default da coluna (`'app'`) resolve isso sozinho.
- **`origin='migration'`** — uma venda da planilha antiga, de antes do
  Go-Live, para a qual **nunca existiu e nunca vai existir** um `vehicles`
  correspondente (o carro pode já nem estar mais na loja). Nunca tem
  `vehicle_id` — em vez disso, sempre tem `source_occurrence_id`, apontando
  para a linha original em `vehicle_occurrences`, de onde marca/modelo/placa
  são lidos sob demanda (join client-side, ver `sales.ts`/`dashboard.ts`).
  Nenhum veículo-placeholder é criado só para satisfazer uma FK — seria um
  cutover de identidade disfarçado, o mesmo motivo que já impede carregar
  `vehicle_match_candidates` (ver "Por que restaurar" acima).

Duas constraints garantem que uma venda nunca fica em um estado ambíguo:
`sales_app_requires_vehicle` (origin='app' → vehicle_id obrigatório) e
`sales_migration_requires_occurrence` (origin='migration' →
source_occurrence_id obrigatório) — nunca os dois, nunca nenhum dos dois.
`sales_source_occurrence_uk` (unique) é o que torna o importador idempotente:
rodar `artifacts/migration/import_legacy_sales.sql` mais de uma vez nunca
duplica uma venda.

`sales_one_active_per_vehicle_uk` (índice único parcial em `vehicle_id`)
não precisou mudar — Postgres nunca considera dois `NULL` iguais num índice
único, então várias vendas legadas com `vehicle_id=null` nunca colidem entre
si nem com vendas reais do app.

## Segurança / RLS

Modelo de confiança: **qualquer usuário autenticado é staff da loja** com
acesso completo às tabelas operacionais. Decisão consciente para um app
pessoal de baixo volume, não um descuido.

- `sales`, `audit_log`, `vehicle_occurrences`/`vehicle_match_candidates` têm
  **leitura para `authenticated`, sem escrita direta** — só funções
  `SECURITY DEFINER` (ou o pipeline de migração com `service_role`) escrevem
  ali. Testado em `scripts/db/assertions.sql`.
- `vehicles` permite `UPDATE`/`INSERT` direto por qualquer autenticado — mas
  a transição para `status='sold'` é bloqueada por trigger
  (`vehicles_guard_sold_transition`) a menos que a sessão opte
  explicitamente (`app.allow_sold_transition`), o que só `register_sale`/
  `cancel_sale`/`create_initial_inventory` fazem. `create_vehicle`/
  `update_vehicle` (RPCs) são o caminho usado pelo app para sempre gerar
  auditoria; o caminho de tabela direta continua tecnicamente aberto —
  aceitável com uso pessoal, ver "Decisões difíceis de mudar depois".
- Nenhuma tabela tem política de `DELETE` para `authenticated` — exclusão
  sempre é soft (`status='cancelled'`, `active=false`).
- A `service_role key` nunca aparece em código de frontend nem em `.env*`
  versionado — apenas a `anon key` (agora chamada "publishable key" na
  documentação do Supabase) pública, que só concede o que RLS permitir.

## Auth

Login simples por e-mail/senha via Supabase Auth — sem cadastro público
(nenhuma tela de signup no app), sem recuperação de senha própria, sem
papéis, sem multiusuário. O primeiro (e único, hoje) usuário é criado
manualmente no painel do Supabase (Authentication → Users), não pelo app.
Isso é a peça mais simples que já se integra nativamente com o RLS baseado
em `authenticated` — não precisa de mecanismo próprio de senha/token.

## Venda e cancelamento: RPC em vez de múltiplas escritas do cliente

`register_sale`/`cancel_sale` (funções `SECURITY DEFINER`) travam a linha do
veículo (`FOR UPDATE`), fazem a escrita em `sales`, atualizam o status do
veículo e gravam `audit_log` — atomicamente, numa única chamada. Evita que o
frontend precise orquestrar múltiplas escritas (e evita um estado
inconsistente se uma delas falhar no meio).

## Comissão

Sem regra assumida em lugar nenhum do código ou do banco.
`sales.commission_amount`/`commission_percentage` ficam nulos até serem
preenchidos manualmente; `app_settings.default_commission_pct` é só uma
sugestão de preenchimento, nunca aplicada sozinha.

## PWA

`vite-plugin-pwa` com `generateSW`, precache do app shell
(`**/*.{js,css,html,svg,png}`). Ícones em `public/icons/` são
**placeholders** (monograma "P"), pendentes de assets oficiais — decisão do
usuário, não algo para inventar. Manifest em `pt-BR`, `display: standalone`.

## Bloqueio de acesso real ao Supabase

Confirmado repetidamente, incluindo nesta onda: este ambiente **não
consegue alcançar `api.supabase.com` nem `*.supabase.co` na rede** — o
proxy de saída rejeita a conexão por política da organização (mesmo
resultado para `vercel.com`, `example.com` e outros domínios fora de uma
lista pequena permitida: registro npm, GitHub, PyPI, API da Anthropic). Não
é uma questão de falta de credencial — mesmo com uma `service_role key` em
mãos, não haveria como completar a chamada de rede daqui. Isso é diferente
do bloqueio original das Ondas 1/3/6 (que era só falta de credencial/CLI
autenticada) — é um bloqueio de rede do ambiente de execução, então só pode
ser resolvido rodando as migrations/testes de fora deste ambiente (a
própria máquina do usuário, ou CI do GitHub).

## Validação das migrations sem Docker

`scripts/db/validate-migrations.sh`:

1. Sobe um Postgres 16 local descartável (via `initdb`/`pg_ctl`, sem Docker).
2. Aplica `scripts/db/stub-auth.sql` — um stub mínimo do schema `auth` e das
   roles `anon`/`authenticated`/`service_role` que um projeto Supabase real
   já fornece.
3. Aplica todos os arquivos de `supabase/migrations/` em ordem.
4. Roda `scripts/db/assertions.sql` — 27 asserções testando constraints,
   RLS por papel e o comportamento das 5 RPCs com inserts reais.

Isso é um **substituto**, não uma validação equivalente a rodar contra um
projeto Supabase real — sempre validar de novo contra o projeto real antes
de qualquer ida a produção (ver `GO_LIVE_CHECKLIST.md`).

## Bundle

Build de produção gera um único chunk JS de ~560 kB (~158 kB gzip) — React
19 + React Router + o SDK completo do `@supabase/supabase-js`. Vite avisa
sobre o tamanho (limite padrão de 500 kB por chunk). Não vale otimizar
prematuramente; `React.lazy` por rota é o primeiro passo natural se isso
incomodar depois.

## Decisões difíceis de mudar depois

1. `vehicles.id` como identidade (não a placa) — baixo risco, mas caro de
   reverter depois que `sales`/`audit_log` referenciarem amplamente.
2. Proveniência ancorada em `vehicle_occurrences` em vez de uma tabela
   genérica — reversível via migration, mas toca todo o rastreamento
   histórico.
3. Índices únicos parciais (uma placa ativa por vez, uma venda ativa por
   veículo) — assumem "um lote, um item por vez"; motivam repensar se o
   negócio crescer para múltiplas lojas/consignação.
4. Postura de RLS "qualquer autenticado é staff completo" — o item de maior
   risco se o negócio escalar para múltiplos vendedores com visibilidade
   restrita entre si.
5. `vehicles` ainda aceita `INSERT`/`UPDATE` direto de `authenticated` além
   das RPCs auditadas — dívida técnica de baixo risco, não bloqueia
   lançamento (ver GO_LIVE_CHECKLIST.md).
