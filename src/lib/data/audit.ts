import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import { withTimeout } from './withTimeout'

export type AuditLogEntry = Database['public']['Tables']['audit_log']['Row']

/** Read-only trilha de auditoria (Onda 6) — grava só via RPC/trigger, nunca pelo app. */
export async function fetchAuditLog(limit = 100): Promise<AuditLogEntry[]> {
  const { data, error } = await withTimeout(
    supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(limit),
  )
  if (error) throw error
  return data
}
