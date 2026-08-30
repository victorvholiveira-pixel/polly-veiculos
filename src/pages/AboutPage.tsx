import { Card } from '@/components/ui/Card'

/** Mais → Sobre — build identity for diagnosing "estou preso numa versão antiga" reports. */
export function AboutPage() {
  const sha = __APP_BUILD_SHA__
  const shortSha = sha === 'dev' ? 'dev (local)' : sha.slice(0, 7)
  const buildTime = new Date(__APP_BUILD_TIME__).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Sobre</h1>
        <p className="text-slate-500 dark:text-slate-400">Identificação desta versão instalada, para diagnóstico.</p>
      </div>

      <Card>
        <dl className="space-y-3">
          <Field label="Versão (commit)" value={shortSha} mono />
          <Field label="Build gerado em" value={buildTime} />
        </dl>
      </Card>

      <p className="text-sm text-slate-500 dark:text-slate-400">
        O Polly atualiza sozinho: ao voltar ao app, ele confere se há uma versão nova e, se houver, recarrega
        automaticamente. Se dois aparelhos mostrarem commits diferentes por muito tempo, é sinal de algo errado
        nessa atualização — não é preciso limpar o cache manualmente.
      </p>
    </div>
  )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className={`text-sm font-semibold text-slate-900 dark:text-slate-50 ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  )
}
