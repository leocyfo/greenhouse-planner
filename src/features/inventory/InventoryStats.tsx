import { getGameData } from '../../data'
import type { GoalPlan } from '../../store/useGoalPlan'

/** Chiffres clés : en ligne sur mobile, empilés dans la colonne à côté du sac sur grand écran. */
export function InventoryStats({ goalPlan }: { readonly goalPlan: GoalPlan }) {
  const data = getGameData()
  const { plan, analyzed } = goalPlan

  const needs = [...plan.needs.values()]
  const missing = needs.filter((need) => need.missing > 0).length
  const stats = [
    { label: 'Analysées', value: `${data.mutations.filter((m) => analyzed.has(m.id)).length} / ${data.mutations.length}` },
    { label: 'À obtenir', value: String(missing) },
    { label: 'Complétées', value: `${needs.length - missing} / ${needs.length}` },
  ]

  return (
    <dl className="grid grid-cols-3 divide-x divide-line rounded-xl border border-line bg-panel lg:grid-cols-1 lg:divide-x-0 lg:divide-y">
      {stats.map((stat) => (
        <div key={stat.label} className="px-4 py-3 lg:flex lg:items-baseline lg:justify-between lg:py-2">
          <dt className="text-xs text-ink-muted">{stat.label}</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums lg:mt-0 lg:text-base">{stat.value}</dd>
        </div>
      ))}
    </dl>
  )
}
