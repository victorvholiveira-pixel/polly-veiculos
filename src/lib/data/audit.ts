import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import { withTimeout } from './withTimeout'

export type AuditLogEntry = Database['public']['Tables']['audit_log']['Row']

/** Single source of truth for how an entity_type reads in Portuguese — used by
 * AuditLogPage and the Home dashboard's "últimas movimentações" alike. */
export const AUDIT_ENTITY_LABELS: Record<AuditLogEntry['entity_type'], string> = {
  vehicle: 'Veículo',
  sale: 'Venda',
  vehicle_occurrence: 'Revisão da migração',
  settings: 'Configurações',
}

/** Same for action — see the entity_type comment above. */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  vehicle_created: 'Veículo cadastrado',
  vehicle_updated: 'Veículo editado',
  sale_registered: 'Venda registrada',
  sale_cancelled: 'Venda cancelada',
  created_from_migration: 'Entrada de veículo (migração)',
}

/** Read-only trilha de auditoria (Onda 6) — grava só via RPC/trigger, nunca pelo app. */
export async function fetchAuditLog(limit = 100): Promise<AuditLogEntry[]> {
  const { data, error } = await withTimeout(
    supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(limit),
  )
  if (error) throw error
  return data
}
