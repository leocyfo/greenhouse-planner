import { useAppStore } from '../../store/appStore'
import { tr } from '../../i18n/locale'
import type { GoalPlan } from '../../store/useGoalPlan'
import { GoalChips } from './GoalChips'

/** Objectifs pris en compte dans les besoins, et ce qui explique des besoins à zéro ou au minimum. */
export function InventoryHeader({ goalPlan }: { readonly goalPlan: GoalPlan }) {
  const planMode = useAppStore((s) => s.settings.planMode)
  const hasGoals = useAppStore((s) => s.progress.activeGoals.length > 0)
  const { plan } = goalPlan

  return (
    <header className="space-y-4">
      <h2 className="sr-only">{tr('Inventaire', 'Inventory')}</h2>
      <GoalChips />
      {!hasGoals && (
        <p className="text-sm text-ink-muted">{tr('Aucun objectif coché : les besoins sont à zéro.', 'No goal ticked: all needs are zero.')}</p>
      )}
      {hasGoals && planMode === 'optimum' && !plan.optimumApplied && (
        <p className="text-sm text-ink-muted">
          {tr(
            'Aucun objectif coché ne suit la route AVRG : les besoins sont calculés en mode Minimum.',
            'No ticked goal follows the AVRG route: needs are calculated in Minimum mode.',
          )}
        </p>
      )}
    </header>
  )
}
