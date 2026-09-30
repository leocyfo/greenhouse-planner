import { useMemo } from 'react'
import { getGameData } from '../data'
import { goalCompletion, goalProgress, planForGoal, type GoalCompletion } from '../logic/goals'
import { bazaarBuyable, type Plan } from '../logic/recipes'
import type { Goal } from '../types/game'
import { useAppStore } from './appStore'

export interface GoalStatus {
  readonly goal: Goal
  readonly active: boolean
  /** Avancement complet (ingrédients compris, ou analyses). */
  readonly completion: GoalCompletion
  /** Mutations demandées directement, déjà en stock. */
  readonly direct: { readonly done: number; readonly total: number }
  /** Plan de cet objectif seul (pour savoir à quels objectifs sert une mutation). */
  readonly plan: Plan
}

/** État de chaque objectif du JSON, cochés ou non, dans l'ordre des données. */
export function useGoalStatuses(): readonly GoalStatus[] {
  const inventory = useAppStore((s) => s.progress.inventory)
  const analyzedIds = useAppStore((s) => s.progress.analyzed)
  const activeGoals = useAppStore((s) => s.progress.activeGoals)
  const mode = useAppStore((s) => s.settings.planMode)
  const analyzedBuyable = useAppStore((s) => s.settings.analyzedBuyable)

  return useMemo(() => {
    const data = getGameData()
    const analyzed = new Set(analyzedIds)
    const buyable = bazaarBuyable(analyzed, analyzedBuyable)
    return data.goals.map((goal) => ({
      goal,
      active: activeGoals.includes(goal.id),
      completion: goalCompletion(data, goal, inventory, analyzed, mode, buyable),
      direct: goalProgress(data, goal, inventory, analyzed),
      plan: planForGoal(data, goal, inventory, analyzed, mode, buyable),
    }))
  }, [inventory, analyzedIds, activeGoals, mode, analyzedBuyable])
}
