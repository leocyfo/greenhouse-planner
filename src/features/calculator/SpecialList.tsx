import { CropLabel } from '../../components/game/CropLabel'
import { tr } from '../../i18n/locale'
import type { Plan } from '../../logic/recipes'

/** Mutations sans recette de voisinage : on affiche leur condition spéciale. */
export function SpecialList({ plan }: { readonly plan: Plan }) {
  return (
    <ul className="space-y-2">
      {plan.special.map((special) => (
        <li key={special.mutationId} className="rounded-lg border border-line bg-canvas/40 p-3">
          <div className="flex flex-wrap items-baseline gap-2">
            <CropLabel crop={{ kind: 'mutation', id: special.mutationId }} />
            <span className="text-sm">
              {tr('à obtenir', 'to get')} <strong className="tabular-nums">{special.missing}</strong>
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-muted">{special.text}</p>
        </li>
      ))}
    </ul>
  )
}
