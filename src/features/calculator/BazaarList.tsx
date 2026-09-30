import { CropLabel } from '../../components/game/CropLabel'
import type { Plan } from '../../logic/recipes'

/** Mutations analysées achetées au bazar au lieu d'être cultivées (option du bazar). */
export function BazaarList({ plan }: { readonly plan: Plan }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-ink-muted">
        Leur recette n&apos;est pas lancée : leurs ingrédients ne sont pas comptés dans les besoins.
      </p>
      <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
        {plan.toBuy.map((item) => (
          <li key={item.mutationId} className="flex items-baseline justify-between gap-3 text-sm">
            <CropLabel crop={{ kind: 'mutation', id: item.mutationId }} />
            <span className="tabular-nums">× {item.quantity}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
