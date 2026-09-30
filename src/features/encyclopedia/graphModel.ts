/**
 * Modèle de l'Encyclopédie (logique pure, testée) : état de chaque mutation et arbre des recettes,
 * une colonne par étape (niveau de recette), liens ingrédient → recette tous de gauche à droite.
 */
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

/** Carte d'une mutation et pastille d'un crop de base, en pixels. */
export const CARD_WIDTH = 168
export const CARD_HEIGHT = 48
const CARD_GAP = 14
export const BASE_WIDTH = 128
export const BASE_HEIGHT = 28
const BASE_GAP = 8
/** Place entre deux colonnes, pour les liens ; les 6 étapes tiennent dans la largeur du site. */
const COLUMN_GAP = 38
/** Titres des colonnes, au-dessus des cartes. */
export const HEADER_HEIGHT = 44
/** Passes de l'heuristique du barycentre (moins de croisements). */
const SWEEPS = 4

export interface TreeNode {
  readonly id: string
  readonly kind: 'mutation' | 'base'
  readonly column: number
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface TreeEdge {
  readonly id: string
  readonly source: string
  readonly target: string
  readonly relation: InputRelation
  readonly cells: number
  readonly units: number
  /** Courbe SVG du bord droit de l'ingrédient au bord gauche de la recette. */
  readonly path: string
}

export interface TreeColumn {
  readonly key: string
  readonly title: string
  readonly x: number
  readonly width: number
  readonly count: number
}

export interface TreeModel {
  readonly width: number
  readonly height: number
  readonly nodes: readonly TreeNode[]
  readonly edges: readonly TreeEdge[]
  readonly columns: readonly TreeColumn[]
  /** Mutations à condition spéciale (Godseed, Jerryflower) : sans recette, hors de l'arbre. */
  readonly specials: readonly string[]
}

export function baseNodeId(name: string): string {
  return `base:${name}`
}

const average = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0) / values.length
const round = (value: number) => Math.round(value * 10) / 10

/**
 * Colonnes Étape 1 → Étape N (précédées des crops de base en option) : l'étape d'une mutation est
 * 1 + son niveau de recette, donc chaque ingrédient est dans une colonne à gauche de sa recette.
 * Dans chaque colonne, rareté puis nom, puis quelques passes du barycentre (position moyenne des
 * voisins) pour limiter les croisements. Les liens partent et arrivent à des points répartis sur
 * les bords des cartes, dans l'ordre vertical de l'autre bout. Résultat déterministe.
 */
export function buildTree(data: GameData, options: { readonly showBaseCrops: boolean }): TreeModel {
  const levels = recipeLevels(data)
  const specials = data.mutations.filter((m) => isManualSpecial(data, m)).map((m) => m.id)
  const inTree = data.mutations.filter((m) => !specials.includes(m.id))
  const steps = Math.max(...inTree.map((m) => levels.get(m.id) ?? 0)) + 1
  const byRarityThenName = (a: Mutation, b: Mutation) => a.rarityRank - b.rarityRank || a.name.localeCompare(b.name, 'fr')
  const columns: string[][] = [
    ...(options.showBaseCrops ? [data.baseCrops.map((crop) => baseNodeId(crop.name))] : []),
    ...Array.from({ length: steps }, (_, level) =>
      inTree
        .filter((m) => (levels.get(m.id) ?? 0) === level)
        .sort(byRarityThenName)
        .map((m) => m.id),
    ),
  ]
  const isBaseColumn = (index: number) => options.showBaseCrops && index === 0
  const sizeOf = (index: number) =>
    isBaseColumn(index)
      ? { width: BASE_WIDTH, height: BASE_HEIGHT, gap: BASE_GAP }
      : { width: CARD_WIDTH, height: CARD_HEIGHT, gap: CARD_GAP }
  const columnHeight = (index: number) => {
    const { height, gap } = sizeOf(index)
    const count = columns[index]?.length ?? 0
    return count * height + Math.max(0, count - 1) * gap
  }
  const tallest = Math.max(...columns.map((_, index) => columnHeight(index)))
  const columnX: number[] = []
  columns.forEach((_, index) => columnX.push(index === 0 ? 0 : (columnX[index - 1] ?? 0) + sizeOf(index - 1).width + COLUMN_GAP))

  const edges: Omit<TreeEdge, 'path'>[] = []
  for (const mutation of inTree) {
    for (const input of recipeInputs(data, mutation)) {
      if (input.crop.kind === 'base' && !options.showBaseCrops) continue
      const source = input.crop.kind === 'mutation' ? input.crop.id : baseNodeId(input.crop.name)
      edges.push({ id: `${source}->${mutation.id}`, source, target: mutation.id, relation: input.relation, cells: input.cells, units: input.units })
    }
  }
  const ingredientsOf = new Map<string, string[]>()
  const productsOf = new Map<string, string[]>()
  for (const edge of edges) {
    ingredientsOf.set(edge.target, [...(ingredientsOf.get(edge.target) ?? []), edge.source])
    productsOf.set(edge.source, [...(productsOf.get(edge.source) ?? []), edge.target])
  }

  // Centre vertical de chaque carte : colonnes centrées sous les titres.
  const columnOf = new Map<string, number>()
  columns.forEach((column, index) => column.forEach((id) => columnOf.set(id, index)))
  const centerY = new Map<string, number>()
  const place = (index: number) => {
    const { height, gap } = sizeOf(index)
    const top = HEADER_HEIGHT + (tallest - columnHeight(index)) / 2
    columns[index]?.forEach((id, row) => centerY.set(id, top + row * (height + gap) + height / 2))
  }
  columns.forEach((_, index) => place(index))
  const reorder = (index: number, neighborsOf: ReadonlyMap<string, readonly string[]>) => {
    const column = columns[index] ?? []
    const keyed = column.map((id, position) => {
      const others = (neighborsOf.get(id) ?? []).filter((n) => columnOf.get(n) !== index)
      return { id, position, key: others.length > 0 ? average(others.map((n) => centerY.get(n) ?? 0)) : (centerY.get(id) ?? 0) }
    })
    keyed.sort((a, b) => a.key - b.key || a.position - b.position)
    column.splice(0, column.length, ...keyed.map((entry) => entry.id))
    place(index)
  }
  for (let sweep = 0; sweep < SWEEPS; sweep += 1) {
    for (let index = 1; index < columns.length; index += 1) reorder(index, ingredientsOf)
    for (let index = columns.length - 2; index >= 0; index -= 1) reorder(index, productsOf)
  }

  const nodes: TreeNode[] = columns.flatMap((column, index) =>
    column.map((id) => {
      const { width, height } = sizeOf(index)
      return {
        id,
        kind: isBaseColumn(index) ? ('base' as const) : ('mutation' as const),
        column: index,
        x: columnX[index] ?? 0,
        y: (centerY.get(id) ?? 0) - height / 2,
        width,
        height,
      }
    }),
  )
  const nodeById = new Map(nodes.map((node) => [node.id, node]))

  // Points d'attache : répartis sur le bord, dans l'ordre vertical de l'autre bout du lien.
  const port = (edgeIds: readonly string[], edgeId: string, node: TreeNode) =>
    node.y + (node.height * (edgeIds.indexOf(edgeId) + 1)) / (edgeIds.length + 1)
  const sortedBy = (list: readonly Omit<TreeEdge, 'path'>[], end: (edge: Omit<TreeEdge, 'path'>) => string) =>
    [...list].sort((a, b) => (centerY.get(end(a)) ?? 0) - (centerY.get(end(b)) ?? 0)).map((edge) => edge.id)
  const incoming = new Map<string, string[]>()
  const outgoing = new Map<string, string[]>()
  for (const node of nodes) {
    incoming.set(node.id, sortedBy(edges.filter((e) => e.target === node.id), (e) => e.source))
    outgoing.set(node.id, sortedBy(edges.filter((e) => e.source === node.id), (e) => e.target))
  }
  const withPaths: TreeEdge[] = edges.map((edge) => {
    const from = nodeById.get(edge.source)
    const to = nodeById.get(edge.target)
    if (!from || !to) return { ...edge, path: '' }
    const sx = from.x + from.width
    const sy = port(outgoing.get(from.id) ?? [], edge.id, from)
    const tx = to.x
    const ty = port(incoming.get(to.id) ?? [], edge.id, to)
    const bend = (tx - sx) / 2
    return { ...edge, path: `M${round(sx)} ${round(sy)}C${round(sx + bend)} ${round(sy)} ${round(tx - bend)} ${round(ty)} ${round(tx)} ${round(ty)}` }
  })

  return {
    width: (columnX[columns.length - 1] ?? 0) + sizeOf(columns.length - 1).width,
    height: HEADER_HEIGHT + tallest,
    nodes,
    edges: withPaths,
    columns: columns.map((column, index) => ({
      key: isBaseColumn(index) ? 'base' : `step-${index - (options.showBaseCrops ? 1 : 0)}`,
      title: isBaseColumn(index) ? 'Crops de base' : `Étape ${index + (options.showBaseCrops ? 0 : 1)}`,
      x: columnX[index] ?? 0,
      width: sizeOf(index).width,
      count: column.length,
    })),
    specials,
  }
}

/** Mutation mise en avant : tout son chemin (ingrédients, jusqu'au départ) et ce qu'elle permet de faire. */
export interface TreeFocus {
  readonly id: string
  /** Ingrédients, ingrédients des ingrédients… (crops de base compris s'ils sont affichés). */
  readonly path: ReadonlySet<string>
  /** Recettes qui l'utilisent directement. */
  readonly uses: ReadonlySet<string>
}

export function focusOn(edges: readonly TreeEdge[], id: string): TreeFocus {
  const path = new Set<string>()
  const visit = (target: string) => {
    for (const edge of edges) {
      if (edge.target !== target || path.has(edge.source)) continue
      path.add(edge.source)
      visit(edge.source)
    }
  }
  visit(id)
  return { id, path, uses: new Set(edges.filter((edge) => edge.source === id).map((edge) => edge.target)) }
}

/** Rôle d'un lien quand une mutation est mise en avant : sur son chemin, vers ce qu'elle permet, ou aucun. */
export function edgeRole(edge: TreeEdge, focus: TreeFocus): 'path' | 'use' | 'none' {
  if (edge.source === focus.id) return 'use'
  const leadsToFocus = edge.target === focus.id || focus.path.has(edge.target)
  return leadsToFocus && focus.path.has(edge.source) ? 'path' : 'none'
}

/** Quantité d'un ingrédient dans une recette : « ×6 », « 1 consommé », « 2 catalyseur ». */
export function amountText(edge: Pick<TreeEdge, 'relation' | 'units'>): string {
  if (edge.relation === 'consumed') return `${edge.units} consommé`
  if (edge.relation === 'catalyst') return `${edge.units} catalyseur`
  return `×${edge.units}`
}

/** Nœud estompé : une mutation est mise en avant, et il n'est ni elle, ni sur son chemin, ni une de ses recettes. */
export function isDimmed(id: string, focus: TreeFocus | null): boolean {
  return focus !== null && id !== focus.id && !focus.path.has(id) && !focus.uses.has(id)
}
