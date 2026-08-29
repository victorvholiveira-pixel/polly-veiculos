# Arquitetura

Este documento registra as decisões de arquitetura aprovadas (FASE 0.5) e como
elas foram implementadas na Onda 1. Para o contrato completo de schema, ver os
arquivos em `supabase/migrations/` — eles são a fonte de verdade; este
documento explica o *porquê*.

## Visão geral

```
React + TS + Vite + Tailwind  →  Supabase (Postgres + Auth + RLS)
        (frontend)                      (único backend)
```

Sem servidor próprio. Sem Edge Functions ainda (ver "Venda: RPC em vez de
Edge Function" abaixo). Um único cliente Supabase centralizado
(`src/lib/supabase.ts`) — nenhuma outra parte do código deve chamar
`createClient` diretamente.

## Banco de dados

Sete tabelas, todas com RLS habilitado desde a migration que as cria (nunca
existe uma janela onde uma tabela operacional fica exposta sem RLS):

- `vehicles` — identidade canônica do veículo real. `id` (uuid) é a única
  identidade que outras tabelas referenciam; a placa é um atributo, nunca uma
  identidade (pode ser corrigida sem afetar `vehicles.id`).
- `vehicle_occurrences` — ledger imutável de cada linha da planilha migrada.
  Também *é* o modelo de provenance (ver abaixo) — não existe uma tabela
  genérica `migration_provenance` separada.
- `vehicle_match_candidates` — fila de revisão para ocorrências que a
  migração não conseguiu resolver com confiança.
- `sellers`, `sales`, `app_settings`, `audit_log`.

Detalhes completos (tipos, constraints, índices, políticas de RLS) estão
comentados diretamente em cada arquivo de migration.

### Por que não existe uma tabela `migration_provenance` genérica

A proveniência de cada registro migrado vive em `vehicle_occurrences`, que já
carrega `source_sheet`/`source_row`/`original_payload` — ela *é* o registro de
origem, por definição. `vehicles.founding_occurrence_id` e
`sales.source_occurrence_id` apontam para lá. Duplicar essas colunas em uma
segunda tabela genérica violaria single-source-of-truth sem ganhar nada.

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
quando há dúvida** (falso negativo de deduplicação é preferível a um falso
positivo). Detalhe completo em `MIGRATION.md`.

## Segurança / RLS

Modelo de confiança adotado: **qualquer usuário autenticado é staff da loja**
com acesso completo às tabelas operacionais (não há hoje diferenciação de
papel entre vendedores). Isso é uma decisão consciente, não um descuido — é
o item mais provável de precisar mudar se o negócio crescer para múltiplos
vendedores com visibilidade restrita entre si.

Dentro desse modelo, ainda há fronteiras reais:

- `sales`, `audit_log` e `vehicle_occurrences`/`vehicle_match_candidates` têm
  **política de leitura para `authenticated`, mas nenhuma política de escrita
  direta**. Ninguém insere uma venda ou uma linha de auditoria direto na
  tabela — apenas funções `SECURITY DEFINER` (RPCs) ou o pipeline de migração
  (rodando com `service_role`, nunca no frontend) escrevem ali. Isso é testado
  automaticamente — ver "Validação das migrations" abaixo.
- `vehicles` permite `UPDATE` direto por qualquer autenticado, inclusive do
  campo `status`. Isso é uma fronteira "soft", não imposta em nível de banco:
  o app deve sempre passar pela RPC de venda para a transição para `sold`,
  mas hoje nada no banco impede um `UPDATE` direto contornando isso. Aceitável
  com um único usuário de confiança; revisar se isso mudar.
- Nenhuma tabela tem política de `DELETE` para `authenticated` — exclusão
  sempre é soft (`status='cancelled'`, `active=false`), nunca `DELETE`.
- A `service_role key` nunca aparece em código de frontend nem em `.env*`
  versionado — apenas a `anon key` pública, que só concede o que as policies
  de RLS permitirem.

## Venda: RPC em vez de Edge Function

Decisão aprovada na FASE 0.5, ainda não implementada nesta onda (Onda 1 é
schema/RLS/auth/shell — a RPC de venda chega na onda que implementar o fluxo
"Vender"). Registrando o motivo aqui para não se perder:

Uma função Postgres (`SECURITY DEFINER`) consegue, numa única transação:
travar a linha do veículo (`FOR UPDATE`), inserir a venda, atualizar o status
do veículo e gravar o `audit_log` — atomicamente, sem round-trip de rede
adicional. Uma Edge Function só se justificaria se o fluxo precisasse chamar
algo *fora* do Postgres (gateway de pagamento, API de financiamento) — nada
disso está no escopo atual. Se isso mudar, dá para envolver a mesma RPC numa
Edge Function depois sem alterar o schema.

## Comissão

Sem regra assumida em lugar nenhum do código ou do banco.
`sales.commission_amount`/`commission_percentage` ficam nulos até serem
preenchidos manualmente; `commission_rule_snapshot` (jsonb) existe para,
quando uma regra for definida com o usuário real, congelar os parâmetros
vigentes por venda — uma mudança de regra no futuro nunca deve recalcular
comissões passadas.

## PWA

`vite-plugin-pwa` com `generateSW`, precache apenas do app shell
(`**/*.{js,css,html,svg}` — sem cache agressivo de dados/API). Ícones em
`public/icons/` são **placeholders** (monograma "P"), pendentes de assets
oficiais. Manifest em `pt-BR`, `display: standalone`, cores combinando com o
tema da tela de login.

## Validação das migrations sem Docker

O ambiente onde a Onda 1 foi construída não tinha acesso a Docker (necessário
para `supabase start`, o dev stack local oficial da Supabase). Para ainda
assim validar as migrations de verdade, `scripts/db/validate-migrations.sh`:

1. Sobe um Postgres 16 local descartável (via `initdb`/`pg_ctl`, sem Docker).
2. Aplica `scripts/db/stub-auth.sql` — um stub mínimo do schema `auth` e das
   roles `anon`/`authenticated`/`service_role` que um projeto Supabase real
   já fornece, só para permitir que as migrations (que referenciam
   `auth.users`/`auth.uid()`) rodem.
3. Aplica todos os arquivos de `supabase/migrations/` em ordem.
4. Roda `scripts/db/assertions.sql` — testa constraints, unique indexes e o
   comportamento de RLS por papel (anon vs. authenticated) com inserts reais,
   não apenas leitura do SQL.

Isso é um **substituto**, não uma validação equivalente a rodar contra um
projeto Supabase real — sempre validar de novo contra o projeto real antes de
qualquer ida a produção (ver `GO_LIVE_CHECKLIST.md`).

## Bundle

O build de produção da Onda 1 gera um único chunk JS de ~500 kB
(~146 kB gzip) — React 19 + React Router + o SDK completo do
`@supabase/supabase-js` (que inclui auth, realtime, storage, functions e
postgrest mesmo só usando auth hoje). Vite avisa sobre o tamanho (limite
padrão de 500 kB por chunk). Não vale otimizar prematuramente numa fundação
com cinco telas-placeholder; quando as features reais forem entrando,
considerar `React.lazy` por rota como primeiro passo.

## Decisões difíceis de mudar depois (herdadas da FASE 0.5)

Ver a lista completa na revisão de arquitetura aprovada; os itens mais
relevantes para quem for mexer no schema:

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
