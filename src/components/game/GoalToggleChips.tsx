import { getGameData } from '../../data'

interface GoalToggleChipsProps {
  /** Ids des objectifs sélectionnés. */
  readonly selected: readonly string[]
  readonly onToggle: (goalId: string, selected: boolean) => void
  /** Nom accessible du groupe. */
  readonly label: string
}

/** Objectifs sélectionnables d'un clic (boutons à bascule). */
export function GoalToggleChips({ selected, onToggle, label }: GoalToggleChipsProps) {
  const goals = getGameData().goals
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={label}>
      {goals.map((goal) => {
        const active = selected.includes(goal.id)
        return (
          <button
            key={goal.id}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(goal.id, !active)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
              active
                ? 'border-accent/60 bg-accent/15 text-ink'
                : 'border-line text-ink-muted hover:border-ink-muted hover:text-ink'
            }`}
          >
            <span aria-hidden="true">{active ? '✓' : '+'}</span>
            {goal.name}
          </button>
        )
      })}
    </div>
  )
}
