import type { PipelineResult } from '../pipeline'
import type { MigrationSummary } from './summary'

function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function pct(part: number, total: number): string {
  if (total === 0) return '0%'
  return `${((part / total) * 100).toFixed(1)}%`
}

export function renderMarkdownReport(result: PipelineResult, summary: MigrationSummary): string {
  const { workbook, dates, rows, vehicles, plates, sales, currentInventory } = summary

  const lines: string[] = []
  const p = (s: string) => lines.push(s)

  p('# Migration Dry-Run Report — Polly Veículos')
  p('')
  p(`Gerado em: ${summary.generatedAt}`)
  p('')
  p('Este relatório é gerado automaticamente pelo pipeline de migração (dry-run). Nenhum dado foi gravado em produção — ver `MIGRATION.md` e `ARCHITECTURE.md` para o contrato aprovado.')
  p('')
  p('---')
  p('')

  p('## Workbook')
  p('')
  p(`- Sheets totais no arquivo: **${workbook.totalSheets}**`)
  p(`- Sheets utilizadas (dado real de veículo/venda): **${workbook.usedSheets}**`)
  p(`- Sheets ignoradas: **${workbook.ignoredSheets.length}**`)
  for (const s of workbook.ignoredSheets) {
    p(`  - \`${s.name}\` — ${s.reason}: ${s.detail}`)
  }
  if (workbook.unclassifiedSheets.length > 0) {
    p('')
    p(`⚠️ **${workbook.unclassifiedSheets.length} sheet(s) sem layout conhecido** (não processadas, precisam de investigação antes do próximo dry-run):`)
    for (const s of workbook.unclassifiedSheets) p(`  - \`${s}\``)
  }
  p(`- Período coberto: **${workbook.periodFrom} → ${workbook.periodTo}**`)
  p('')

  p('## Rows')
  p('')
  p(`- Linhas classificadas como dado de veículo/venda: **${rows.totalDataRows}**`)
  p(`- Linhas ignoradas como totalizador/cabeçalho intermediário: **${rows.ignoredAsTotalsOrHeaders}**`)
  p('')

  p('## Vehicles')
  p('')
  p(`- Occurrences (linha = 1 ocorrência mensal de um veículo): **${vehicles.occurrences}**`)
  p(`- Veículos canônicos estimados: **${vehicles.canonicalVehiclesEstimated}**`)
  p(`- Auto-matches Tier 1 (placa exata + continuidade): **${vehicles.autoMatchesTier1}**`)
  p(`- Auto-matches Tier 2 (atributos, alta confiança, único candidato): **${vehicles.autoMatchesTier2}**`)
  p(`- Candidatos em revisão (Tier 3, não fundidos automaticamente): **${vehicles.reviewCandidates}**`)
  p(`- Conflitos (mesma placa reivindicada por >1 veículo aberto): **${vehicles.conflicts}**`)
  p('')

  p('## Plates')
  p('')
  const totalPlates = plates.old + plates.mercosul + plates.invalid + plates.missing
  p(`- Formato antigo válido: **${plates.old}** (${pct(plates.old, totalPlates)})`)
  p(`- Formato Mercosul válido: **${plates.mercosul}** (${pct(plates.mercosul, totalPlates)})`)
  p(`- Inválidas/malformadas: **${plates.invalid}** (${pct(plates.invalid, totalPlates)})`)
  p(`- Ausentes: **${plates.missing}** (${pct(plates.missing, totalPlates)})`)
  p('')

  p('## Dates')
  p('')
  const totalDates = dates.valid + dates.invalidPlaceholderDay + dates.invalidYearDigits + dates.implausibleYear + dates.missing
  p(`- Válidas: **${dates.valid}** (${pct(dates.valid, totalDates)})`)
  p(`- Inválidas — dia placeholder ("00"): **${dates.invalidPlaceholderDay}**`)
  p(`- Inválidas — dígitos de ano malformados: **${dates.invalidYearDigits}**`)
  p(`- Suspeitas — ano implausível (ex.: 2028 num contexto de 2024/2025): **${dates.implausibleYear}**`)
  p(`- Ausentes (linhas de estoque, esperado): **${dates.missing}**`)
  p('')

  p('## Sales')
  p('')
  p(`- Vendas detectadas: **${sales.detected}**`)
  p(`- Com data válida (\`sale_detected\`): **${sales.validDate}**`)
  p(`- Com data inválida mas evidência forte (\`sale_detected_with_invalid_date\`): **${sales.invalidDate}**`)
  p(`- Ambíguas (\`sale_ambiguous\` — evidência fraca): **${sales.ambiguous}**`)
  p('')

  p('## Current inventory (candidato)')
  p('')
  p(`- Quantidade candidata (snapshot ${workbook.periodTo}): **${currentInventory.count}**`)
  p(`- Valor total anunciado: **${fmtBRL(currentInventory.totalValue)}**`)
  p(`- Com pelo menos um warning: **${currentInventory.withWarnings}**`)
  p('')
  if (result.currentInventory.candidates.length > 0) {
    p('| Veículo | Ano | Placa | Valor | Origem | Confiança |')
    p('|---|---|---|---|---|---|')
    for (const c of result.currentInventory.candidates) {
      const veic = [c.brand, c.model].filter(Boolean).join(' ') || '(não identificado)'
      p(
        `| ${veic} | ${c.year ?? '—'} | ${c.plate ?? '—'} | ${c.value !== null ? fmtBRL(c.value) : '—'} | \`${c.sourceSheet}\`#${c.sourceRow} | ${c.confidence} |`,
      )
    }
    p('')
  }

  p('## Review queue')
  p('')
  p(`- Total de ocorrências pendentes de revisão humana: **${summary.reviewQueue.totalEntries}**`)
  for (const entry of result.reviewQueue) {
    p(`- **${entry.reason}** (${entry.occurrenceKeys.length}): ${entry.detail}`)
  }
  p('')

  p('---')
  p('')
  p('_Nenhum conteúdo da aba sensível excluída aparece neste relatório — ver `ignored-sheets.ts` e `MIGRATION.md`._')

  return `${lines.join('\n')}\n`
}
