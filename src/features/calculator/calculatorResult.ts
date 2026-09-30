/** Assemble le résultat du calculateur à partir de son état (logique pure, testée). */
import { mergeGoalTargets, type GoalTargets } from '../../logic/goals'
import {
  decayWarnings,
  estimatePlanTime,
  randomSpawnRate,
  stageDurationSeconds,
  type DecayWarning,
  type GrowthSettings,
  type PlanTimeEstimate,
  type RandomSpawn,
} from '../../logic/growth'
import {
  bazaarBuyable,
  buildPlanTree,
  computePlan,
  mergeTargets,
  type Inventory,
  type Plan,
  type PlanTreeNode,
} from '../../logic/recipes'
import type { CalculatorState } from '../../store/state'
import type { GameData } from '../../types/game'

export interface CalculatorResult {
  readonly plan: Plan
  readonly tree: readonly PlanTreeNode[]
  readonly estimate: PlanTimeEstimate
  readonly stageSeconds: number
  readonly decay: readonly DecayWarning[]
  /** Rythme des spawns aléatoires (Lonelily) utilisé par l'estimation, ou null. */
  readonly randomSpawn: RandomSpawn | null
  /** Quantités inconnues des objectifs ajoutés, comptées 1. */
  readonly unknownQuantities: GoalTargets['unknownQuantities']
}

export function computeCalculatorResult(
  data: GameData,
  calculator: CalculatorState,
  inventory: Inventory,
  analyzed: ReadonlySet<string>,
  growth: GrowthSettings,
  /** Option « les mutations analysées s'achètent au bazar » (réglage commun). */
  analyzedBuyable = false,
): CalculatorResult {
  // Cibles à la main + cibles des objectifs ajoutés ; la route AVRG vient des objectifs.
  const goals = mergeGoalTargets(data, new Set(calculator.goalIds), analyzed)
  const plan = computePlan(data, {
    targets: mergeTargets([...calculator.targets, ...goals.targets]),
    inventory: calculator.ignoreInventory ? {} : inventory,
    mode: calculator.mode,
    route: goals.route,
    buyable: bazaarBuyable(analyzed, analyzedBuyable),
  })

  const stageSeconds = stageDurationSeconds(growth, data.mechanics.growthStage.formula)
  const randomSpawn = randomSpawnRate(data, calculator.lonelilyCells)
  const estimate = estimatePlanTime(data, plan, {
    spots: calculator.spots,
    stageSeconds,
    // Milieu de la fourchette des données (0,004 à 0,005 par case et par stage).
    randomSpawns: randomSpawn
      ? new Map([[randomSpawn.mutationId, (randomSpawn.perStage.min + randomSpawn.perStage.max) / 2]])
      : undefined,
  })

  return {
    plan,
    tree: buildPlanTree(data, plan),
    estimate,
    stageSeconds,
    decay: decayWarnings(data, estimate, stageSeconds, data.mechanics.decayDays),
    randomSpawn,
    unknownQuantities: goals.unknownQuantities,
  }
}
