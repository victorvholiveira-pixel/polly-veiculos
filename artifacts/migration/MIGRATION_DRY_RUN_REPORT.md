# Migration Dry-Run Report — Polly Veículos

Gerado em: 2026-08-29T01:15:10.181Z

Este relatório é gerado automaticamente pelo pipeline de migração (dry-run). Nenhum dado foi gravado em produção — ver `MIGRATION.md` e `ARCHITECTURE.md` para o contrato aprovado.

---

## Workbook

- Sheets totais no arquivo: **56**
- Sheets utilizadas (dado real de veículo/venda): **50**
- Sheets ignoradas: **6**
  - `Cópia de SET 22` — duplicate: Byte-for-byte duplicate of "SET 22".
  - `Cópia de NOVEMBRO ` — duplicate: Byte-for-byte duplicate of "NOV 22".
  - `INFORMAÇÃO ` — sensitive: Excluded non-operational sensitive worksheet.
  - `Página16` — empty: Sheet is entirely empty (A1 is null).
  - `Página14` — empty: Sheet is entirely empty (A1 is null).
  - `Página13` — empty: Sheet is entirely empty (A1 is null).
- Período coberto: **2022-07-01 → 2026-08-01**

## Rows

- Linhas classificadas como dado de veículo/venda: **1521**
- Linhas ignoradas como totalizador/cabeçalho intermediário: **219**

## Vehicles

- Occurrences (linha = 1 ocorrência mensal de um veículo): **1521**
- Veículos canônicos estimados: **1023**
- Auto-matches Tier 1 (placa exata + continuidade): **908**
- Auto-matches Tier 2 (atributos, alta confiança, único candidato): **88**
- Candidatos em revisão (Tier 3, não fundidos automaticamente): **70**
- Conflitos (mesma placa reivindicada por >1 veículo aberto): **5**

## Plates

- Formato antigo válido: **495** (32.5%)
- Formato Mercosul válido: **417** (27.4%)
- Inválidas/malformadas: **25** (1.6%)
- Ausentes: **584** (38.4%)

## Dates

- Válidas: **602** (39.6%)
- Inválidas — dia placeholder ("00"): **7**
- Inválidas — dígitos de ano malformados: **4**
- Suspeitas — ano implausível (ex.: 2028 num contexto de 2024/2025): **0**
- Ausentes (linhas de estoque, esperado): **908**

## Sales

- Vendas detectadas: **888**
- Com data válida (`sale_detected`): **602**
- Com data inválida mas evidência forte (`sale_detected_with_invalid_date`): **23**
- Ambíguas (`sale_ambiguous` — evidência fraca): **263**

## Current inventory (candidato)

- Quantidade candidata (snapshot 2026-08-01): **17**
- Valor total anunciado: **R$ 612.700,00**
- Com pelo menos um warning: **7**

| Veículo | Ano | Placa | Valor | Origem | Confiança |
|---|---|---|---|---|---|
| Chevrolet Montana | 2025 | — | R$ 124.900,00 | `AGO 2026`#11 | medium |
| Toyota Etios | 2018 | — | R$ 29.900,00 | `AGO 2026`#12 | medium |
| Ford Fiesta | 2016 | GCA0B64 | R$ 56.900,00 | `AGO 2026`#32 | medium |
| Chevrolet Onix | 2023 | SHC3I47 | — | `AGO 2026`#10 | medium |
| Jeep Renegade | 2021 | — | R$ 82.900,00 | `AGO 2026`#29 | medium |
| Chevrolet Agile | 2011 | EYR7I73 | R$ 37.900,00 | `AGO 2026`#8 | high |
| Hyundai I30 | 2010 | EEY3832 | — | `AGO 2026`#16 | medium |
| Renault Sandero | 2019 | QOB2G36 | R$ 44.900,00 | `AGO 2026`#6 | high |
| Chevrolet Onix | 2018 | GBT5244 | — | `AGO 2026`#21 | medium |
| (não identificado) | 2019 | — | — | `AGO 2026`#9 | medium |
| Renault Sandero | — | — | R$ 44.900,00 | `AGO 2026`#15 | medium |
| Ford Fiesta | 2011 | EQW1124 | R$ 25.900,00 | `AGO 2026`#17 | high |
| (não identificado) | 2012 | FAQ8807 | R$ 32.900,00 | `AGO 2026`#19 | high |
| Ford Ka | 2015 | FKJ2D64 | R$ 42.900,00 | `AGO 2026`#23 | high |
| Volkswagen Gol | 2006 | DRS9287 | R$ 19.900,00 | `AGO 2026`#26 | high |
| Honda Elite moto | 2024 | — | R$ 14.900,00 | `AGO 2026`#28 | medium |
| Honda Fit | 2011 | EVM8G56 | R$ 53.900,00 | `AGO 2026`#34 | high |

## Review queue

- Total de ocorrências pendentes de revisão humana: **529**
- **plausible_but_unconfident_vehicle_match** (70): Occurrence has one or more plausible prior-vehicle candidates (see canonical_vehicle_candidates match_candidates), but none confident enough to auto-merge. A new vehicle was created; a human should confirm whether it is actually the same car.
- **no_identity_signal** (455): No plate and no attribute signal strong enough to even suggest a candidate. Treated as a standalone new vehicle; likely needs manual classification (brand/model unreadable, or a genuinely isolated record).
- **plate_claimed_by_multiple_open_vehicles** (4): More than one currently-open vehicle candidate shares the same normalized plate. Never auto-resolved — needs a human to say which (if any) is the real continuation.

---

_Nenhum conteúdo da aba sensível excluída aparece neste relatório — ver `ignored-sheets.ts` e `MIGRATION.md`._
