import { GoalToggleChips } from '../../components/game/GoalToggleChips'
import { useAppStore } from '../../store/appStore'

/** Objectifs pris en compte dans les besoins de l'inventaire. */
export function GoalChips() {
  const activeGoals = useAppStore((s) => s.progress.activeGoals)
  const setGoalActive = useAppStore((s) => s.setGoalActive)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-ink-muted">Objectifs :</span>
      <GoalToggleChips selected={activeGoals} onToggle={setGoalActive} label="Objectifs pris en compte" />
    </div>
  )
}
