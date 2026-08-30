import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { consumeJustUpdatedFlag, markReloaded, readLastReloadAt, shouldReload } from './reloadGuard'

const TOAST_DURATION_MS = 4000

/**
 * Wires the PWA's auto-update lifecycle end to end: registerType:
 * 'autoUpdate' (see vite.config.ts) means a new service worker installs,
 * calls skipWaiting/clientsClaim, and takes over on its own — this hook only
 * needs to (a) ask for update checks at the right moments and (b) reload the
 * page once the new worker is in control, safely.
 *
 * No manual "update available" button: the user asked for updates to just
 * happen, not for another thing to tap.
 */
export function useAppUpdate(): { showUpdatedToast: boolean } {
  // Lazy initializer (not an effect): reads-and-clears the flag exactly once,
  // on this component's first render, rather than dispatching a synchronous
  // setState from inside an effect body.
  const [showUpdatedToast, setShowUpdatedToast] = useState(() => consumeJustUpdatedFlag(sessionStorage))

  useRegisterSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return
      // Event-driven only (open + foreground + back online) — never an
      // interval, per the "sem polling agressivo" requirement. The browser
      // already checks for a new SW script on its own at most once/24h on
      // navigation, which barely matters for an SPA that navigates client-side
      // after the first load — these are what actually catch a new deploy.
      const checkForUpdate = () => {
        registration.update().catch(() => {})
      }
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkForUpdate()
      })
      window.addEventListener('focus', checkForUpdate)
      window.addEventListener('online', checkForUpdate)
    },
    onNeedReload() {
      const now = Date.now()
      if (!shouldReload(readLastReloadAt(sessionStorage), now)) return
      markReloaded(sessionStorage, now)
      window.location.reload()
    },
  })

  useEffect(() => {
    if (!showUpdatedToast) return
    const timer = setTimeout(() => setShowUpdatedToast(false), TOAST_DURATION_MS)
    return () => clearTimeout(timer)
  }, [showUpdatedToast])

  return { showUpdatedToast }
}
