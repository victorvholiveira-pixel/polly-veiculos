/**
 * Guards the PWA's controlled auto-reload (registerType: 'autoUpdate') against
 * looping. Workbox tells us a new service worker just activated via
 * `onNeedReload` — normally a one-time event per real deploy, but if
 * something were ever wrong (e.g. a broken precache manifest that never
 * satisfies as "up to date"), the same event could keep firing right after
 * each reload. Refusing a reload that follows another one too closely turns
 * that failure mode into "stuck on the current tab" instead of an infinite
 * reload loop — worse than not updating, but recoverable, whereas a loop
 * isn't.
 *
 * Kept as pure functions over an injected `Storage` (not hardwired to
 * `sessionStorage`) so the loop-guard decision is unit-testable without a
 * DOM, and reused in the "reload used sessionStorage in a private tab"
 * edge case sessionStorage access can throw.
 */

export const RELOAD_GUARD_WINDOW_MS = 10_000

const LAST_RELOAD_KEY = 'polly:pwa-last-reload-at'
const JUST_UPDATED_KEY = 'polly:pwa-just-updated'

/** True when it's safe to reload for an update — i.e. we didn't just do it. */
export function shouldReload(lastReloadAt: number | null, now: number): boolean {
  if (lastReloadAt === null) return true
  return now - lastReloadAt >= RELOAD_GUARD_WINDOW_MS
}

export function readLastReloadAt(storage: Storage): number | null {
  try {
    const raw = storage.getItem(LAST_RELOAD_KEY)
    return raw ? Number(raw) : null
  } catch {
    return null
  }
}

/** Records the reload (for the loop guard) and arms the post-reload "Polly atualizado ✓" toast. */
export function markReloaded(storage: Storage, now: number): void {
  try {
    storage.setItem(LAST_RELOAD_KEY, String(now))
    storage.setItem(JUST_UPDATED_KEY, '1')
  } catch {
    // Storage unavailable (private mode, quota) — the reload still proceeds
    // in the caller; we just lose the loop guard and toast for this cycle.
  }
}

/** Reads-and-clears the "just updated" flag — call once per app load. */
export function consumeJustUpdatedFlag(storage: Storage): boolean {
  try {
    const flag = storage.getItem(JUST_UPDATED_KEY)
    if (flag) storage.removeItem(JUST_UPDATED_KEY)
    return Boolean(flag)
  } catch {
    return false
  }
}
