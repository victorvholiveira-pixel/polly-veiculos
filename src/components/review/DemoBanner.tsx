export function DemoBanner() {
  return (
    <div
      role="status"
      className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
    >
      <strong className="font-semibold">Modo de demonstração.</strong> Sem conexão com o banco agora —
      mostrando dados reais da última migração, mas as decisões desta tela não são salvas.
    </div>
  )
}
