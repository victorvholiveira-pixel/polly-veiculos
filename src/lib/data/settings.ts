import { callApi } from '@/lib/api'
import type { AppSettings } from '@/types/api'

export type { AppSettings }

export async function fetchAppSettings(): Promise<AppSettings> {
  return callApi<AppSettings>('fetchAppSettings')
}

/**
 * `default_commission_pct` is only ever a suggested starting value for the
 * sale form's commission field — never applied automatically. See
 * ROADMAP.md's "Comissão" section: no calculation rule has been invented.
 */
export async function updateDefaultCommissionPct(pct: number | null): Promise<AppSettings> {
  return callApi<AppSettings>('updateDefaultCommissionPct', { pct })
}
