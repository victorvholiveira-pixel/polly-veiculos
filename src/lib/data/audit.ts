import { callApi } from '@/lib/api'
import type { AuditLogEntry } from '@/types/api'

export type { AuditLogEntry }

/** Read-only trilha de auditoria (Onda 6) — grava só via as ações de Logic.js, nunca pelo app direto. */
export async function fetchAuditLog(limit = 100): Promise<AuditLogEntry[]> {
  return callApi<AuditLogEntry[]>('fetchAuditLog', { limit })
}
