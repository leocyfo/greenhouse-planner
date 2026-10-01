import { useId, type Ref } from 'react'
import type { GoalStatus } from '../../store/useGoalStatuses'
import { tr } from '../../i18n/locale'
import { GoalRow } from './GoalRow'

interface GoalsSectionProps {
  readonly statuses: readonly GoalStatus[]
  /** Titre de la section, pour y amener le focus (bouton « Choisir mes objectifs »). */
  readonly headingRef?: Ref<HTMLHeadingElement>
}

/** Objectifs du tableau de bord : une ligne cochable par objectif, détail à déplier. */
export function GoalsSection({ statuses, headingRef }: GoalsSectionProps) {
  const headingId = useId()
  const followed = statuses.filter((status) => status.active).length

  return (
    <section aria-labelledby={headingId} className="rounded-xl border border-line bg-panel p-4">
      <h3 id={headingId} ref={headingRef} tabIndex={-1} className="font-semibold">
        {tr('Objectifs', 'Goals')}{' '}
        <span className="text-sm font-normal text-ink-muted">
          · {tr(`${followed} suivi${followed > 1 ? 's' : ''} sur ${statuses.length}`, `${followed} followed out of ${statuses.length}`)}
        </span>
      </h3>
      <p className="mt-1 text-xs text-ink-muted">
        {tr(
          "Coche ceux à suivre : leurs besoins guident la prochaine action, l'Inventaire et l'Encyclopédie.",
          'Tick the ones to follow: their needs drive the next action, the Inventory and the Encyclopedia.',
        )}
      </p>
      <ul className="mt-2 divide-y divide-line">
        {statuses.map((status) => (
          <GoalRow key={status.goal.id} status={status} />
        ))}
      </ul>
    </section>
  )
}
