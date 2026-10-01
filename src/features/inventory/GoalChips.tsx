import { GoalToggleChips } from '../../components/game/GoalToggleChips'
import { useAppStore } from '../../store/appStore'
import { tr } from '../../i18n/locale'

/** Objectifs pris en compte dans les besoins de l'inventaire. */
export function GoalChips() {
  const activeGoals = useAppStore((s) => s.progress.activeGoals)
  const setGoalActive = useAppStore((s) => s.setGoalActive)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-ink-muted">{tr('Objectifs :', 'Goals:')}</span>
      <GoalToggleChips selected={activeGoals} onToggle={setGoalActive} label={tr('Objectifs pris en compte', 'Goals taken into account')} />
    </div>
  )
}
