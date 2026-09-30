import type { DataIssue } from '../types/game'

interface DataErrorScreenProps {
  readonly issues: readonly DataIssue[]
}

/** Affiché à la place de l'application quand src/data/mutations.json ne passe pas la validation. */
export function DataErrorScreen({ issues }: DataErrorScreenProps) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-xl font-semibold text-danger">Les données du jeu sont invalides</h1>
      <p className="mt-2 text-ink-muted">
        Corrige <code className="rounded bg-panel-raised px-1.5 py-0.5 text-ink">src/data/mutations.json</code>{' '}
        puis recharge la page. {issues.length} problème{issues.length > 1 ? 's' : ''} trouvé
        {issues.length > 1 ? 's' : ''} :
      </p>
      <ul className="mt-6 space-y-2">
        {issues.map((issue, index) => (
          <li key={index} className="rounded-lg border border-line bg-panel px-4 py-3">
            <code className="block text-sm break-all text-warning">{issue.path}</code>
            <span className="mt-1 block text-sm">{issue.message}</span>
          </li>
        ))}
      </ul>
    </main>
  )
}
