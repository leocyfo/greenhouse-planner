/**
 * Graphe des recettes : ce qu'il faut pour lancer chaque recette, et dans quel ordre.
 * Le graphe est acyclique (vérifié au chargement des données).
 */
import type { CropRef, GameData, Mutation } from '../types/game'
import { mutationsForCells } from './neighborRule'

/**
 * Rôle d'une entrée dans une recette :
 * - condition : à poser autour de l'emplacement ; comptée une fois par recette ;
 * - consumed : consommée, `units` exemplaires par mutation produite ;
 * - catalyst : doit être disponible (au moins `units`), sans s'ajouter aux autres besoins.
 */
export type InputRelation = 'condition' | 'consumed' | 'catalyst'

export interface RecipeInput {
  readonly crop: CropRef
  readonly relation: InputRelation
  /** Cases demandées par la condition (0 pour un prérequis spécial). */
  readonly cells: number
  /** Exemplaires nécessaires : pour une condition, cases converties en mutations. */
  readonly units: number
}

/** Entrées d'une recette : conditions de voisinage puis prérequis spéciaux. */
export function recipeInputs(data: GameData, mutation: Mutation): readonly RecipeInput[] {
  const conditions = mutation.conditions.map((condition): RecipeInput => {
    const ingredient = condition.crop.kind === 'mutation' ? data.mutationsById.get(condition.crop.id) : undefined
    // Une mutation multi-cases apporte plusieurs cases : il en faut moins que de cases.
    const units = ingredient ? mutationsForCells(condition.count, ingredient.side) : condition.count
    return { crop: condition.crop, relation: 'condition', cells: condition.count, units }
  })
  const prerequisites = mutation.specialPrerequisites.map(
    (prerequisite): RecipeInput => ({
      crop: { kind: 'mutation', id: prerequisite.mutationId },
      relation: prerequisite.role,
      cells: 0,
      units: prerequisite.count,
    }),
  )
  return [...conditions, ...prerequisites]
}

export interface RecipeUse {
  /** Recette qui utilise la mutation. */
  readonly mutationId: string
  readonly relation: InputRelation
  readonly cells: number
  readonly units: number
}

/** Recettes qui utilisent une mutation (sens inverse de recipeInputs), dans l'ordre des données. */
export function recipesUsing(data: GameData, mutationId: string): RecipeUse[] {
  return data.mutations.flatMap((mutation) =>
    recipeInputs(data, mutation)
      .filter((input) => input.crop.kind === 'mutation' && input.crop.id === mutationId)
      .map((input) => ({ mutationId: mutation.id, relation: input.relation, cells: input.cells, units: input.units })),
  )
}

/** Ids des mutations utilisées par une recette (conditions et prérequis). */
function mutationInputIds(mutation: Mutation): string[] {
  const ids = mutation.conditions.flatMap((c) => (c.crop.kind === 'mutation' ? [c.crop.id] : []))
  return [...ids, ...mutation.specialPrerequisites.map((p) => p.mutationId)]
}

/**
 * Niveau de chaque mutation dans l'arbre : 0 si sa recette n'utilise aucune mutation,
 * sinon 1 + le niveau de son ingrédient le plus haut. Ex. Dustgrain 0, Chocoberry 1, Blastberry 2.
 * Une recette a toujours un niveau supérieur à celui de ses ingrédients.
 */
export function recipeLevels(data: GameData): ReadonlyMap<string, number> {
  const levels = new Map<string, number>()
  const levelOf = (mutation: Mutation): number => {
    const known = levels.get(mutation.id)
    if (known !== undefined) return known
    let level = 0
    for (const id of mutationInputIds(mutation)) {
      const ingredient = data.mutationsById.get(id)
      if (ingredient) level = Math.max(level, levelOf(ingredient) + 1)
    }
    levels.set(mutation.id, level)
    return level
  }
  data.mutations.forEach(levelOf)
  return levels
}

/**
 * Ordre de farm : les ingrédients avant ce qu'ils permettent de faire (tri topologique par
 * niveau), puis par rareté et par nom pour un ordre stable.
 */
export function compareFarmOrder(
  levels: ReadonlyMap<string, number>,
): (a: Mutation, b: Mutation) => number {
  return (a, b) =>
    (levels.get(a.id) ?? 0) - (levels.get(b.id) ?? 0) ||
    a.rarityRank - b.rarityRank ||
    a.name.localeCompare(b.name, 'fr')
}
