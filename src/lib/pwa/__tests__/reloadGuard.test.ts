import { describe, expect, it } from 'vitest'
import {
  RELOAD_GUARD_WINDOW_MS,
  consumeJustUpdatedFlag,
  markReloaded,
  readLastReloadAt,
  shouldReload,
} from '../reloadGuard'

describe('shouldReload', () => {
  it('allows the first reload (no prior record)', () => {
    expect(shouldReload(null, 1000)).toBe(true)
  })

  it('refuses a second reload requested right after the first — the loop guard', () => {
    const lastReloadAt = 1_000_000
    expect(shouldReload(lastReloadAt, lastReloadAt + 1)).toBe(false)
    expect(shouldReload(lastReloadAt, lastReloadAt + RELOAD_GUARD_WINDOW_MS - 1)).toBe(false)
  })

  it('allows a reload again once the guard window has passed', () => {
    const lastReloadAt = 1_000_000
    expect(shouldReload(lastReloadAt, lastReloadAt + RELOAD_GUARD_WINDOW_MS)).toBe(true)
  })
})

function fakeStorage(): Storage {
  const store = new Map<string, string>()
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    key: () => null,
    get length() {
      return store.size
    },
  }
}

describe('readLastReloadAt / markReloaded', () => {
  it('reads back what markReloaded wrote', () => {
    const storage = fakeStorage()
    expect(readLastReloadAt(storage)).toBeNull()
    markReloaded(storage, 42)
    expect(readLastReloadAt(storage)).toBe(42)
  })

  it('does not throw when storage access fails (e.g. private mode)', () => {
    const throwingStorage: Storage = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
      clear: () => {},
      key: () => null,
      length: 0,
    }
    expect(() => markReloaded(throwingStorage, 1)).not.toThrow()
    expect(readLastReloadAt(throwingStorage)).toBeNull()
  })
})

describe('consumeJustUpdatedFlag', () => {
  it('is false until markReloaded sets it, then true exactly once', () => {
    const storage = fakeStorage()
    expect(consumeJustUpdatedFlag(storage)).toBe(false)

    markReloaded(storage, 1)
    expect(consumeJustUpdatedFlag(storage)).toBe(true)
    expect(consumeJustUpdatedFlag(storage)).toBe(false)
  })
})
