import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppUpdate } from '../useAppUpdate'

interface CapturedOptions {
  immediate?: boolean
  onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration | undefined) => void
  onNeedReload?: () => void
}

const mockUseRegisterSW = vi.fn()
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: (options: CapturedOptions) => mockUseRegisterSW(options),
}))

function setup() {
  let captured: CapturedOptions = {}
  mockUseRegisterSW.mockImplementation((options: CapturedOptions) => {
    captured = options
    return {
      needRefresh: [false, vi.fn()],
      offlineReady: [false, vi.fn()],
      updateServiceWorker: vi.fn(),
    }
  })
  const view = renderHook(() => useAppUpdate())
  return { view, getCaptured: () => captured }
}

let reloadMock: ReturnType<typeof vi.fn>

describe('useAppUpdate', () => {
  beforeEach(() => {
    mockUseRegisterSW.mockReset()
    sessionStorage.clear()
    reloadMock = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload: reloadMock },
    })
  })

  it('reloads exactly once when the service worker reports it needs a reload', () => {
    const { getCaptured } = setup()
    getCaptured().onNeedReload?.()
    expect(reloadMock).toHaveBeenCalledTimes(1)
  })

  it('refuses a second reload requested immediately after — protection against a reload loop', () => {
    const { getCaptured } = setup()
    getCaptured().onNeedReload?.()
    getCaptured().onNeedReload?.()
    getCaptured().onNeedReload?.()
    expect(reloadMock).toHaveBeenCalledTimes(1)
  })

  it('checks for an update via registration.update() when the tab becomes visible', () => {
    const update = vi.fn().mockResolvedValue(undefined)
    const { getCaptured } = setup()
    getCaptured().onRegisteredSW?.('/sw.js', { update } as unknown as ServiceWorkerRegistration)

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    expect(update).toHaveBeenCalled()
  })

  it('checks for an update when the window comes back online', () => {
    const update = vi.fn().mockResolvedValue(undefined)
    const { getCaptured } = setup()
    getCaptured().onRegisteredSW?.('/sw.js', { update } as unknown as ServiceWorkerRegistration)

    window.dispatchEvent(new Event('online'))

    expect(update).toHaveBeenCalled()
  })

  it('does not blow up when the registration is undefined', () => {
    const { getCaptured } = setup()
    expect(() => getCaptured().onRegisteredSW?.('/sw.js', undefined)).not.toThrow()
  })

  it('shows the "Polly atualizado" toast right after a reload it triggered', () => {
    sessionStorage.setItem('polly:pwa-just-updated', '1')
    const { view } = setup()
    expect(view.result.current.showUpdatedToast).toBe(true)
  })

  it('does not show the toast on an ordinary load with no pending update', () => {
    const { view } = setup()
    expect(view.result.current.showUpdatedToast).toBe(false)
  })
})
