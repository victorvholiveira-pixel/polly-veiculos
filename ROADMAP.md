# Roadmap

## P0 — Operação principal (Estoque → Venda → Comissão → Histórico)

- [x] **Onda 1 — Foundation**: scaffold, schema do banco (Supabase),
      autenticação, shell de navegação mobile, PWA básico. *(concluída)*
- [x] **Onda 2 — Migration Pipeline (dry-run)**: parser posicional por era de
      layout, classificação de qualidade, deduplicação conservadora com fila
      de revisão humana, relatório de migração. Sem carga em produção.
      *(concluída)*
- [x] **Onda 3 — Cutover parcial + Estoque**: Central de Revisão da migração
      (estoque candidato, conflitos, vendas ambíguas, demais itens), ação
      explícita "Criar estoque inicial", Estoque real (listar, buscar,
      editar, ver, cadastrar). Fecha a pendência de segurança de vendas via
      UPDATE direto. *(concluída)*
- [x] **Onda 4 — Venda + cancelamento + histórico operacional**: fluxo
      transacional de registrar/cancelar venda, fluxo "Vender" (escolher
      veículo → formulário → confirmar), tela de Histórico real (vendas do
      app, busca, cancelamento com motivo obrigatório). Comissão fica manual
      por venda — nenhuma regra automática foi inventada (ver "Comissão"
      abaixo). *(concluída)*
- [x] **Onda 5 — Dashboard + Comissão configurável + acabamento**: painel
      Início com os 6 indicadores, comissão padrão configurável (Mais →
      Configurações, sempre editável por venda), revisão de UX/copy em todo
      o app. *(concluída)*
- [x] **Onda 6 — Auditoria, exportação e fechamento**: exportação de dados
      (CSV/JSON de estoque e histórico), trilha de auditoria visível em
      Mais → Auditoria, cadastro/edição de veículo passa a ser sempre
      auditado (lacuna real fechada). *(concluída)*
- [x] **Onda 7 — Detour: backend Google Apps Script + Sheets** *(implementada
      e testada, depois abandonada por decisão do usuário — voltar a uma
      base técnica de aplicação real em vez de planilha como banco de
      produção; nada dessa onda continua em uso, ver `ARCHITECTURE.md`)*.
- [x] **Onda 8 — Retorno definitivo ao Supabase**: schema/RLS/RPCs das
      Ondas 1–6 restaurados (já representavam o mínimo necessário — ver
      `ARCHITECTURE.md`, "Por que restaurar em vez de reconstruir"),
      apontados para o projeto definitivo `xzcuhrdhccnforqkovof`. Frontend
      inalterado. *(concluída — falta só aplicar as migrations contra o
      projeto real, bloqueado por política de rede deste ambiente, não por
      credencial — ver `GO_LIVE_CHECKLIST.md`)*
- [x] **Onda 9 — Dashboard executivo (Início)**: painel reestruturado com
      KPIs principais e secundários, gráfico de vendas dos últimos 6 meses
      (SVG/CSS simples, sem lib de gráficos), estoque envelhecido (+30/+60
      dias), destaques do período, últimas movimentações (via `audit_log`) e
      comparação com o mês anterior quando há base real. Tudo a partir de
      `vehicles`/`sales`/`audit_log` — nenhuma tabela ou view nova. Corrigido
      no caminho: `update_vehicle` zerava `entry_date` silenciosamente por
      nunca reenviá-lo — agora o formulário de veículo tem o campo e o RPC
      sempre recebe o valor atual. *(concluída)*
- [x] **Onda 10 — Histórico de vendas mensal + vendas legadas**: o card de
      performance da Home virou um módulo "Histórico de vendas" completo —
      período selecionável (6/12/24 meses, Tudo, ano específico quando há
      mais de um ano de dado), toggle quantidade/valor, detalhe por mês ao
      tocar a barra (vendas, faturamento, ticket médio, comissão conhecida),
      resumo do período com comparação ao período anterior quando há base
      real, melhor/pior mês, médias mensais. Nenhum mês fora do intervalo
      real selecionado é inventado.

      Habilitado por uma importação segura das vendas históricas da
      planilha: 542 das 602 ocorrências `sale_classification='sale_detected'`
      (alta confiança) tinham data e valor — os únicos dois campos
      obrigatórios de `sales` — e viraram vendas reais com
      `origin='migration'`; as outras 60 (58 sem valor registrado, 2 com
      data futura por erro de digitação na planilha original) ficaram de
      fora, para revisão manual, sem inventar nada. `sales.vehicle_id` virou
      opcional e uma venda legada nunca ganha um veículo placeholder — ver
      `ARCHITECTURE.md`, "sales.origin", e `MIGRATION.md` para a auditoria
      completa. *(concluída — executada contra o projeto real na Onda 11:
      542 vendas legadas confirmadas em produção, ver abaixo)*
- [x] **Onda 11 — Deploy automático (schema + dados)**: fim da dependência
      de SQL Editor manual ou clique em "Run workflow" para operação normal.
      `.github/workflows/supabase-deploy.yml` dispara sozinho a cada push em
      `main` que altere `supabase/migrations/**` ou
      `supabase/data-migrations/**` — aplica migrations pendentes (ledger
      oficial da CLI), roda health check, aplica data-migrations pendentes
      (novo padrão permanente, ledger próprio em `public._data_migrations`
      com checagem de checksum) e publica um Job Summary. Fluxo novo:
      implementa → `npm run db:validate` local → commita/pusha em `main` →
      CI aplica e valida contra o projeto real. `workflow_dispatch`
      continua como escape hatch manual (`deploy`/`validate-only`), não como
      caminho principal. Ver `ARCHITECTURE.md`, "Data migrations", e
      README.md, "Deploy automático contra o projeto real". *(concluída e
      exercida de verdade contra `xzcuhrdhccnforqkovof`: as 19 migrations
      sincronizadas e as 542 vendas legadas importadas em produção — a
      primeira execução real também encontrou e corrigiu dois problemas de
      infraestrutura só visíveis contra o projeto de verdade (IPv6 do
      Session Pooler, ledger da CLI vazio apesar do schema já existir) —
      ver ARCHITECTURE.md)*
- [x] **Onda 12 — Estoque no nível da Home**: redesenho completo da página
      Estoque, com exploração prévia no Figma (3 direções mobile-first
      comparadas; direção "Denso por dados" escolhida — hero em card único,
      filtro+ordenação compactos, cards de 3 linhas com preço em destaque).
      Resumo executivo (veículos, valor total, ticket médio, idade média,
      +30/+60 dias — reaproveitando `computeAging` da Home, sem duas contas
      divergentes para o mesmo número), busca instantânea, chips de filtro
      (Todos/Disponíveis/Reservados/+30/+60, escondidos quando a contagem é
      zero), ordenação por bottom sheet (`Card`/`Badge`/`Skeleton`/`ActionSheet`
      extraídos para `src/components/ui/` — a Home também passou a usar os
      mesmos primitivos, sem duplicar), card redesenhado (marca/modelo/versão,
      ano·placa, preço, status + dias em estoque coloridos por severidade,
      data de entrada — nunca uma idade inventada), ação principal (tocar =
      ver detalhes) e menu contextual para Editar/Vender. Avaliada e
      descartada a visão compacta/detalhada separada — o card único já
      resolve densidade sem duplicar código de renderização. Detalhe do
      veículo harmonizado (mesmo `Card`, dias em estoque, entrada). Testado
      com dados reais rodando no navegador (Playwright contra o build de
      produção, sessão simulada — este ambiente não alcança o Supabase real),
      não só mocks do Figma.

### Endurecimento futuro (não bloqueia Go-Live)

`vehicles` ainda aceita INSERT/UPDATE direto de `authenticated` via RLS
(modelo de "equipe confiável"); o app usa as RPCs auditadas
`create_vehicle`/`update_vehicle`, mas o caminho direto continua
tecnicamente aberto. Aceitável com uso pessoal — ver "Decisões difíceis de
mudar depois" em `ARCHITECTURE.md`.

### Comissão

Nenhuma fórmula de comissão foi inventada. `app_settings.default_commission_pct`
guarda um percentual padrão opcional (configurável em Mais → Configurações),
usado apenas como sugestão de preenchimento no formulário de venda — sempre
editável e nunca aplicado automaticamente sem confirmação humana. Uma regra
de cálculo automática de verdade (por vendedor, por faixa de valor, etc.)
fica para quando o usuário real definir como o pagamento funciona hoje.

## P1 — Produtividade

- [x] Exportação de dados (CSV/JSON) — "os dados pertencem à loja".
- [x] Ícone do app (Onda 13) — monograma "P" desenhado (não mais fonte de
      sistema), com acento `emerald-500`; `icon-192`/`icon-512`/
      `icon-512-maskable`/`apple-touch-icon` gerados a partir do
      `favicon.svg`. Segue como P1: ícones ainda não são a identidade visual
      final da marca (isso é decisão do usuário, não algo para inventar) —
      só deixou de ser o "P" cru de fonte de sistema.
- Melhorias de busca/filtro no Estoque e Histórico além do básico.
- Ferramenta de merge manual de veículos (para os casos que a migração
  colocar em revisão e forem, de fato, o mesmo carro).

## P2 — Inteligência

- [x] Ticket médio, dias médios em estoque, histórico mensal/anual de vendas
      e faturamento — entregues na Home (Onda 9/10).
- Veículos mais antigos além do top 5 já mostrado em "Estoque envelhecido".

## P3 — Integrações

- Nada disto entra antes do P0 estar estável e íntegro:
  CRM completo, marketplace, sistema financeiro, DMS/ERP, gestão fiscal,
  financiamento, integração FIPE, WhatsApp, IA, gestão de leads.
