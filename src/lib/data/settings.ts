import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import { withTimeout } from './withTimeout'

export type AppSettings = Database['public']['Tables']['app_settings']['Row']

export async function fetchAppSettings(): Promise<AppSettings> {
  const { data, error } = await withTimeout(supabase.from('app_settings').select('*').single())
  if (error) throw error
  return data
}

/**
 * `default_commission_pct` is only ever a suggested starting value for the
 * sale form's commission field — never applied automatically. See
 * ROADMAP.md's "Comissão" section: no calculation rule has been invented.
 */
export async function updateDefaultCommissionPct(pct: number | null): Promise<AppSettings> {
  const { data, error } = await supabase.from('app_settings').update({ default_commission_pct: pct }).eq('id', true).select().single()
  if (error) throw error
  return data
}
