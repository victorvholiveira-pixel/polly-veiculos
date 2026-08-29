# Roadmap

## P0 — Operação principal (Estoque → Venda → Comissão → Histórico)

- [x] **Onda 1 — Foundation**: scaffold, schema do banco + RLS, autenticação,
      shell de navegação mobile, PWA básico. *(concluída)*
- [ ] **Onda 2 — Migration Pipeline (dry-run)**: parser posicional por era de
      layout, classificação de qualidade, deduplicação conservadora com fila
      de revisão humana, relatório de migração. Sem carga em produção ainda.
- [ ] **Onda 3 — Cutover + Estoque**: tela de revisão humana do estoque
      candidato (as ~17 linhas de AGO/2026 e o restante do histórico
      resolvido), aprovação linha a linha, carga final do estoque real.
      Tela de Estoque real (listar, buscar, editar, ver).
- [ ] **Onda 4 — Fluxo Vender**: RPC transacional de venda/cancelamento,
      formulário de venda, tela de Estoque ganha a ação "Vender". *Depende de
      uma conversa com o usuário real sobre como a comissão funciona hoje —
      ver "Pendência de negócio" abaixo.*
- [ ] **Onda 5 — Histórico + Comissão**: telas reais de Histórico (filtro por
      mês/ano/veículo/placa/cliente) e Comissão, usando dados migrados e
      vendas ao vivo.
- [ ] **Onda 6 — Dashboard**: os 6 indicadores aprovados (veículos em estoque,
      valor do estoque, vendas do mês, faturamento do mês, comissão do mês,
      comparação com mês anterior).
- [ ] **Go-Live**: auditoria final por `GO_LIVE_CHECKLIST.md`, cutover da
      planilha (planilha vira histórico/backup, nunca mais fonte operacional).

### Pendência de negócio (bloqueia parte da Onda 4)

Nenhuma regra de comissão foi encontrada na planilha ao nível de transação
(ver `MIGRATION.md`). Antes de implementar qualquer cálculo automático,
precisamos entender com o vendedor real como o pagamento funciona hoje. Até
lá, o banco já está preparado para guardar `commission_amount`,
`commission_percentage` e `commission_rule_snapshot` por venda, sem regra
presumida.

## P1 — Produtividade

- Exportação de dados (CSV/JSON) — "os dados pertencem à loja".
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
