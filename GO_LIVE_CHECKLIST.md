# Checklist de Go-Live

Nada aqui deve ser marcado como pronto sem evidência real. Reescrito após a
Onda 7 (migração de backend para Google Apps Script + Sheets) — os itens que
dependiam do Supabase real ficam pendentes até o deploy real do Web App,
mesmo que a implementação já esteja pronta e testada.

## Backend (Google Apps Script + Sheets)

- [x] `gas/*.js` implementados e testados via `gas/__tests__/` (Vitest
      rodando os arquivos reais dentro de um `vm` com mocks das APIs do
      Apps Script) — 20 testes cobrindo venda/cancelamento/guarda de
      "sold"/placa única/proveniência/idempotência/auditoria
- [ ] Projeto Apps Script criado e implantado como Web App na conta Google
      do usuário (ação manual única — ver `ARCHITECTURE.md`, "Deploy do
      backend"; não é possível provisionar isso autonomamente)
- [ ] `setup()` executado uma vez no projeto real (cria a planilha, gera a
      senha de login e o `ADMIN_SECRET`)
- [ ] Ações validadas contra o Web App real (não só contra os mocks):
      login, fetchVehicles, createVehicle, updateVehicle, registerSale,
      cancelSale, fetchSales, fetchDashboardStats, fetchAuditLog
- [ ] Ações de revisão (Review Center) validadas contra o Web App real:
      fetchInventoryCandidates, decideInventoryCandidate,
      createInitialInventory, fetchAmbiguousSales, decideSale,
      fetchConflicts, fetchOtherReview, decideMatchCandidate

## Dados

- [ ] Histórico migrado (`scripts/migration/load-ledger.ts` rodado contra o
      Web App real — carrega VehicleOccurrences e VehicleMatchCandidates,
      não Vehicles/Sales)
- [ ] Estoque atual (17 candidatos) validado por humano, linha a linha, na
      Central de Revisão — **NÃO** vira estoque oficial automaticamente
- [ ] Duplicidades tratadas (fila de revisão P1/P3 resolvida ou
      conscientemente deixada pendente)
- [ ] Comissão: regra de negócio definida com o usuário real (hoje: nenhuma
      regra presumida, ver `MIGRATION.md`)

## Aplicação

- [x] Login (formulário funcional; senha real só existe após `setup()` no
      projeto Apps Script real)
- [x] Estoque (lista, busca, ver, editar — funcional contra os mocks de
      teste; não validado contra o Web App real ainda)
- [x] Cadastro de veículo
- [x] Edição de veículo (nunca permite marcar como vendido — ver Segurança)
- [x] Venda (`registerSale_`, fluxo "Vender" completo — funcional; não
      validado contra o Web App real)
- [x] Comissão manual por venda (campo livre no formulário de venda; regra
      automática ainda não existe — ver ROADMAP.md)
- [x] Histórico (vendas reais do app, busca por comprador/placa/marca/modelo)
- [x] Cancelamento de venda (`cancelSale_`, motivo obrigatório, reverte o
      veículo para disponível)
- [x] Filtros (estoque, histórico) — busca textual simples; sem filtro por
      mês/ano ainda
- [x] Painel Início com os 6 indicadores aprovados (estoque, valor do
      estoque, vendas do mês, faturamento do mês, comissão do mês,
      comparação com o mês anterior) — sem fallback de demonstração
- [x] Comissão padrão configurável (Mais → Configurações) como sugestão
      editável por venda — nenhuma regra automática
- [x] Auditoria (Mais → Auditoria) — leitura do log em linguagem simples:
      cadastro/edição de veículo, vendas e cancelamentos
- [x] Exportação de dados (Mais → Configurações) — CSV/JSON de estoque e
      histórico completos, não só o que a tela tem filtrado no momento
- [x] PWA instalável (manifest + service worker gerados; ícones são placeholder)

## Qualidade

- [x] `npm run lint` sem erros (1 warning informativo conhecido)
- [x] `npm run typecheck` sem erros (TypeScript strict)
- [x] `npm run test` — testes unitários/componente + backend (`gas/__tests__/`)
      passando
- [x] `npm run test:e2e` — smoke tests em navegador real passando (provam a
      fiação client-side, não login de verdade contra o backend real)
- [x] `npm run build` — build de produção sem erros

## Segurança

- [x] Nenhuma credencial sensível (senha de login, `ADMIN_SECRET`) em
      código ou em variável `VITE_` — só a URL do Web App é pública
- [x] `ADMIN_SECRET` nunca exposto ao frontend, só usado por
      `scripts/migration/load-ledger.ts` (script Node, nunca roda no
      navegador)
- [x] Trocar `status` de um veículo para "sold" só é possível por
      `registerSale_`/`cancelSale_`/`createInitialInventory_` —
      `updateVehicle_` estruturalmente não aceita esse parâmetro
- [~] `Vehicles` ainda aceita escrita de qualquer chamada autenticada por
      trás de `createVehicle_`/`updateVehicle_` (auditadas); nada impede um
      acesso à planilha por fora do app — não bloqueia o lançamento, ver
      "Decisões difíceis de mudar depois" em `ARCHITECTURE.md`
- [ ] Dados privados de cliente confirmados como não expostos publicamente
      (a validar quando existir dado real de cliente na planilha real)
- [ ] Confirmar que as credenciais expostas na planilha original foram
      trocadas pelo usuário (fora do escopo deste projeto, mas é um
      bloqueio de segurança real — ver `MIGRATION.md`)

## Produção

- [ ] Web App do Apps Script implantado (ver "Backend" acima)
- [ ] Frontend implantado (Vercel ou equivalente), `VITE_APPS_SCRIPT_URL`
      configurada
- [ ] HTTPS (padrão em Vercel, mas confirmar)
- [ ] Instalação testada num Android real
- [ ] Smoke test real, com dados reais, contra o Web App de produção

## Cutover da planilha antiga

- [ ] Planilha antiga confirmada como não mais escrita operacionalmente
- [ ] Comunicação ao usuário: planilha antiga agora é só histórico/backup
- [ ] Cópia da planilha antiga preservada antes do corte final

---

Só declarar Go-Live quando todos os itens acima estiverem genuinamente
marcados — não antes.
