import { CropLabel } from '../../components/game/CropLabel'
import { getGameData } from '../../data'
import { tr } from '../../i18n/locale'

/**
 * Usages cités par la communauté, à confirmer (`unmappedUsages` et usages non vérifiés). Repliés
 * par défaut : c'est une référence, pas une action.
 */
export function UnconfirmedUsages() {
  const data = getGameData()
  const knownUnverified = data.mutations.flatMap((mutation) =>
    mutation.usages.filter((usage) => !usage.verified).map((usage) => ({ mutation, usage })),
  )
  const count = data.unmappedUsages.items.length + knownUnverified.length

  return (
    <details className="group rounded-xl border border-line bg-panel">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 hover:bg-panel-raised [&::-webkit-details-marker]:hidden">
        <h3 className="font-semibold">
          {tr('Usages à confirmer', 'Uses to confirm')} <span className="text-sm font-normal text-ink-muted">· {count}</span>
        </h3>
        <span aria-hidden="true" className="inline-block text-ink-muted transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>

      <div className="animate-fade-up border-t border-line px-4 pt-3 pb-4">
        <p className="text-sm text-ink-muted">{data.unmappedUsages.description}</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {data.unmappedUsages.items.map((item) => (
            <li key={item} className="flex items-center gap-2 rounded-lg border border-line bg-canvas/40 px-3 py-1.5 text-sm">
              {item}
            </li>
          ))}
        </ul>

        {knownUnverified.length > 0 && (
          <div className="mt-4">
            <h4 className="mb-2 text-xs font-medium text-ink-muted">
              {tr('Usages connus, dont la quantité reste à confirmer', 'Known uses whose quantity is still to confirm')}
            </h4>
            <ul className="space-y-1 text-sm">
              {knownUnverified.map(({ mutation, usage }) => (
                <li key={`${mutation.id}-${usage.target}`}>
                  <CropLabel crop={{ kind: 'mutation', id: mutation.id }} />
                  <span className="text-ink-muted"> → </span>
                  {usage.target}
                  <span className="text-ink-muted">
                    {usage.quantity === null ? tr(' (quantité inconnue)', ' (unknown quantity)') : ` × ${usage.quantity}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  )
}
