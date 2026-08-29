import type { LayoutColumns, SheetLayout } from './types'

/**
 * Column-position templates for every real (non-ignored) sheet in the
 * workbook, derived empirically from the source file — NOT from header text,
 * which is corrupted (mislabeled, duplicated, or overwritten by stray
 * totals) in at least 15 sheets. Positions were cross-checked two ways:
 * (1) each sheet's own header row text, for sheets where it is trustworthy,
 * and (2) the value-type signature of each column across ~40 data rows
 * (which column is mostly dates, mostly plate-shaped strings, mostly the
 * literal 1/1.0 flag, mostly prices in the 3.000–300.000 range) — used to
 * catch cases where header text looks plausible but is actually wrong (e.g.
 * "DT venda" vs "Entrou Lj" are both date-typed columns; only position tells
 * them apart once a header is unreliable).
 *
 * The original audit (FASE 0) described "6 eras". Implementing the parser
 * revealed the real drift is finer-grained — columns shift by 1–3 positions
 * within what looked like a single era, several times a year. This file
 * keeps 4 broad `eraFamily` labels for readability but defines 20 precise
 * per-sheet-group layouts (`id: L1..L20`), which is the level of detail the
 * position-based mapping actually needs to be correct.
 *
 * col(): converts a spreadsheet column letter to the 0-indexed number the
 * rest of the pipeline uses (A -> 0).
 */
function col(letter: string): number {
  let n = 0
  for (const ch of letter) {
    n = n * 26 + (ch.toUpperCase().charCodeAt(0) - 64)
  }
  return n - 1
}

function layout(
  id: string,
  eraFamily: string,
  periodLabel: string,
  sheets: string[],
  headerRow: number,
  columns: Partial<Record<keyof LayoutColumns, string>>,
  notes: string[] = [],
  allRowsSold = false,
): SheetLayout {
  const resolved: LayoutColumns = {}
  for (const [key, letter] of Object.entries(columns)) {
    if (letter) resolved[key as keyof LayoutColumns] = col(letter)
  }
  return { id, eraFamily, periodLabel, sheets, headerRow, columns: resolved, notes, allRowsSold }
}

const ERA_A = 'Era A — sem coluna de estoque (venda-only / placa introduzida)'
const ERA_B = 'Era B — flag de estoque introduzido, "Nome" vira "Compr"'
const ERA_C = 'Era C — Plataforma/Vended/Laudo/Obs adicionados ("Vr Estoque")'
const ERA_D = 'Era D — flag renomeado "Disponível", tempo_v eventualmente removido'

export const SHEET_LAYOUTS: readonly SheetLayout[] = [
  layout(
    'L1',
    ERA_A,
    'jul/2022',
    [' JULHO 2022'],
    4,
    { date: 'A', marca: 'B', modelo: 'C', valor: 'D', entrada: 'E', nome: 'F', fone: 'G' },
    [
      'Sem coluna de Placa nem de flag de estoque — a era inteira é rotulada "Vendido" no topo da aba.',
      'Datas frequentemente aparecem como "00/07/2022" (dia placeholder) — tratado como data inválida, nunca corrigido.',
    ],
    true,
  ),
  layout('L2', ERA_A, 'ago–set/2022', ['AGOS 22', 'SET 22'], 4, {
    date: 'A',
    marca: 'B',
    modelo: 'C',
    valor: 'D',
    entrada: 'E',
    nome: 'F',
    fone: 'G',
    placa: 'H',
  }, [
    'Coluna "Nome" (F) às vezes contém o valor 1 em vez de um nome — funciona como um flag de estoque ad hoc, não oficial.',
    'Sem coluna de estoque dedicada: observedStatus é inferido por presença de data válida vs. flag ad hoc em F.',
  ]),
  layout('L3', ERA_A, 'out–nov/2022', ['OUT 22', 'NOV 22'], 4, {
    date: 'A',
    marca: 'B',
    modelo: 'C',
    valor: 'E',
    entrada: 'F',
    nome: 'G',
    fone: 'H',
    placa: 'I',
  }, ['Coluna D fica vazia (espaçador). Mesmo padrão de flag ad hoc em G (antigo "Nome") da L2.']),
  layout('L4', ERA_B, 'dez/2022–jan/2023', ['Dez22', 'JAN 2023'], 4, {
    date: 'A',
    flag: 'B',
    marca: 'C',
    modelo: 'D',
    valor: 'F',
    entrada: 'G',
    nome: 'H',
    fone: 'I',
    placa: 'J',
  }, ['Primeira aparição de uma coluna de estoque dedicada (B, valor 1 = em estoque).']),
  layout('L5', ERA_B, 'fev–mai/2023', ['FEV 2023', 'MARCO23', 'Abril 23', 'Maio 2023'], 5, {
    date: 'A',
    flag: 'B',
    marca: 'C',
    modelo: 'D',
    valor: 'F',
    entrada: 'G',
    nome: 'H',
    fone: 'I',
    placa: 'J',
  }, ['Mesmas posições de L4; cabeçalho passa a ocupar a linha 5 em vez da 4.']),
  layout('L6', ERA_B, 'jun/2023', ['JUN 2023'], 5, {
    date: 'A',
    flag: 'B',
    marca: 'C',
    modelo: 'D',
    valor: 'F',
    entrada: 'G',
    nome: 'H',
    fone: 'J',
    placa: 'K',
    tempoV: 'L',
  }, ['"tempo V" (dias em estoque) aparece pela primeira vez. Fone/Placa deslocam +1.']),
  layout('L7', ERA_B, 'jul/2023', ['JUL 2023'], 5, {
    date: 'A',
    flag: 'B',
    marca: 'C',
    modelo: 'D',
    valor: 'F',
    entrada: 'G',
    nome: 'H',
    fone: 'I',
    placa: 'J',
    tempoV: 'K',
  }, ['Cabeçalho H diz "Data venda" (rótulo duplicado/corrompido) — posicionalmente é "Nome", confirmado por continuidade com L6.']),
  layout('L8', ERA_B, 'ago/2023', ['AGO 2023'], 5, {
    date: 'A',
    flag: 'B',
    marca: 'C',
    modelo: 'D',
    valor: 'F',
    entrada: 'G',
    compr: 'K',
    fone: 'H',
    placa: 'I',
    tempoV: 'J',
  }, [
    'Coluna "Nome" desaparece; "Compr" (comprador) passa a ser o campo de comprador, ao final da linha.',
    'Cabeçalho A diz "Valor Estoq" e B contém um número solto (vazamento de totalizador) — ambos ignorados, usamos a posição.',
  ]),
  layout('L9', ERA_B, 'set/2023', ['SET 2023'], 6, {
    date: 'A',
    flag: 'B',
    marca: 'C',
    modelo: 'D',
    valor: 'G',
    entrada: 'H',
    fone: 'I',
    placa: 'J',
    tempoV: 'K',
    compr: 'L',
  }, [
    'Cabeçalho ocupa a linha 6 (não 5). Gap alargado entre Modelo e Valor.',
    'Bloco "fantasma" de colunas duplicadas a partir de ~S — confirmado vazio, ignorado pelo parser (nunca lido além da coluna N).',
  ]),
  layout('L10', ERA_B, 'out–nov/2023', ['OUT 2023', 'Nov 2023'], 5, {
    date: 'A',
    flag: 'D',
    marca: 'E',
    modelo: 'F',
    valor: 'I',
    entrada: 'J',
    fone: 'K',
    placa: 'L',
    tempoV: 'M',
    compr: 'N',
  }, ['Flag desloca de B para D.']),
  layout('L11', ERA_B, 'dez/2023', ['Dez2023'], 5, {
    date: 'A',
    flag: 'D',
    marca: 'E',
    modelo: 'F',
    valor: 'G',
    entrada: 'H',
    fone: 'I',
    placa: 'J',
    tempoV: 'K',
    compr: 'L',
    troca: 'M',
  }, ['"Troca" (veículo dado como entrada) aparece pela primeira vez.']),
  layout('L12', ERA_C, 'jan/2024', ['JAN24'], 5, {
    date: 'A',
    flag: 'D',
    marca: 'E',
    modelo: 'F',
    valor: 'G',
    entrada: 'H',
    plataforma: 'I',
    placa: 'J',
    tempoV: 'K',
    compr: 'L',
    troca: 'M',
    vended: 'N',
    laudo: 'O',
  }, ['"Plataforma", "Vended" (vendedor) e "Laudo" aparecem pela primeira vez. Sem coluna de Fone identificada nesta aba.']),
  layout(
    'L13',
    ERA_C,
    'fev–ago/2024',
    ['FEV24', 'MARC24', 'A B R 24', 'M A I24', 'J U N 24', ' J U L   24', 'AGOS   24'],
    5,
    {
      date: 'A',
      flag: 'D',
      marca: 'F',
      modelo: 'G',
      valor: 'H',
      entrada: 'I',
      plataforma: 'J',
      placa: 'K',
      tempoV: 'L',
      compr: 'M',
      troca: 'N',
      vended: 'O',
      laudo: 'P',
      fone: 'Q',
    },
    [
      'A partir de J U N 24, o cabeçalho da coluna F (Marca) some e é substituído por um segundo "Vr Estoque" — rótulo corrompido/duplicado. Posição de Marca não muda; usamos F por continuidade.',
    ],
  ),
  layout('L14', ERA_C, 'set–out/2024', ['Sete2024', 'OUT2024'], 5, {
    date: 'A',
    flag: 'D',
    marca: 'F',
    modelo: 'G',
    valor: 'H',
    entrada: 'I',
    plataforma: 'J',
    placa: 'K',
    tempoV: 'L',
    compr: 'M',
    troca: 'N',
    vended: 'O',
    fone: 'Q',
  }, ['Coluna "Laudo" (P) não aparece nestes dois meses — tratada como ausente, não como erro.']),
  layout('L15', ERA_C, 'nov–dez/2024', ['NOV 2024', 'Dez 2024'], 5, {
    date: 'A',
    flag: 'D',
    marca: 'F',
    modelo: 'G',
    valor: 'H',
    entrada: 'I',
    plataforma: 'J',
    placa: 'K',
    tempoV: 'L',
    compr: 'M',
    troca: 'N',
    vended: 'O',
    fone: 'Q',
    obs: 'R',
  }, ['"Obs" (observações) aparece pela primeira vez. "Laudo" continua ausente.']),
  layout('L16', ERA_C, 'jan–mar/2025', ['JAN 2025', 'FEV 2025', 'MAR 2025'], 5, {
    date: 'A',
    flag: 'D',
    marca: 'F',
    modelo: 'G',
    valor: 'H',
    entrada: 'I',
    plataforma: 'J',
    placa: 'K',
    tempoV: 'L',
    compr: 'M',
    troca: 'N',
    vended: 'O',
    laudo: 'P',
    fone: 'Q',
    obs: 'R',
  }, ['"Laudo" volta a aparecer, mesma posição de L13.']),
  layout('L17', ERA_D, 'abr–jun/2025', ['ABR 2025', 'MAI 2025', 'JUN 2025'], 5, {
    date: 'A',
    flag: 'D',
    marca: 'F',
    modelo: 'G',
    valor: 'H',
    entrada: 'I',
    plataforma: 'J',
    placa: 'K',
    tempoV: 'L',
    compr: 'M',
    troca: 'N',
    vended: 'O',
    laudo: 'P',
    fone: 'Q',
    obs: 'R',
  }, ['Mesmas posições de L16; a coluna de flag (D) passa a se chamar "Disponível" em vez de "Vr Estoque".']),
  layout('L18', ERA_D, 'jul–ago/2025', [' JUL 2025', 'Agos 2025'], 5, {
    date: 'A',
    flag: 'D',
    marca: 'F',
    modelo: 'G',
    valor: 'H',
    entrada: 'I',
    plataforma: 'J',
    placa: 'K',
    tempoV: 'L',
    compr: 'M',
    troca: 'N',
    vended: 'O',
    laudo: 'S',
  }, ['"Laudo" desloca para S. Fone/Obs não identificados com confiança nestas duas abas — tratados como ausentes.']),
  layout('L19', ERA_D, 'set/2025', ['SET 2025'], 5, {
    date: 'A',
    flag: 'D',
    marca: 'G',
    modelo: 'H',
    valor: 'I',
    entrada: 'J',
    plataforma: 'K',
    placa: 'L',
    tempoV: 'M',
    compr: 'N',
    troca: 'O',
    vended: 'P',
  }, ['Deslocamento geral de +2 em relação a L18 — mês isolado.']),
  layout(
    'L20',
    ERA_D,
    'out/2025–mar/2026',
    ['OUT 2025', 'NOV 2025', 'DEZ 2025', 'jan2026', 'fev2026', 'mar2026'],
    5,
    {
      date: 'A',
      flag: 'D',
      marca: 'F',
      modelo: 'G',
      valor: 'H',
      entrada: 'I',
      plataforma: 'J',
      placa: 'K',
      tempoV: 'L',
      compr: 'M',
      troca: 'N',
      vended: 'O',
      laudo: 'S',
    },
    ['Volta às posições de L18 (laudo em S).'],
  ),
  layout(
    'L21',
    ERA_D,
    'abr–ago/2026',
    ['abril2026', 'Maio2026', 'JUNHO 2026', 'JULHO 2026', 'AGO 2026'],
    5,
    {
      date: 'A',
      flag: 'D',
      marca: 'F',
      modelo: 'G',
      valor: 'H',
      entrada: 'I',
      plataforma: 'J',
      placa: 'K',
      compr: 'L',
      troca: 'M',
      vended: 'N',
      laudo: 'R',
      fone: 'S',
    },
    ['"tempo V" é removido definitivamente a partir daqui.'],
  ),
]

const LAYOUT_BY_SHEET = new Map<string, SheetLayout>()
for (const l of SHEET_LAYOUTS) {
  for (const sheet of l.sheets) {
    LAYOUT_BY_SHEET.set(sheet, l)
  }
}

export function resolveLayout(sheetName: string): SheetLayout | undefined {
  return LAYOUT_BY_SHEET.get(sheetName)
}

export function allKnownSheetNames(): string[] {
  return [...LAYOUT_BY_SHEET.keys()]
}
