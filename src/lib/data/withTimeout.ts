/**
 * Races a promise against a timeout. Used to bound how long the Review
 * Center waits on Supabase before falling back to the offline demo fixture —
 * without this, postgrest-js's own retry-with-backoff on a genuinely
 * unreachable host takes ~10s before the caller's `catch` ever runs, which
 * reads as the app being stuck, not gracefully degrading.
 */
export function withTimeout<T>(promise: PromiseLike<T>, ms = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err: unknown) => {
        clearTimeout(timer)
        reject(err instanceof Error ? err : new Error(String(err)))
      },
    )
  })
}

/**
 * True only for errors that mean Supabase itself could not be reached — our
 * own withTimeout() timeout above, or a fetch-level network failure (no
 * connection, DNS, offline). A `PostgrestError` is a real response FROM
 * Supabase — even when it's an error one (RLS denial, missing column, bad
 * query) — and must never be treated as "unreachable": doing so would mask a
 * real permission/schema bug behind a misleading offline/demo state instead
 * of surfacing it.
 */
export function isUnreachableError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  if (err.name === 'PostgrestError') return false
  if (err.message.startsWith('Timed out after')) return true
  return err instanceof TypeError
}
