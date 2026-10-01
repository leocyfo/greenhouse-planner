/** Choix d'un objectif à calculer dans l'Encyclopédie (sur tout l'arbre). */
import { WikiIcon } from '../../components/game/WikiIcon'
import { getGameData } from '../../data'
import { tr } from '../../i18n/locale'

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
