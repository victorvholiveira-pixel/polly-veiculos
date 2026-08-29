import { getToken } from './authToken'

/**
 * Cliente único do backend (Google Apps Script Web App). Nenhum outro lugar
 * do código deve chamar `fetch` no endpoint diretamente — sempre por aqui,
 * para manter a anexação do token e o tratamento de erro consistentes.
 *
 * O corpo vai como `text/plain`, não `application/json`, de propósito: isso
 * evita o preflight CORS (OPTIONS) que o Apps Script Web App não responde de
 * forma configurável — ver gas/Router.js.
 */

const API_URL = import.meta.env.VITE_APPS_SCRIPT_URL as string | undefined

export class ApiError extends Error {}

// Apps Script cold starts can take a few seconds — longer than a typical API,
// but a hung request should still fail fast enough for the Review Center's
// offline-fixture fallback to kick in instead of leaving the screen stuck.
const TIMEOUT_MS = 10000

export async function callApi<T>(action: string, params: object = {}): Promise<T> {
  if (!API_URL) {
    throw new ApiError('VITE_APPS_SCRIPT_URL não configurada. Copie .env.example para .env e preencha a URL do Web App.')
  }

  const token = getToken()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: action, token: token ?? undefined, ...params }),
      signal: controller.signal,
    })
  } catch (err) {
    throw new ApiError(err instanceof Error && err.name === 'AbortError' ? 'Tempo esgotado ao falar com o servidor' : 'Falha de conexão com o servidor')
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    throw new ApiError(`Falha de conexão com o servidor (HTTP ${res.status})`)
  }

  const json = (await res.json()) as { data?: T; error?: string }
  if (json.error) throw new ApiError(json.error)
  return json.data as T
}
