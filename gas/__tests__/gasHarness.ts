/**
 * Loads the plain-JS Apps Script source files (gas/*.js) into a Node `vm`
 * context with in-memory mocks of the GAS global services they use
 * (SpreadsheetApp, PropertiesService, Utilities, LockService, ContentService,
 * Logger). This lets the real backend code — the exact files pasted into the
 * Apps Script editor — be unit tested with Vitest, instead of trusting it
 * untested until it's deployed. See ARCHITECTURE.md, "Testando o backend".
 */
import { createHash, createHmac, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

class FakeSheet {
  name: string
  rows: unknown[][] = []
  constructor(name: string) {
    this.name = name
  }
  getRange(row: number, col: number, numRows: number, numCols: number) {
    return {
      getValues: (): unknown[][] => {
        const out: unknown[][] = []
        for (let r = 0; r < numRows; r++) {
          const line = this.rows[row - 1 + r] ?? []
          const slice: unknown[] = []
          for (let c = 0; c < numCols; c++) slice.push(line[col - 1 + c] ?? '')
          out.push(slice)
        }
        return out
      },
      setValues: (values: unknown[][]) => {
        for (let r = 0; r < values.length; r++) {
          const rowIdx = row - 1 + r
          while (this.rows.length <= rowIdx) this.rows.push([])
          for (let c = 0; c < values[r]!.length; c++) {
            this.rows[rowIdx]![col - 1 + c] = values[r]![c]
          }
        }
      },
    }
  }
  getLastRow() {
    return this.rows.length
  }
  getLastColumn() {
    return this.rows[0] ? this.rows[0].length : 0
  }
  setFrozenRows() {
    /* no-op in the fake */
  }
  appendRow(rowArray: unknown[]) {
    this.rows.push(rowArray.slice())
  }
}

class FakeSpreadsheet {
  id: string
  sheets: Record<string, FakeSheet> = {}
  constructor(id: string) {
    this.id = id
  }
  getId() {
    return this.id
  }
  getUrl() {
    return `https://fake.example/${this.id}`
  }
  getSheetByName(name: string) {
    return this.sheets[name] ?? null
  }
  insertSheet(name: string) {
    const sheet = new FakeSheet(name)
    this.sheets[name] = sheet
    return sheet
  }
}

function toByteArray(buf: Buffer): number[] {
  const arr: number[] = []
  for (const b of buf) arr.push(b > 127 ? b - 256 : b)
  return arr
}

function fromByteArray(arr: number[]): Buffer {
  return Buffer.from(arr.map((b) => (b < 0 ? b + 256 : b)))
}

function createMocks() {
  const spreadsheets: Record<string, FakeSpreadsheet> = {}
  const properties: Record<string, string> = {}
  const logs: string[] = []

  return {
    logs,
    SpreadsheetApp: {
      create(_name: string) {
        const id = `fake-${Object.keys(spreadsheets).length}`
        const ss = new FakeSpreadsheet(id)
        spreadsheets[id] = ss
        return ss
      },
      openById(id: string) {
        return spreadsheets[id]
      },
    },
    PropertiesService: {
      getScriptProperties() {
        return {
          getProperty: (k: string) => (k in properties ? properties[k] : null),
          setProperty(k: string, v: string) {
            properties[k] = v
            return this
          },
        }
      },
    },
    Utilities: {
      getUuid: () => randomUUID(),
      computeDigest: (_alg: unknown, value: string) => toByteArray(createHash('sha256').update(Buffer.from(value, 'utf8')).digest()),
      computeHmacSha256Signature: (value: string, key: string) =>
        toByteArray(createHmac('sha256', Buffer.from(key, 'utf8')).update(Buffer.from(value, 'utf8')).digest()),
      base64EncodeWebSafe: (bytes: number[]) => fromByteArray(bytes).toString('base64url'),
      base64DecodeWebSafe: (str: string) => toByteArray(Buffer.from(str, 'base64url')),
      newBlob: (input: string | number[]) => {
        const bytes = typeof input === 'string' ? toByteArray(Buffer.from(input, 'utf8')) : input
        return {
          getBytes: () => bytes,
          getDataAsString: () => fromByteArray(bytes).toString('utf8'),
        }
      },
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' },
    },
    LockService: {
      getScriptLock: () => ({ waitLock: () => undefined, releaseLock: () => undefined }),
    },
    ContentService: {
      MimeType: { JSON: 'JSON' },
      createTextOutput: (text: string) => ({
        _text: text,
        setMimeType() {
          return this
        },
        getContent: () => text,
      }),
    },
    Logger: { log: (msg: string) => logs.push(msg) },
    Session: { getScriptTimeZone: () => 'America/Sao_Paulo' },
  }
}

const GAS_FILES = ['Store.js', 'Auth.js', 'Logic.js', 'Router.js']

/** Fresh in-memory backend per call — no state leaks between tests. */
export function loadGasContext() {
  const mocks = createMocks()
  const context: Record<string, unknown> = { console, ...mocks }
  vm.createContext(context)

  const gasDir = path.resolve(import.meta.dirname, '..')
  for (const file of GAS_FILES) {
    const code = readFileSync(path.join(gasDir, file), 'utf-8')
    vm.runInContext(code, context, { filename: file })
  }
  return context as typeof context & Record<string, (...args: never[]) => unknown>
}
