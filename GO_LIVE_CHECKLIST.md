# Checklist de Go-Live

Nada aqui deve ser marcado como pronto sem evidência real. Status honesto na
Onda 1 — a esmagadora maioria ainda está por fazer, e deve continuar assim
até ser genuinamente verdade.

## Banco

- [x] Migrations versionadas e aplicadas com sucesso contra um Postgres real
      (`npm run db:validate` — via Postgres local, não o projeto real ainda)
- [ ] Migrations aplicadas contra o projeto Supabase real de produção
- [x] Constraints (checks, unique indexes, FKs) validadas com inserts reais
- [x] RLS habilitado em todas as tabelas operacionais, testado por papel
      (anon vs. authenticated) com inserts reais, não só leitura do SQL
- [ ] Backup configurado no projeto Supabase real

## Dados

- [ ] Histórico migrado (Onda 2)
- [ ] Estoque validado por humano, linha a linha (Onda 3)
- [ ] Duplicidades tratadas (fila de revisão resolvida)
- [ ] Relatório de inconsistências gerado e revisado
- [ ] Comissão: regra de negócio definida com o usuário real (hoje: nenhuma
      regra presumida, ver `MIGRATION.md`)

## Aplicação

- [x] Login (formulário funcional; login de verdade pendente de projeto Supabase real)
- [x] Estoque (lista, busca, ver, editar — funcional; validado só em Postgres local, não no projeto real)
- [x] Cadastro de veículo
- [x] Edição de veículo (nunca permite marcar como vendido — ver Segurança)
- [x] Venda (`register_sale` RPC transacional, fluxo "Vender" completo — funcional; não validado contra o projeto real)
- [x] Comissão manual por venda (campo livre no formulário de venda; regra automática ainda não existe — ver ROADMAP.md)
- [x] Histórico (vendas reais do app, busca por comprador/placa/marca/modelo)
- [x] Cancelamento de venda (`cancel_sale` RPC, motivo obrigatório, reverte o veículo para disponível)
- [x] Filtros (estoque, histórico) — busca textual simples; sem filtro por mês/ano ainda
- [x] PWA instalável (manifest + service worker gerados; ícones são placeholder)

## Qualidade

- [x] `npm run lint` sem erros (1 warning informativo conhecido — ver
      `ARCHITECTURE.md`/relatório da Onda 1)
- [x] `npm run typecheck` sem erros (TypeScript strict)
- [x] `npm run test` — testes unitários/componente passando
- [x] `npm run test:e2e` — smoke tests em navegador real passando (sem
      backend real ainda — provam a fiação client-side, não login de verdade)
- [x] `npm run build` — build de produção sem erros

## Segurança

- [ ] Secrets/env auditados no projeto Supabase real de produção
- [x] Nenhuma `service_role key` em código de frontend
- [x] RLS ativo em toda tabela operacional, sem policy `true` temporária
      esquecida
- [ ] Dados privados de cliente confirmados como não expostos publicamente
      (a validar quando existir dado real de cliente)
- [ ] Confirmar que as credenciais expostas na planilha original foram
      trocadas pelo usuário (fora do escopo deste projeto, mas é um bloqueio
      de segurança real — ver `MIGRATION.md`)

## Produção

- [ ] Domínio/URL definido
- [ ] HTTPS (padrão em Vercel/Netlify, mas confirmar)
- [ ] Instalação testada num Android real
- [ ] Smoke test real, com dados reais, contra o projeto Supabase de produção

## Cutover da planilha

- [ ] `migration_started_at` / `migration_completed_at` registrados
- [ ] Planilha confirmada como não mais escrita operacionalmente
- [ ] Comunicação ao usuário: planilha agora é só histórico/backup

---

Só declarar Go-Live quando todos os itens acima estiverem genuinamente
marcados — não antes.
