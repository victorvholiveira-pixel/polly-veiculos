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
