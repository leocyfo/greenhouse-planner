/**
 * « Prochaine action recommandée » : la mutation à faire pousser maintenant.
 *
 * Critères (spec) : elle manque pour un objectif actif, ses ingrédients sont déjà disponibles,
 * et on prend la plus basse dans l'arbre en premier (ordre de farm : niveau, rareté, nom).
 *
 * « Disponible » = assez d'exemplaires en stock pour lancer la recette une fois : les mutations
 * à poser autour, les catalyseurs, et au moins un lot de prérequis consommés. Les crops de base
 * sont supposés disponibles (on ne suit pas leur stock). Les mutations à condition spéciale
 * qu'on ne peut pas vérifier (Godseed, Jerryflower) sont listées à part ; la Lonelily, qui
 * spawn seule sur les cases vides, est toujours faisable.
 */
import type { CropRef, GameData, Mutation } from '../types/game'
import { recipeInputs } from './graph'
import type { Inventory, Plan } from './recipes'

export interface MissingInput {
  readonly crop: CropRef
  readonly missing: number
}

export interface NextActionResult {
  /** Mutation à faire pousser maintenant, ou null s'il n'y en a aucune de faisable. */
  readonly recommended: string | null
  /** Autres mutations faisables tout de suite, dans l'ordre de farm. */
  readonly alsoReady: readonly string[]
  /** Mutations à condition spéciale non vérifiable, à gérer à la main. */
  readonly manual: readonly string[]
}

/** Ingrédients qui manquent pour lancer la recette une fois (vide = recette faisable). */
export function missingInputs(data: GameData, mutation: Mutation, inventory: Inventory): MissingInput[] {
  const missing: MissingInput[] = []
  for (const input of recipeInputs(data, mutation)) {
    if (input.crop.kind !== 'mutation') continue // crop de base : supposé disponible
    const owned = Math.max(0, Math.floor(inventory[input.crop.id] ?? 0))
    if (owned < input.units) missing.push({ crop: input.crop, missing: input.units - owned })
  }
  return missing
}

/**
 * Mutation à condition spéciale qu'on ne peut pas vérifier (Godseed, Jerryflower) : ni recette
 * de voisinage, ni prérequis, et ce n'est pas la mutation qui spawn seule sur les cases vides.
 */
export function isManualSpecial(data: GameData, mutation: Mutation): boolean {
  const randomSpawnName = data.mechanics.lonelilyRatePerCell.mutation
  return mutation.conditions.length === 0 && mutation.specialPrerequisites.length === 0 && mutation.name !== randomSpawnName
}

export function nextActions(data: GameData, plan: Plan, inventory: Inventory, limit = 5): NextActionResult {
  const ready: string[] = []
  const manual: string[] = []

  for (const id of plan.farmOrder) {
    const mutation = data.mutationsById.get(id)
    if (!mutation) continue
    if (isManualSpecial(data, mutation)) manual.push(id)
    else if (missingInputs(data, mutation, inventory).length === 0) ready.push(id)
  }

  return { recommended: ready[0] ?? null, alsoReady: ready.slice(1, 1 + limit), manual }
}
