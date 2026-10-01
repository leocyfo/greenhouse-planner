import { formatDuration } from '../../logic/format'
import { plural } from '../../components/labels'
import { tr } from '../../i18n/locale'
import { planProgress } from '../../logic/recipes'
import type { CalculatorResult } from './calculatorResult'

/** Chiffres clés du résultat. */
export function ResultSummary({ result }: { readonly result: CalculatorResult }) {
  const { plan, estimate } = result
  const missing = [...plan.needs.values()].filter((need) => need.missing > 0)
  const copies = missing.reduce((sum, need) => sum + need.missing, 0)
  const baseTotal = plan.baseCrops.reduce((sum, crop) => sum + crop.quantity, 0)
  const progress = planProgress(plan)
  const percent = progress.total > 0 ? Math.floor((progress.done / progress.total) * 100) : 100

  const bought = plan.toBuy.length > 0 ? tr(` · ${plan.toBuy.length} au bazar`, ` · ${plan.toBuy.length} at the bazaar`) : ''
  const cards = [
    {
      label: tr('À obtenir', 'To get'),
      value: plural(copies, 'mutation'),
      detail: plural(missing.length, tr('sorte', 'kind')) + bought,
    },
    {
      label: tr('Crops de base', 'Base crops'),
      value: `${plan.baseCrops.length} types`,
      detail: tr(`${baseTotal} au total`, `${baseTotal} in total`),
    },
    {
      label: tr('Temps minimum', 'Minimum time'),
      value: formatDuration(estimate.criticalPathSeconds),
      detail: `${estimate.criticalPathStages} stages${estimate.unknown.length > 0 ? tr(' · estimation partielle', ' · partial estimate') : ''}`,
    },
    {
      label: tr('Déjà en stock', 'Already in stock'),
      value: tr(`${percent} %`, `${percent}%`),
      detail: `${progress.done} / ${progress.total} mutations`,
    },
  ]

  return (
    <dl className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-line bg-panel px-4 py-3">
          <dt className="text-xs text-ink-muted">{card.label}</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums">{card.value}</dd>
          <dd className="text-xs text-ink-muted">{card.detail}</dd>
        </div>
      ))}
    </dl>
  )
}
