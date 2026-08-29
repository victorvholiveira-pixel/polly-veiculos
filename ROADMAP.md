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
- Melhorias de busca/filtro no Estoque e Histórico além do básico.
- Assets oficiais de PWA (ícones reais, substituindo o placeholder "P").
- Ferramenta de merge manual de veículos (para os casos que a migração
  colocar em revisão e forem, de fato, o mesmo carro).

## P2 — Inteligência

- Ticket médio, dias médios em estoque, veículos mais antigos, desempenho
  anual, quantidade vendida por marca.

## P3 — Integrações

- Nada disto entra antes do P0 estar estável e íntegro:
  CRM completo, marketplace, sistema financeiro, DMS/ERP, gestão fiscal,
  financiamento, integração FIPE, WhatsApp, IA, gestão de leads.
