# Migração da planilha histórica

Fonte: `Venda POLY Atual.xlsx` (Google Drive), 56 abas, período julho/2022 a
agosto/2026 (auditoria completa em 2026-08-29). Este documento resume o que
foi encontrado e a estratégia aprovada — **sem** nenhum dado sensível.

## Aba excluída

Uma das 56 abas contém informações não-operacionais e sensíveis.

> Excluded non-operational sensitive worksheet.

Essa aba nunca gera linhas em `vehicle_occurrences`, nunca entra em
`original_payload`, `audit_log`, relatório de migração, fixture, log ou
prompt persistido — em nenhum lugar deste repositório ou do banco. As
credenciais que ela continha são tratadas fora deste projeto, diretamente
pelo usuário.

## Estado da planilha

- **56 abas totais → 50 abas com dado mensal real** (jul/2022–ago/2026).
- **5 abas descartadas sem perda de informação**: duas são duplicatas
  byte-a-byte de abas já contadas; três estão inteiramente vazias.
- **1 aba fora de ordem cronológica na lista de tabs, mas com dado real**
  (mês de transição entre duas eras de layout) — será reposicionada
  corretamente na migração, não descartada.
- **Sem schema fixo**: o layout de colunas mudou continuamente ao longo dos
  ~4 anos (6 "eras" distintas identificadas). Pelo menos 15 abas têm células
  de cabeçalho corrompidas (rótulo errado, duplicado, ou sobrescrito por um
  totalizador) — o parser da Onda 2 mapeia colunas por **posição**, nunca por
  texto de cabeçalho.

## Comissão: não encontrada ao nível de transação

Nenhuma aba tem uma coluna de comissão ligada a uma venda específica. A única
referência a algo parecido é uma régua de bônus por quantidade de carros
vendidos, existente apenas como nota de referência estática (não ligada a
vendedor, mês ou venda individual) — não é dado migrável, e não será usada
para presumir uma regra automática. Ver `ROADMAP.md` — isso é uma pendência
de negócio a resolver com o usuário real antes de implementar qualquer
cálculo.

## Estrutura real: uma tabela, não duas seções

Cada veículo — vendido ou em estoque — é uma única linha numa tabela mensal
contínua, diferenciada por qual de duas colunas está preenchida: a data de
venda (linha vendida) ou uma coluna de flag de estoque (linha ainda no
pátio). Não existem duas seções empilhadas com cabeçalhos próprios dentro do
mesmo mês.

## Qualidade de dados — principais riscos confirmados

- **Marca/Modelo misturados** na maioria das linhas (ex.: a célula "Marca"
  frequentemente contém marca+modelo+ano juntos) — exige parsing de texto
  livre, não um rename direto de coluna.
- **Placas**: mistura de formato antigo e Mercosul, uma fração relevante
  malformada, e uma fração relevante de linhas sem placa alguma — placa
  sozinha não é uma chave de deduplicação garantida.
- **Estoque duplicado entre meses**: quase metade das placas listadas num
  mês reaparece no mês seguinte — é o mesmo carro parado no pátio, não uma
  entrada nova. Importação ingênua infla o estoque histórico artificialmente.
- **Datas inválidas**: uma pequena fração tem dia placeholder ("00"), erro de
  digitação no ano, ou ano claramente impossível — reportadas, nunca
  "corrigidas" silenciosamente (ver regra de ouro abaixo).
- `valor` já é numérico limpo (não é texto de moeda) — sem necessidade de
  parsing de string monetária.

## Estratégia de identidade e deduplicação

Três conceitos, nunca confundidos (detalhe completo em `ARCHITECTURE.md`):
identidade do registro de origem (aba+linha), identidade do veículo real
(uuid canônico), e ocorrência mensal (uma linha por mês em que o veículo
apareceu).

A resolução de identidade (Onda 2) segue uma hierarquia conservadora:

1. Placa exata + continuidade de mês → merge automático.
2. Sem placa utilizável, mas atributos (marca/modelo/versão/ano/valor)
   batem de forma única e forte com um único candidato do mês anterior →
   merge automático, só acima de um limiar estrito.
3. Qualquer ambiguidade, empate entre candidatos, ou gap de mais de um mês
   → **nunca faz merge sozinho** — vai para uma fila de revisão humana.
4. Sem sinal algum → cria um veículo novo, isolado, marcado como baixa
   confiança.

**Princípio aplicado literalmente**: na dúvida, cria-se um veículo novo em
vez de fundir dois carros diferentes. Um falso negativo de deduplicação
(alguns registros extras) é corrigível depois; um falso positivo (dois carros
diferentes fundidos) corrompe preço e histórico de forma difícil de detectar.

## Regra de ouro sobre dados estranhos

Uma data como "27/04/1026" nunca é silenciosamente "corrigida" para 2026 —
é classificada como provável erro e reportada. Dados reais valem mais que
dados bonitos.

## Idempotência

Cada linha de origem tem uma chave natural única (`source_sheet`,
`source_row`) — reexecutar a mesma migração nunca duplica um registro.

## Estoque atual

O estoque mais recente da planilha (mês corrente) é tratado como
**candidato**, nunca como verdade definitiva. A Onda 3 entrega uma tela de
revisão com veículo, versão, ano, placa, valor, linha/aba de origem e nível
de confiança para validação humana, linha a linha, antes de qualquer carga
em produção.

## Vendas legadas — auditoria e critério de importação (Onda 10)

Das 888 ocorrências com `observed_status='sold'`, 602 têm
`sale_classification='sale_detected'` — a classificação de alta confiança
da migração (data de venda parseada com sucesso). Antes de importar
qualquer uma como venda real, auditei essas 602 contra os dois únicos
campos que `sales` exige (`sale_date`, `sale_value` — ambos `not null`):

- **542 têm os dois campos e uma data plausível** (não-futura) — essas
  viram `sales.origin='migration'` via
  `supabase/data-migrations/20260829002000_import_legacy_sales.sql`
  (aplicada automaticamente pelo pipeline de CI — ver ARCHITECTURE.md,
  "Data migrations").
- **58 não têm valor de venda registrado** na planilha original
  (`value_parsed is null`) — nunca inventado, ficam de fora.
- **2 têm data de venda no futuro**: `2028-05-10` e `2028-07-12`, ambas em
  sheets de **2025** (`MAI 2025`/`JUL 2025`) — quase certamente um erro de
  digitação do ano na planilha original (2025 → 2028). O parser reportou
  `saleDateValidation: 'valid'` corretamente (a data em si é um calendário
  válido) — mas uma venda no futuro nunca é um registro histórico
  plausível, então fica de fora da importação automática também, para
  correção manual eventual.

Nenhum dado ausente foi inventado para completar os 60 casos acima —
continuam disponíveis em `vehicle_occurrences` para revisão futura, do jeito
que a planilha realmente trouxe.

Comprador/vendedor/placa de uma venda legada nunca são copiados para
`sales` — continuam só em `vehicle_occurrences`, lidos sob demanda via
`source_occurrence_id` quando a tela precisa mostrá-los (ver
`ARCHITECTURE.md`, "sales.origin"). Comissão nunca existe na origem, então
toda venda legada tem `commission_amount`/`commission_percentage` nulos —
consistente com a regra geral de comissão deste projeto (ver "Comissão" no
ROADMAP.md).

## O que ainda não foi feito

Este documento descreve a estratégia **aprovada**. O pipeline de migração em
si (parser, classificador, resolução de identidade rodando de verdade sobre
as 50 abas) é escopo da Onda 2 — ainda não implementado.
