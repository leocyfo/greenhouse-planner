/**
 * Calcul d'un objectif dans l'Encyclopédie : le choix de l'objectif (tout l'arbre), puis, une fois
 * choisi, la barre au-dessus de son arbre (ce qu'il demande, les colonnes, retour à tout l'arbre).
 */
import type { ReactNode } from 'react'
import { WikiIcon } from '../../components/game/WikiIcon'
import { formatGoalType } from '../../components/labels'
import { getGameData } from '../../data'
import { tr } from '../../i18n/locale'
import { TREE_COLORS } from '../../theme/palette'

/** Les objectifs des données, à calculer d'un clic (Rose Dragon, crafts, shards…). */
export function GoalPicker({ onChoose }: { readonly onChoose: (goalId: string) => void }) {
  const goals = getGameData().goals
  return (
    <div className="flex flex-col gap-1 text-xs text-ink-muted">
      <span aria-hidden="true">{tr('Calculer un objectif', 'Calculate a goal')}</span>
      <div role="group" aria-label={tr('Calculer un objectif', 'Calculate a goal')} className="flex flex-wrap gap-2">
        {goals.map((goal) => (
          <button
            key={goal.id}
            type="button"
            onClick={() => onChoose(goal.id)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-panel px-3 text-sm text-ink transition-colors hover:border-accent/60 hover:bg-panel-raised"
          >
            <WikiIcon name={goal.name} size={18} />
            {goal.name}
          </button>
        ))}
      </div>
    </div>
  )
}

interface GoalBarProps {
  readonly goalId: string
  /** Mutations demandées par l'objectif (déjà filtrées : pas encore analysées pour « Analyser »). */
  readonly targetIds: readonly string[]
  /** L'arbre est affiché, avec le total de chaque mutation (×N). */
  readonly showsTotals: boolean
  /** Le choix des colonnes. */
  readonly controls?: ReactNode
  /** Retour à tout l'arbre. */
  readonly onClear: () => void
}

/** Au-dessus de l'arbre d'un objectif : son nom, ce qu'il demande et le retour à tout l'arbre. */
export function GoalBar({ goalId, targetIds, showsTotals, controls, onClear }: GoalBarProps) {
  const data = getGameData()
  const goal = data.goals.find((g) => g.id === goalId)
  if (!goal) return null
  const name = (id: string) => data.mutationsById.get(id)?.name ?? id
  const asked =
    goal.eachMutation !== null
      ? tr(
          `${goal.eachMutation} de chaque mutation pas encore analysée (${targetIds.length})`,
          `${goal.eachMutation} of each mutation not analyzed yet (${targetIds.length})`,
        )
      : goal.mutations.map((m) => `${name(m.mutationId)}${m.quantity === null ? '' : ` ×${m.quantity}`}`).join(' · ')

  return (
    <div className="rounded-lg border border-line bg-panel px-3 py-1.5 text-xs leading-[1.35rem]">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
        <p className="flex min-w-0 flex-wrap items-center gap-x-1.5">
          <WikiIcon name={goal.name} size={16} />
          <strong className="text-sm">{goal.name}</strong>
          <span className="text-ink-muted">· {formatGoalType(goal.type)}</span>
          {showsTotals && (
            <span className="text-ink-muted">
              · <span style={{ color: TREE_COLORS.path }}>×N</span>{' '}
              {tr("= total pour l'objectif, sans compter ton stock", '= total for the goal, not counting your stock')}
            </span>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {controls}
          <button
            type="button"
            onClick={onClear}
            title={tr('Échap', 'Esc')}
            className="h-8 rounded-lg border border-line px-3 text-sm text-ink-muted transition-colors hover:text-ink"
          >
            {tr("Tout l'arbre", 'Whole tree')}
          </button>
        </div>
      </div>
      <p className="truncate" title={asked}>
        <span className="font-semibold" style={{ color: TREE_COLORS.path }}>
          {tr('Demande', 'Needs')}
        </span>
        {tr(' : ', ': ')}
        {asked}
      </p>
    </div>
  )
}
