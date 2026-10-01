import { CropLabel } from '../../components/game/CropLabel'
import { plural } from '../../components/labels'
import { cropName } from '../../components/game/recipeText'
import { getGameData } from '../../data'
import { tr } from '../../i18n/locale'
import { formatDuration } from '../../logic/format'
import { planProgress } from '../../logic/recipes'
import type { CalculatorResult } from './calculatorResult'

interface StatRow {
  readonly label: string
  readonly value: string
  readonly detail?: string
}

/**
 * Le calcul en liste compacte (panneau de l'Encyclopédie) : à obtenir, crops de base, temps, stock,
 * puis les alertes utiles (mutations achetées au bazar, quantités ou durées inconnues, decay).
 */
export function CalculationStats({ result }: { readonly result: CalculatorResult }) {
  const data = getGameData()
  const { plan, estimate, stageSeconds, decay } = result
  const missing = [...plan.needs.values()].filter((need) => need.missing > 0)
  const copies = missing.reduce((sum, need) => sum + need.missing, 0)
  const baseTotal = plan.baseCrops.reduce((sum, crop) => sum + crop.quantity, 0)
  const progress = planProgress(plan)
  const percent = progress.total > 0 ? Math.floor((progress.done / progress.total) * 100) : 100
  const unknownQuantities = result.unknownQuantities.map((u) => data.mutationsById.get(u.mutationId)?.name ?? u.mutationId)
  const name = (id: string) => cropName(data, { kind: 'mutation', id })

  const rows: StatRow[] = [
    { label: tr('À obtenir', 'To get'), value: plural(copies, 'mutation'), detail: missing.length > 0 ? plural(missing.length, tr('sorte', 'kind')) : undefined },
    {
      label: tr('Crops de base', 'Base crops'),
      value: String(baseTotal),
      detail: plan.baseCrops.length > 0 ? plural(plan.baseCrops.length, tr('sorte', 'kind')) : undefined,
    },
    { label: tr('Temps minimum', 'Minimum time'), value: formatDuration(estimate.criticalPathSeconds), detail: `${estimate.criticalPathStages} stages` },
    { label: tr('Tout à la suite', 'All in a row'), value: formatDuration(estimate.totalStages * stageSeconds), detail: `${estimate.totalStages} stages` },
    { label: tr('Un growth stage', 'One growth stage'), value: formatDuration(stageSeconds) },
    { label: tr('Déjà en stock', 'Already in stock'), value: tr(`${percent} %`, `${percent}%`), detail: `${progress.done} / ${progress.total}` },
  ]

  return (
    <div className="space-y-3">
      <dl className="divide-y divide-line">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3 py-1.5">
            <dt className="text-sm text-ink-muted">{row.label}</dt>
            <dd className="text-right">
              <span className="font-semibold tabular-nums">{row.value}</span>
              {row.detail && <span className="ml-1.5 text-xs text-ink-muted">{row.detail}</span>}
            </dd>
          </div>
        ))}
      </dl>

      {plan.toBuy.length > 0 && (
        <div className="text-sm">
          <p className="mb-1 text-xs text-ink-muted">{tr('À acheter au bazar (recette pas lancée) :', 'To buy at the bazaar (recipe not started):')}</p>
          <ul className="space-y-0.5">
            {plan.toBuy.map((item) => (
              <li key={item.mutationId} className="flex items-baseline justify-between gap-3">
                <CropLabel crop={{ kind: 'mutation', id: item.mutationId }} />
                <span className="tabular-nums">× {item.quantity}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {unknownQuantities.length > 0 && (
        <p className="text-xs text-warning">
          {tr(`⚠ Quantité inconnue dans les données, comptée 1 : ${unknownQuantities.join(', ')}.`, `⚠ Unknown quantity in the data, counted as 1: ${unknownQuantities.join(', ')}.`)}
        </p>
      )}
      {estimate.unknown.length > 0 && (
        <p className="text-xs text-warning">
          {tr(
            `⚠ Durée inconnue pour ${estimate.unknown.map(name).join(', ')} : comptée 0, le temps est partiel.`,
            `⚠ Unknown duration for ${estimate.unknown.map(name).join(', ')}: counted as 0, the time is partial.`,
          )}
        </p>
      )}

      {decay.length > 0 && (
        <details className="group rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
          <summary className="cursor-pointer list-none font-medium text-warning [&::-webkit-details-marker]:hidden">
            {tr(
              `⚠ Decay (~${data.mechanics.decayDays} jours) : ${plural(decay.length, 'mutation')} à replanter`,
              `⚠ Decay (~${data.mechanics.decayDays} days): ${plural(decay.length, 'mutation')} to replant`,
            )}
            <span aria-hidden="true" className="ml-1 inline-block transition-transform group-open:rotate-180">
              ▾
            </span>
          </summary>
          <p className="mt-1.5 text-ink-muted">
            {tr(
              'Leur production dure plus longtemps que la decay : les mutations posées autour mourront avant la fin.',
              'Their production lasts longer than the decay: the mutations placed around will die before the end.',
            )}
          </p>
          <ul className="mt-1 space-y-0.5 text-ink">
            {decay.map((warning) => (
              <li key={warning.mutationId} className="flex justify-between gap-3">
                <span>{name(warning.mutationId)}</span>
                <span className="tabular-nums text-ink-muted">{formatDuration(warning.productionSeconds)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
