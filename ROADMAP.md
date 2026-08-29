# Roadmap

## P0 — Operação principal (Estoque → Venda → Comissão → Histórico)

- [x] **Onda 1 — Foundation**: scaffold, autenticação, shell de navegação
      mobile, PWA básico. *(concluída — schema/RLS originais eram do
      Supabase; ver Onda 7)*
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
      auditado (lacuna real fechada). *(concluída — sob a arquitetura
      Supabase, depois substituída na Onda 7)*
- [x] **Onda 7 — Migração de backend: Supabase → Google Apps Script +
      Sheets**: sem projeto Supabase real disponível em nenhum momento,
      backend inteiro reescrito sobre Apps Script + Sheets (ver
      `ARCHITECTURE.md`). Frontend e UX preservados — só a camada de dados
      mudou. Toda regra de negócio (guarda de "sold", placa única,
      proveniência da migração, auditoria) reimplementada em `gas/Logic.js`
      e testada via `gas/__tests__/`. *(concluída — falta só o deploy do
      Web App, que exige uma ação manual única do usuário — ver
      `GO_LIVE_CHECKLIST.md`)*

### Endurecimento futuro (não bloqueia Go-Live)

`Vehicles` ainda aceita escrita de qualquer chamada autenticada por trás de
`createVehicle_`/`updateVehicle_` (o app só usa essas duas ações, que
auditam tudo), mas nada impede um acesso à planilha por fora do app de
contornar isso. Aceitável com uso pessoal e planilha não compartilhada — ver
"Decisões difíceis de mudar depois" em `ARCHITECTURE.md`.

### Comissão

Nenhuma fórmula de comissão foi inventada. `AppSettings.default_commission_pct`
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
