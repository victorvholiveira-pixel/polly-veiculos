import { describe, expect, it } from 'vitest'
import { toCSV } from '../export'

describe('toCSV', () => {
  it('joins header and rows with ; (pt-BR Excel default)', () => {
    const csv = toCSV([{ a: '1', b: '2' }], [
      { key: 'a', header: 'Coluna A' },
      { key: 'b', header: 'Coluna B' },
    ])
    expect(csv).toBe('Coluna A;Coluna B\r\n1;2')
  })

  it('quotes and escapes a value containing the separator, a quote, or a newline', () => {
    const csv = toCSV(
      [{ name: 'Fiat; Uno "Top" linha\nnova' }],
      [{ key: 'name', header: 'Nome' }],
    )
    expect(csv).toBe('Nome\r\n"Fiat; Uno ""Top"" linha\nnova"')
  })

  it('renders null/undefined as an empty field, never as the literal string "null"', () => {
    const csv = toCSV([{ value: null }], [{ key: 'value', header: 'Valor' }])
    expect(csv).toBe('Valor\r\n')
  })
})
