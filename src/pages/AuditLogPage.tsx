import { useEffect, useState } from 'react'
import { AUDIT_ACTION_LABELS, AUDIT_ENTITY_LABELS, fetchAuditLog, type AuditLogEntry } from '@/lib/data/audit'

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export function AuditLogPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAuditLog()
      .then(setEntries)
      .catch(() => setError('Não foi possível carregar a auditoria agora. Confira a conexão e tente de novo.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Auditoria</h1>
        <p className="text-slate-500 dark:text-slate-400">
          Registro de operações importantes — cadastro e edição de veículo, vendas e cancelamentos.
        </p>
      </div>

      {loading && <p className="text-slate-500 dark:text-slate-400">Carregando…</p>}
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {!loading && !error && entries.length === 0 && (
        <p className="text-slate-500 dark:text-slate-400">Nenhum registro de auditoria ainda.</p>
      )}

      <ul className="space-y-2">
        {entries.map((entry) => (
          <li key={entry.id} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-50">
                  {AUDIT_ACTION_LABELS[entry.action] ?? entry.action}
                </p>
                <p className="text-xs text-slate-400">{AUDIT_ENTITY_LABELS[entry.entity_type]}</p>
              </div>
              <p className="text-xs text-slate-400">{fmtDateTime(entry.created_at)}</p>
            </div>

            {entry.diff !== null && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-slate-400">Detalhes</summary>
                <pre className="mt-1 overflow-x-auto rounded-lg bg-slate-50 p-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {JSON.stringify(entry.diff, null, 2)}
                </pre>
              </details>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
