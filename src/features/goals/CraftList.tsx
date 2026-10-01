import { CropLabel } from '../../components/game/CropLabel'
import { WikiIcon } from '../../components/game/WikiIcon'
import { getGameData } from '../../data'
import { tr } from '../../i18n/locale'
import type { GameData, Mutation } from '../../types/game'

interface Craft {
  readonly name: string
  /** Mutations qui y servent ; vide quand les données ne disent pas lesquelles. */
  readonly inputs: readonly { readonly mutation: Mutation; readonly quantity: number | null }[]
}

/** Crafts et usages des mutations, groupés par objet (ordre des données). */
function craftsOf(data: GameData): Craft[] {
  const inputsByName = new Map<string, Craft['inputs'][number][]>()
  for (const mutation of data.mutations) {
    for (const usage of mutation.usages) {
      const inputs = inputsByName.get(usage.target) ?? []
      inputs.push({ mutation, quantity: usage.quantity })
      inputsByName.set(usage.target, inputs)
    }
  }
  const known = [...inputsByName].map(([name, inputs]) => ({ name, inputs }))
  return [...known, ...data.unmappedUsages.items.filter((name) => !inputsByName.has(name)).map((name) => ({ name, inputs: [] }))]
}

/**
 * Tous les crafts qui utilisent des mutations (`usages` de chaque mutation et `unmappedUsages`),
 * avec les mutations qui y servent. Repliés par défaut : c'est une référence, pas une action.
 */
export function CraftList() {
  const crafts = craftsOf(getGameData())

  return (
    <details className="group rounded-xl border border-line bg-panel">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 hover:bg-panel-raised [&::-webkit-details-marker]:hidden">
        <h3 className="font-semibold">
          Crafts <span className="text-sm font-normal text-ink-muted">· {crafts.length}</span>
        </h3>
        <span aria-hidden="true" className="inline-block text-ink-muted transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>

      <div className="animate-fade-up border-t border-line px-4 pt-3 pb-4">
        <p className="text-sm text-ink-muted">{tr('Les crafts qui utilisent des mutations.', 'The crafts that use mutations.')}</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {crafts.map((craft) => (
            <li key={craft.name} className="rounded-lg border border-line bg-canvas/40 px-3 py-2 text-sm">
              <p className="flex items-center gap-2 font-medium">
                <WikiIcon name={craft.name} />
                {craft.name}
              </p>
              {craft.inputs.length > 0 && (
                <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                  {craft.inputs.map(({ mutation, quantity }) => (
                    <li key={mutation.id}>
                      <CropLabel crop={{ kind: 'mutation', id: mutation.id }} />
                      {quantity !== null && <span className="text-ink-muted"> × {quantity}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>
    </details>
  )
}
