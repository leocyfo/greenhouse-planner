/**
 * Objectifs : ce que demandent les objectifs cochés, fusionnés en une seule liste de cibles.
 *
 * Choix de fusion (remplace le « max pour les ingrédients plantés » de la spec d'origine) :
 *
 * - Les objectifs demandent des mutations qu'ils CONSOMMENT : l'œuf du Rose Dragon prend
 *   1 de chaque légendaire, un craft prend ses ingrédients, une analyse prend un exemplaire
 *   (« +1 for analyzing » chez AVRG). Deux consommations ne peuvent pas partager le même
 *   exemplaire : les quantités consommées s'ADDITIONNENT.
 *   Ex. Rose Dragon (1 Devourer) + Cocoa Leech Shards (1 Devourer) → 2 Devourer.
 *
 * - Les ingrédients à poser ne sont PAS fusionnés ici : on calcule ensuite un seul arbre pour
 *   toutes les cibles (computePlan). Dans cet arbre, une même recette ne compte ses ingrédients
 *   qu'une fois, même si deux objectifs la demandent : les 2 Devourer ci-dessus spawnent dans
 *   le même anneau (c'est le « max » de la spec). En revanche, deux recettes différentes qui
 *   utilisent le même ingrédient s'additionnent, car une mutation posée ne peut plus être
 *   ramassée après son premier growth stage (lock-in).
 *
 * Une quantité inconnue (null dans le JSON) compte pour 1.
 */
import type { GameData, Goal } from '../types/game'
import {
  computePlan,
  mergeTargets,
  planProgress,
  type Inventory,
  type OptimumRoute,
  type Plan,
  type PlanMode,
  type Target,
} from './recipes'

export interface GoalTargets {
  /** Cibles fusionnées (quantités consommées additionnées). */
  readonly targets: readonly Target[]
  /** Quantités inconnues, comptées 1. */
  readonly unknownQuantities: readonly { readonly goalId: string; readonly mutationId: string }[]
  /** Route AVRG pour le mode Optimum (null si aucun objectif coché ne la suit). */
  readonly route: OptimumRoute | null
  /** Coûts hors mutations additionnés (Coins, Copper, Condensed Helianthus…). */
  readonly other: Readonly<Record<string, number>>
  readonly milestones: readonly string[]
}

/** Cibles d'un seul objectif (quantités consommées, null compté 1). */
export function goalTargets(data: GameData, goal: Goal, analyzed: ReadonlySet<string>): Target[] {
  const targets: Target[] = goal.mutations.map((requirement) => ({
    mutationId: requirement.mutationId,
    quantity: requirement.quantity ?? 1,
  }))
  // « Analyser les 40 » : un exemplaire par mutation pas encore analysée.
  if (goal.eachMutation !== null) {
    for (const mutation of data.mutations) {
      if (!analyzed.has(mutation.id)) targets.push({ mutationId: mutation.id, quantity: goal.eachMutation })
    }
  }
  return targets
}

export function mergeGoalTargets(
  data: GameData,
  activeGoalIds: ReadonlySet<string>,
  analyzed: ReadonlySet<string>,
): GoalTargets {
  const activeGoals = data.goals.filter((goal) => activeGoalIds.has(goal.id))
  const targets: Target[] = []
  const routeTargets: Target[] = []
  const unknownQuantities: { goalId: string; mutationId: string }[] = []
  const other: Record<string, number> = {}
  const milestones: string[] = []

  for (const goal of activeGoals) {
    const current = goalTargets(data, goal, analyzed)
    targets.push(...current)
    if (goal.avrgRoute) routeTargets.push(...current)
    for (const requirement of goal.mutations) {
      if (requirement.quantity === null) unknownQuantities.push({ goalId: goal.id, mutationId: requirement.mutationId })
    }
    for (const [resource, amount] of Object.entries(goal.other)) other[resource] = (other[resource] ?? 0) + amount
    for (const milestone of goal.milestones) if (!milestones.includes(milestone)) milestones.push(milestone)
  }

  const hasRoute = activeGoals.some((goal) => goal.avrgRoute)
  return {
    targets: mergeTargets(targets),
    unknownQuantities,
    route: hasRoute ? { targets: mergeTargets(routeTargets), totals: avrgTotals(data) } : null,
    other,
    milestones,
  }
}

/** Totaux AVRG de la route Rose Dragon : les mutations dont roseDragonOptimum > 0. */
export function avrgTotals(data: GameData): ReadonlyMap<string, number> {
  return new Map(data.mutations.filter((m) => m.roseDragonOptimum > 0).map((m) => [m.id, m.roseDragonOptimum]))
}

/** Plan d'un seul objectif, avec la route AVRG s'il la suit (mode Optimum). */
export function planForGoal(
  data: GameData,
  goal: Goal,
  inventory: Inventory,
  analyzed: ReadonlySet<string>,
  mode: PlanMode,
  buyable?: ReadonlySet<string>,
): Plan {
  const targets = mergeTargets(goalTargets(data, goal, analyzed))
  return computePlan(data, {
    targets,
    inventory,
    mode,
    route: goal.avrgRoute ? { targets, totals: avrgTotals(data) } : null,
    buyable,
  })
}

export interface GoalCompletion {
  readonly done: number
  readonly total: number
  /** Ce que l'on compte : des analyses (« Analyser les 40 ») ou des exemplaires. */
  readonly measure: 'analyses' | 'copies'
}

/**
 * Avancement d'un objectif :
 * - « Analyser les 40 » : mutations analysées sur le total ;
 * - sinon : exemplaires déjà en stock sur tout ce que demande son plan, ingrédients compris
 *   (inventaire soustrait à chaque niveau). 100 % = l'objectif est réalisable tout de suite.
 */
export function goalCompletion(
  data: GameData,
  goal: Goal,
  inventory: Inventory,
  analyzed: ReadonlySet<string>,
  mode: PlanMode,
  buyable?: ReadonlySet<string>,
): GoalCompletion {
  if (goal.eachMutation !== null) {
    return {
      done: data.mutations.filter((m) => analyzed.has(m.id)).length,
      total: data.mutations.length,
      measure: 'analyses',
    }
  }
  const progress = planProgress(planForGoal(data, goal, inventory, analyzed, mode, buyable))
  return { ...progress, measure: 'copies' }
}

/**
 * Avancement direct d'un objectif : mutations demandées déjà en stock (ou analysées pour
 * « Analyser les 40 »), sans compter les ingrédients.
 */
export function goalProgress(
  data: GameData,
  goal: Goal,
  inventory: Inventory,
  analyzed: ReadonlySet<string>,
): { readonly done: number; readonly total: number } {
  let done = 0
  let total = 0
  for (const requirement of goal.mutations) {
    const quantity = requirement.quantity ?? 1
    done += Math.min(Math.max(0, inventory[requirement.mutationId] ?? 0), quantity)
    total += quantity
  }
  if (goal.eachMutation !== null) {
    done += data.mutations.filter((m) => analyzed.has(m.id)).length
    total += data.mutations.length
  }
  return { done, total }
}
