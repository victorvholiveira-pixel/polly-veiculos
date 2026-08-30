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
- [x] **Onda 14 — PWA auto-update + detalhe de venda**: resolve o problema
      real de usuário ficar preso numa versão antiga (relatado em produção) e
      torna vendas clicáveis.

      *Auto-update*: registro do service worker passou de `injectRegister:
      'auto'` (zero controle) para manual via `virtual:pwa-register/react`
      (`src/lib/pwa/useAppUpdate.ts`), com `registerType: 'autoUpdate'` +
      `skipWaiting`/`clientsClaim`/`cleanupOutdatedCaches` explícitos no
      workbox (antes implícitos só quando `injectRegister: 'auto'` — ver
      `node_modules/vite-plugin-pwa/dist/index.js`). Navegação (HTML) saiu do
      precache — `navigateFallback` desligado de propósito, porque
      `workbox-build` só registra a `NavigationRoute` (cache-first de fato)
      quando ele existe (ver `workbox-build/build/templates/sw-template.js`)
      — e passou a usar uma regra `runtimeCaching` própria com `NetworkFirst`
      (`cacheName: 'polly-pages'`, timeout de 3s), confirmada no
      `dist/sw.js` gerado. Assets versionados (hash do Vite) continuam
      precache agressivo, sem risco de staleness. Checagem de atualização é
      só por evento — ao registrar, ao voltar o app pro primeiro plano
      (`visibilitychange`), com foco (`focus`) e ao voltar a ficar online
      (`online`) — nunca por intervalo. Proteção contra reload loop
      (`src/lib/pwa/reloadGuard.ts`, testado isoladamente): um reload já
      disparado nos últimos 10s bloqueia o próximo. Toast discreto "Polly
      atualizado ✓" depois de um reload controlado (nunca o mecanismo
      principal — não existe botão manual). Versão/build (Git SHA via
      `VERCEL_GIT_COMMIT_SHA` no build da Vercel, com fallback pro
      `git rev-parse` local) visível em Mais → Sobre, para diagnóstico.

      *Detalhe de venda*: `SaleDetailsSheet` (bottom sheet, mobile-first) é o
      único componente de detalhe de venda do app — aberto a partir de
      Histórico e de "Últimas movimentações" na Home, sem duplicar
      implementação. Busca os próprios dados sob demanda
      (`fetchSaleDetail`, uma query pequena por abertura — as listas
      continuam leves, sem N+1). `origin='app'` usa `vehicle_id` e dado real
      de `vehicles`; `origin='migration'` hidrata de `vehicle_occurrences`
      via `source_occurrence_id`, nunca cria veículo placeholder, e mostra
      "Histórico importado" discretamente. Ações no rodapé: "Ver veículo" e
      "Cancelar venda" (reaproveitando `cancel_sale`) só para venda
      `origin='app'` ativa; venda de migração é sempre somente leitura. Nenhum
      campo ausente é inventado — omitido, ou "Não informada" só para
      comissão, onde saber que é desconhecida importa. `RecentActivity`
      ganhou `saleId` (de `audit_log.entity_id`, que `register_sale`/
      `cancel_sale` já gravam como o id real da venda — nenhuma coluna nova),
      permitindo que "Últimas movimentações" abra a mesma sheet sem uma
      segunda tabela ou view.

      Nenhuma migration de schema — tudo já suportado pelas colunas
      existentes de `sales`/`vehicle_occurrences`/`audit_log`.
- [x] **Onda 15 — Vendidos dentro de Estoque**: a experiência principal de
      Estoque (`StockListPage`) ganhou um alternador "Em estoque" / "Vendidos"
      no topo — mesma tela, sem rota nova nem componente paralelo. As duas
      visões ficam sempre montadas (só uma escondida via `hidden`), então
      trocar de aba é instantâneo e não reconsulta dados.

      "Vendidos" lista `sales.status='completed'` (uma venda cancelada é só
      Histórico, não "o que já vendi"), reaproveitando `fetchSales()` — sem
      query nova. Cada card mostra marca/modelo/versão/ano/placa/data/valor/
      cliente/vendedor/comissão, com "Histórico importado" para
      `origin='migration'`; tocar abre o mesmo `SaleDetailsSheet` já usado em
      Histórico e na Home — nenhuma implementação de detalhe duplicada.

      Filtros (`src/lib/data/soldSales.ts`, com 20 testes unitários próprios):
      período (este mês/3/6/12 meses/tudo/ano específico quando há mais de um
      ano de dado — mesmo padrão de pill+select da Home), vendedor e canal
      (derivados das próprias vendas concluídas, nunca uma lista fixa
      desalinhada do dado real), origem (app/migração), busca por marca/
      modelo/placa/cliente — todos combináveis, num "Filtros" compacto
      (bottom sheet) para não competir por espaço com os pills de período
      sempre visíveis. Ordenação: mais recente/mais antiga/maior/menor valor.
      Resumo no topo (quantidade, faturamento, ticket médio, comissão
      conhecida) recalculado a partir do conjunto já filtrado — comissão
      ausente nunca é somada como se fosse conhecida, só contada à parte
      ("N vendas sem comissão informada").

      `fetchSales()` passou a trazer `model_year` (vehicles) /
      `confirmed_year`/`parsed_year` (vehicle_occurrences) — só o que faltava
      para mostrar "ano" nos cards; Histórico e Home continuam funcionando
      sem mudança. Testado com uma massa sintética de 542 vendas
      `origin='migration'` (mesma ordem de grandeza das vendas legadas reais
      em produção) para confirmar que filtro/ordenação/resumo seguem corretos
      nessa escala — este ambiente não alcança o Supabase real para puxar as
      542 linhas de verdade.
- [x] **Onda 16 — Revisão de legibilidade/UX de Vendidos**: feedback real de
      uso ("letras pequenas, texto secundário claro demais, pouco contraste,
      leitura cansativa, filtros pouco intuitivos") — não era um pedido de
      `font-size` maior, era hierarquia e contraste errados.

      *Tipografia/contraste*: removido `text-slate-400`/`text-500` de todo
      texto de conteúdo real (datas, placa, vendedor, meta) — no fundo claro
      deste app (tema travado em light), `slate-400` mede ~2,8:1 de contraste
      contra branco, abaixo do mínimo WCAG AA (4,5:1); virou `slate-600`
      (~6,6:1) em todo lugar, com `slate-500` (~4,67:1, ainda dentro do AA)
      reservado só para eyebrows curtos colados a um valor bem mais forte
      logo abaixo (ex. "TICKET MÉDIO"). Preço/contagem de vendas subiram de
      tamanho e peso; nenhum texto operacional ficou em 12px.

      *Navegação mensal explícita* (pedido novo, não existia): tira
      "< Agosto de 2026 >" no topo da visão, sempre visível — setas
      avançam/voltam um mês (nunca para o futuro; sem piso, então meses sem
      venda continuam navegáveis e mostram um vazio honesto, não somem),
      tocar no rótulo abre um seletor de mês/ano em bottom sheet (grade de
      12 meses + navegação de ano). `SoldPeriodSelection` ganhou o tipo
      `calendarMonth` (ano+mês explícitos) ao lado dos períodos corridos
      (3/6/12 meses/ano/tudo) já existentes — os pills de período viraram um
      atalho complementar à tira de mês, não o único jeito de navegar.

      *Filtros rápidos vs. avançados*: mês e busca ficam sempre visíveis;
      vendedor/canal/origem/comissão (informada/não informada, novo)/ano do
      veículo (novo)/faixa de valor (novo) foram para um "Filtros avançados"
      compacto, com contagem de filtros ativos visível no próprio botão
      ("Filtros · 2"). Botões de filtro/ordenar ganharam texto (não só
      ícone). Card de venda reorganizado na hierarquia pedida
      (marca/modelo → versão → preço em destaque → data → ano · placa →
      badge), com chevron indicando que é tocável.

      32 testes unitários (`soldSales.ts`: navegação de mês, período, todos
      os filtros novos e combinados) + 19 testes de componente (mês sem
      venda, troca de mês/ano, filtros combinados, resumo refletindo
      filtros, busca, ordenação, abertura do `SaleDetailsSheet`, escala de
      542 vendas). Validado visualmente com screenshots reais em Android
      (Playwright, perfil Pixel 7, dados simulados — este ambiente não
      alcança o Supabase real) antes de finalizar o design.

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
