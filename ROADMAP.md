# Roadmap

## P0 — Operação principal (Estoque → Venda → Comissão → Histórico)

- [x] **Onda 1 — Foundation**: scaffold, schema do banco + RLS, autenticação,
      shell de navegação mobile, PWA básico. *(concluída)*
- [x] **Onda 2 — Migration Pipeline (dry-run)**: parser posicional por era de
      layout, classificação de qualidade, deduplicação conservadora com fila
      de revisão humana, relatório de migração. Sem carga em produção.
      *(concluída)*
- [x] **Onda 3 — Cutover parcial + Estoque**: Central de Revisão da migração
      (estoque candidato, conflitos, vendas ambíguas, demais itens), ação
      explícita "Criar estoque inicial", Estoque real (listar, buscar,
      editar, ver, cadastrar). Fecha a pendência de segurança de vendas via
      UPDATE direto. *(concluída)*
- [x] **Onda 4 — Venda + cancelamento + histórico operacional**: RPCs
      transacionais `register_sale`/`cancel_sale`, fluxo "Vender" (escolher
      veículo → formulário → confirmar), tela de Histórico real (vendas do
      app, busca, cancelamento com motivo obrigatório). Comissão fica manual
      por venda — nenhuma regra automática foi inventada (ver "Comissão"
      abaixo). *(concluída)*
- [x] **Onda 5 — Dashboard + Comissão configurável + acabamento**: painel
      Início com os 6 indicadores, comissão padrão configurável em
      `app_settings` (Mais → Configurações, sempre editável por venda),
      revisão de UX/copy em todo o app, remoção do componente de
      placeholder já sem uso. *(concluída)*
- [x] **Onda 6 — Auditoria, exportação e fechamento**: exportação de dados
      (CSV/JSON de estoque e histórico), trilha de auditoria visível em
      Mais → Auditoria, `create_vehicle`/`update_vehicle` RPCs fechando uma
      lacuna real (cadastro/edição de veículo agora é auditado — não era),
      revisão final de `GO_LIVE_CHECKLIST.md`. Aplicar migrations no
      projeto Supabase real continua bloqueado neste ambiente (sem projeto,
      credenciais, Docker ou CLI autenticada — ver relatório da onda);
      tudo o resto que não depende disso foi concluído. *(concluída)*

### Endurecimento futuro (não bloqueia Go-Live)

`vehicles` ainda aceita INSERT/UPDATE direto de `authenticated` via RLS
(modelo de "equipe confiável" desde a Onda 1) — a Onda 6 fez o app passar a
usar exclusivamente `create_vehicle`/`update_vehicle` (auditados), mas um
acesso direto à tabela fora do app ainda contorna a auditoria tecnicamente.
`sales`, `audit_log` e `vehicle_occurrences` já não têm essa brecha (só
RPC/trigger escrevem). Fechar o mesmo caminho para `vehicles` — remover as
policies de INSERT/UPDATE diretas e reescrever as asserções que dependem
delas — é uma tarefa isolada e de baixo risco para quando houver tempo,
não um bloqueio de lançamento.

### Comissão

Nenhuma fórmula de comissão foi inventada. `app_settings.default_commission_pct`
guarda um percentual padrão opcional (configurável em /mais), usado apenas
como sugestão de preenchimento no formulário de venda — sempre editável e
nunca aplicado automaticamente sem confirmação humana. Uma regra de cálculo
automática de verdade (por vendedor, por faixa de valor, etc.) fica para
quando o usuário real definir como o pagamento funciona hoje.

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
