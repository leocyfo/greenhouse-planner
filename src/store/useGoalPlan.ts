import { useMemo } from 'react'
import { getGameData } from '../data'
import { mergeGoalTargets, type GoalTargets } from '../logic/goals'
import { bazaarBuyable, computePlan, type Plan } from '../logic/recipes'
import { useAppStore } from './appStore'

export interface GoalPlan {
  readonly goalTargets: GoalTargets
  readonly plan: Plan
  /** Ids des mutations analysées, pour des tests d'appartenance rapides. */
  readonly analyzed: ReadonlySet<string>
}

/**
 * Plan des objectifs cochés, recalculé quand l'inventaire, les objectifs, les analyses ou les
 * réglages changent. Partagé par l'Inventaire, le Tableau de bord et les Objectifs.
 */
export function useGoalPlan(): GoalPlan {
  const inventory = useAppStore((s) => s.progress.inventory)
  const analyzedIds = useAppStore((s) => s.progress.analyzed)
  const activeGoals = useAppStore((s) => s.progress.activeGoals)
  const planMode = useAppStore((s) => s.settings.planMode)
  const analyzedBuyable = useAppStore((s) => s.settings.analyzedBuyable)

  return useMemo(() => {
    const data = getGameData()
    const analyzed = new Set(analyzedIds)
    const goalTargets = mergeGoalTargets(data, new Set(activeGoals), analyzed)
    const plan = computePlan(data, {
      targets: goalTargets.targets,
      inventory,
      mode: planMode,
      route: goalTargets.route,
      buyable: bazaarBuyable(analyzed, analyzedBuyable),
    })
    return { goalTargets, plan, analyzed }
  }, [inventory, analyzedIds, activeGoals, planMode, analyzedBuyable])
}
