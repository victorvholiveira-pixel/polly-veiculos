import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearToken, setToken } from '../authToken'

describe('callApi', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_APPS_SCRIPT_URL', 'https://script.google.com/macros/s/fake/exec')
    clearToken()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('POSTs as text/plain (avoids a CORS preflight) with the action, params, and stored token', async () => {
    setToken('the-token')
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { ok: true } }) })
    vi.stubGlobal('fetch', fetchMock)

    vi.resetModules()
    const { callApi } = await import('../api')
    const result = await callApi<{ ok: boolean }>('fetchVehicles', { status: 'all' })

    expect(result).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://script.google.com/macros/s/fake/exec')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['Content-Type']).toMatch(/text\/plain/)
    const body = JSON.parse(init.body as string) as { action: string; status: string; token: string }
    expect(body).toEqual({ action: 'fetchVehicles', status: 'all', token: 'the-token' })
  })

  it('unwraps a backend {error} into a thrown ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ error: 'venda não encontrada' }) }))

    vi.resetModules()
    const { callApi, ApiError } = await import('../api')
    await expect(callApi('cancelSale', { saleId: 'x' })).rejects.toThrow(ApiError)
    await expect(callApi('cancelSale', { saleId: 'x' })).rejects.toThrow('venda não encontrada')
  })

  it('throws a clear error instead of hanging when VITE_APPS_SCRIPT_URL is unset', async () => {
    vi.stubEnv('VITE_APPS_SCRIPT_URL', '')
    vi.resetModules()
    const { callApi } = await import('../api')
    await expect(callApi('fetchVehicles')).rejects.toThrow(/não configurada/)
  })
})
