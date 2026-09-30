/**
 * Modèle du graphe de l'Encyclopédie (logique pure, testée, sans React Flow) :
 * état de chaque mutation, nœuds disposés en colonnes par rareté, arêtes ingrédient → recette.
 */
import { formatRarity } from '../../components/labels'
import { recipeInputs, recipeLevels, type InputRelation } from '../../logic/graph'
import { isManualSpecial, missingInputs } from '../../logic/nextAction'
import type { Inventory, MutationNeed } from '../../logic/recipes'
import type { GameData, Mutation } from '../../types/game'

/**
 * - complete : au moins un exemplaire, et tout ce que demandent les objectifs suivis ;
 * - available : faisable maintenant (ingrédients en stock) ;
 * - locked : il manque des ingrédients ;
 * - special : condition spéciale invérifiable (Godseed, Jerryflower).
 */
export type MutationState = 'complete' | 'available' | 'locked' | 'special'

export function mutationState(
  data: GameData,
  mutation: Mutation,
  need: MutationNeed | undefined,
  inventory: Inventory,
): MutationState {
  const owned = Math.max(0, Math.floor(inventory[mutation.id] ?? 0))
  if (owned >= Math.max(need?.required ?? 0, 1)) return 'complete'
  if (isManualSpecial(data, mutation)) return 'special'
  return missingInputs(data, mutation, inventory).length === 0 ? 'available' : 'locked'
}

export const COLUMN_WIDTH = 250
export const ROW_HEIGHT = 76
export const NODE_WIDTH = 180
/** Nombre de passes de l'heuristique du barycentre (réduction des croisements). */
const SWEEPS = 4

export interface GraphNode {
  readonly id: string
  readonly kind: 'mutation' | 'base'
  readonly column: number
  readonly x: number
  readonly y: number
}

export interface GraphEdge {
  readonly id: string
  readonly source: string
  readonly target: string
  readonly relation: InputRelation
  readonly cells: number
  readonly units: number
}

export interface GraphColumn {
  readonly key: string
  readonly label: string
  readonly x: number
  readonly count: number
}

export interface GraphModel {
  readonly nodes: readonly GraphNode[]
  readonly edges: readonly GraphEdge[]
  readonly columns: readonly GraphColumn[]
  /** Hauteur des titres de colonnes, au-dessus de la colonne la plus haute. */
  readonly labelY: number
}

export function baseNodeId(name: string): string {
  return `base:${name}`
}

function average(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

/**
 * Colonnes Common → Legendary (précédées des crops de base en option). Dans chaque colonne,
 * les nœuds sont d'abord rangés par niveau puis par nom, puis réordonnés quelques passes par
 * la position moyenne de leurs voisins des autres colonnes (heuristique du barycentre), ce qui
 * limite les croisements d'arêtes. Le résultat est déterministe.
 */
export function buildGraph(data: GameData, options: { readonly showBaseCrops: boolean }): GraphModel {
  const levels = recipeLevels(data)
  const offset = options.showBaseCrops ? 1 : 0

  const edges: GraphEdge[] = []
  for (const mutation of data.mutations) {
    for (const input of recipeInputs(data, mutation)) {
      if (input.crop.kind === 'base' && !options.showBaseCrops) continue
      const source = input.crop.kind === 'mutation' ? input.crop.id : baseNodeId(input.crop.name)
      edges.push({
        id: `${source}->${mutation.id}`,
        source,
        target: mutation.id,
        relation: input.relation,
        cells: input.cells,
        units: input.units,
      })
    }
  }

  const byLevelThenName = (a: Mutation, b: Mutation) =>
    (levels.get(a.id) ?? 0) - (levels.get(b.id) ?? 0) || a.name.localeCompare(b.name, 'fr')
  const columns: string[][] = [
    ...(options.showBaseCrops ? [data.baseCrops.map((crop) => baseNodeId(crop.name))] : []),
    ...data.rarities.map((_, rank) =>
      data.mutations.filter((m) => m.rarityRank === rank).sort(byLevelThenName).map((m) => m.id),
    ),
  ]
  const columnOf = new Map<string, number>()
  columns.forEach((column, index) => column.forEach((id) => columnOf.set(id, index)))

  const ingredientsOf = new Map<string, string[]>()
  const productsOf = new Map<string, string[]>()
  for (const edge of edges) {
    ingredientsOf.set(edge.target, [...(ingredientsOf.get(edge.target) ?? []), edge.source])
    productsOf.set(edge.source, [...(productsOf.get(edge.source) ?? []), edge.target])
  }

  // Position verticale : colonnes centrées sur 0.
  const y = new Map<string, number>()
  const place = (column: readonly string[]) =>
    column.forEach((id, index) => y.set(id, (index - (column.length - 1) / 2) * ROW_HEIGHT))
  columns.forEach(place)

  const reorder = (column: string[], neighborsOf: ReadonlyMap<string, readonly string[]>) => {
    const keyed = column.map((id, index) => {
      const others = (neighborsOf.get(id) ?? []).filter((n) => columnOf.get(n) !== columnOf.get(id))
      const key = others.length > 0 ? average(others.map((n) => y.get(n) ?? 0)) : (y.get(id) ?? 0)
      return { id, key, index }
    })
    keyed.sort((a, b) => a.key - b.key || a.index - b.index)
    column.splice(0, column.length, ...keyed.map((entry) => entry.id))
    place(column)
  }
  for (let sweep = 0; sweep < SWEEPS; sweep += 1) {
    for (let c = 1; c < columns.length; c += 1) reorder(columns[c] ?? [], ingredientsOf)
    for (let c = columns.length - 2; c >= 0; c -= 1) reorder(columns[c] ?? [], productsOf)
  }

  const nodes: GraphNode[] = columns.flatMap((column, index) =>
    column.map((id) => ({
      id,
      kind: id.startsWith('base:') ? ('base' as const) : ('mutation' as const),
      column: index,
      x: index * COLUMN_WIDTH,
      y: y.get(id) ?? 0,
    })),
  )
  const tallest = Math.max(...columns.map((column) => column.length))

  return {
    nodes,
    edges,
    columns: columns.map((column, index) => ({
      key: index < offset ? 'base' : (data.rarities[index - offset] ?? String(index)),
      label: index < offset ? 'Crops de base' : formatRarity(data.rarities[index - offset] ?? ''),
      x: index * COLUMN_WIDTH,
      count: column.length,
    })),
    labelY: -((tallest - 1) / 2) * ROW_HEIGHT - 64,
  }
}
