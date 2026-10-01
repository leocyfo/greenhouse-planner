import { InfoTip } from '../../components/InfoTip'
import { getGameData } from '../../data'
import { tr } from '../../i18n/locale'
import type { Plan } from '../../logic/recipes'
import { cropName } from '../../components/game/recipeText'

function Purchasable({ value }: { readonly value: boolean | null }) {
  if (value === true) return <span>{tr('Oui', 'Yes')}</span>
  if (value === false) return <span>{tr('Non', 'No')}</span>
  return <span className="text-ink-muted">{tr('Inconnu', 'Unknown')}</span>
}

/** Crops de base à placer autour des recettes lancées. */
export function BaseCropList({ plan }: { readonly plan: Plan }) {
  const data = getGameData()
  if (plan.baseCrops.length === 0) return <p className="text-sm text-ink-muted">{tr('Aucun crop de base nécessaire.', 'No base crop needed.')}</p>

  return (
    <div className="space-y-2">
      {plan.optimumApplied && (
        <p className="text-xs text-ink-muted">
          {tr(
            "En mode Optimum, les crops de base restent comptés au minimum : les données n'ont pas de totaux AVRG pour eux.",
            'In Optimum mode, base crops are still counted at the minimum: the data has no AVRG totals for them.',
          )}
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead className="text-xs text-ink-muted">
            <tr className="border-b border-line">
              <th scope="col" className="py-2 pr-3 font-medium">Crop</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">{tr('Quantité', 'Quantity')}</th>
              <th scope="col" className="py-2 pr-3 font-medium">{tr('Achetable', 'Buyable')}</th>
              <th scope="col" className="py-2 font-medium">{tr('Pour', 'For')}</th>
            </tr>
          </thead>
          <tbody>
            {plan.baseCrops.map((crop) => {
              const notes = data.baseCropsByName.get(crop.name)?.notes
              return (
                <tr key={crop.name} className="border-b border-line/60 last:border-0">
                  <th scope="row" className="py-2 pr-3 font-normal">
                    <span className="inline-flex items-center gap-1">
                      {crop.name}
                      {notes && <InfoTip topic={crop.name}>{notes}</InfoTip>}
                    </span>
                  </th>
                  <td className="py-2 pr-3 text-right font-semibold tabular-nums">{crop.quantity}</td>
                  <td className="py-2 pr-3">
                    <Purchasable value={crop.purchasable} />
                  </td>
                  <td className="py-2 text-xs text-ink-muted">
                    {crop.sources
                      .map((source) => `${cropName(data, { kind: 'mutation', id: source.parentId })} × ${source.quantity}`)
                      .join(', ')}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
