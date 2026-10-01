/**
 * Modèle de l'Encyclopédie (logique pure, testée) : état de chaque mutation et arbre des recettes,
 * colonnes par rareté ou par étape (voir TreeArrangement), liens ingrédient → recette tous de
 * gauche à droite. Une mutation choisie ne garde que ce qu'il faut pour la faire (TreeSelection).
 */
import { formatRarity } from '../../components/labels'
import { tr } from '../../i18n/locale'
import { recipeInputs, recipeLevels, type InputRelation } from '../../logic/graph'
import { isManualSpecial, missingInputs } from '../../logic/nextAction'
import { computePlan, type Inventory, type MutationNeed } from '../../logic/recipes'
import type { GameData, Mutation } from '../../types/game'
import { layoutColumns } from './treeLayout'

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
export const CARD_WIDTH = 176
export const CARD_HEIGHT = 48
const CARD_GAP = 14
export const BASE_WIDTH = 152
export const BASE_HEIGHT = 28
const BASE_GAP = 8
/** Espace entre deux colonnes : la largeur disponible, dans ces bornes (au-delà, l'arbre défile). */
export const MIN_COLUMN_GAP = 44
export const MAX_COLUMN_GAP = 140
/** Largeur supposée quand elle n'est pas donnée (tests). */
const DEFAULT_WIDTH = 1200
/** Titres des colonnes, au-dessus des cartes. */
export const HEADER_HEIGHT = 44

/**
 * Mutation choisie : seules restent, avec les crops de base qu'elles demandent,
 * - neighbors : ses ingrédients directs et les recettes qui l'utilisent (avant et après) ;
 * - chain : tout ce qu'il faut faire avant elle, jusqu'aux crops de base, et les recettes qui
 *   l'utilisent (la vue agrandie : elle contient toute la vue « avant et après »).
 */
export type TreeMode = 'neighbors' | 'chain'

/**
 * Rangement des colonnes :
 * - rarity : une colonne par rareté, Common → Legendary. Une rareté prend plusieurs colonnes quand
 *   une de ses recettes demande une mutation de la même rareté (Epic : Turtlellini → Shellfruit) ;
 * - step : une colonne par étape de fabrication (1 + l'étape de l'ingrédient le plus avancé).
 */
export type TreeArrangement = 'rarity' | 'step'

export interface TreeSelection {
  readonly id: string
  readonly mode: TreeMode
}

export interface TreeOptions {
  readonly arrangement: TreeArrangement
  /** Colonne des crops de base pour tout l'arbre ; une mutation choisie montre toujours les siens. */
  readonly showBaseCrops: boolean
  readonly selection?: TreeSelection | null
  /** Largeur disponible en pixels : l'espace entre les colonnes s'y adapte. */
  readonly availableWidth?: number
}

export interface TreeNode {
  readonly id: string
  readonly kind: 'mutation' | 'base'
  readonly column: number
  /** Étape de fabrication (1 : que des crops de base) ; 0 pour un crop de base. */
  readonly step: number
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

/** Titre au-dessus d'une colonne, ou de plusieurs colonnes de la même rareté. */
export interface TreeHeader {
  readonly key: string
  readonly title: string
  /** Rareté de la colonne (rangement par rareté), pour sa couleur. */
  readonly rarity: string | null
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
  readonly headers: readonly TreeHeader[]
  /** Mutations à condition spéciale (Godseed, Jerryflower) : sans recette, hors de l'arbre. */
  readonly specials: readonly string[]
}

export function baseNodeId(name: string): string {
  return `base:${name}`
}

/** Toutes les mutations à faire avant celle-ci (ingrédients, ingrédients des ingrédients…). */
export function chainOf(data: GameData, id: string): ReadonlySet<string> {
  const chain = new Set<string>()
  const visit = (mutationId: string) => {
    const mutation = data.mutationsById.get(mutationId)
    if (!mutation) return
    for (const input of recipeInputs(data, mutation)) {
      if (input.crop.kind !== 'mutation' || chain.has(input.crop.id)) continue
      chain.add(input.crop.id)
      visit(input.crop.id)
    }
  }
  visit(id)
  return chain
}

/**
 * Quantités totales pour obtenir 1 exemplaire d'une mutation : le calcul du Calculateur, en mode
 * Minimum et sans compter le stock. Par id de nœud (mutations, et crops de base via baseNodeId).
 */
export function chainTotals(data: GameData, id: string): ReadonlyMap<string, number> {
  const plan = computePlan(data, { targets: [{ mutationId: id, quantity: 1 }], inventory: {}, mode: 'minimum' })
  const totals = new Map<string, number>()
  for (const [mutationId, need] of plan.needs) if (mutationId !== id) totals.set(mutationId, need.required)
  for (const crop of plan.baseCrops) totals.set(baseNodeId(crop.name), crop.quantity)
  return totals
}

type RawEdge = Omit<TreeEdge, 'path'>

/** Ce qui reste affiché : tout l'arbre, ou seulement ce qu'il faut pour la mutation choisie. */
function visiblePart(
  data: GameData,
  treeIds: ReadonlySet<string>,
  edges: readonly RawEdge[],
  options: TreeOptions,
): { readonly ids: ReadonlySet<string>; readonly edges: readonly RawEdge[] } {
  const selection = options.selection
  if (!selection || !treeIds.has(selection.id)) {
    const baseIds = options.showBaseCrops ? data.baseCrops.map((crop) => baseNodeId(crop.name)) : []
    return { ids: new Set([...treeIds, ...baseIds]), edges }
  }
  const { id } = selection
  const chain = chainOf(data, id)
  const kept =
    selection.mode === 'neighbors'
      ? edges.filter((edge) => edge.source === id || edge.target === id)
      : edges.filter((edge) => edge.target === id || chain.has(edge.target) || edge.source === id)
  return { ids: new Set([id, ...kept.flatMap((edge) => [edge.source, edge.target])]), edges: kept }
}

/**
 * Rang de chaque mutation dans sa rareté : 0, ou 1 + celui de son ingrédient affiché de même rareté
 * le plus avancé. null si une recette demande une mutation plus rare qu'elle : on ne pourrait plus
 * aller de gauche à droite (jamais le cas dans les données, un test le vérifie).
 */
function rarityTiers(shown: readonly Mutation[], edges: readonly RawEdge[]): ReadonlyMap<string, number> | null {
  const byId = new Map(shown.map((m) => [m.id, m]))
  const sameRarity = new Map<string, string[]>()
  for (const edge of edges) {
    const source = byId.get(edge.source)
    const target = byId.get(edge.target)
    if (!source || !target) continue
    if (source.rarityRank > target.rarityRank) return null
    if (source.rarityRank === target.rarityRank) sameRarity.set(target.id, [...(sameRarity.get(target.id) ?? []), source.id])
  }
  const tiers = new Map<string, number>()
  const tierOf = (id: string): number => {
    const known = tiers.get(id)
    if (known !== undefined) return known
    const tier = Math.max(-1, ...(sameRarity.get(id) ?? []).map(tierOf)) + 1
    tiers.set(id, tier)
    return tier
  }
  shown.forEach((m) => tierOf(m.id))
  return tiers
}

/**
 * Colonnes par rareté ou par étape (voir TreeArrangement), précédées des crops de base en option :
 * chaque ingrédient est toujours dans une colonne à gauche de sa recette. Les colonnes sans mutation
 * affichée (vue filtrée) disparaissent. Positions et liens : treeLayout.
 */
export function buildTree(data: GameData, options: TreeOptions): TreeModel {
  const levels = recipeLevels(data)
  const specials = data.mutations.filter((m) => isManualSpecial(data, m)).map((m) => m.id)
  const inTree = data.mutations.filter((m) => !specials.includes(m.id))
  const selected = options.selection ? inTree.some((m) => m.id === options.selection?.id) : false
  const showBaseCrops = options.showBaseCrops || selected
  const byRarityThenName = (a: Mutation, b: Mutation) => a.rarityRank - b.rarityRank || a.name.localeCompare(b.name, 'fr')

  const allEdges: RawEdge[] = inTree.flatMap((mutation) =>
    recipeInputs(data, mutation).flatMap((input) => {
      if (input.crop.kind === 'base' && !showBaseCrops) return []
      const source = input.crop.kind === 'mutation' ? input.crop.id : baseNodeId(input.crop.name)
      return [{ id: `${source}->${mutation.id}`, source, target: mutation.id, relation: input.relation, cells: input.cells, units: input.units }]
    }),
  )
  const visible = visiblePart(data, new Set(inTree.map((m) => m.id)), allEdges, options)

  const baseIds = data.baseCrops.map((crop) => baseNodeId(crop.name)).filter((id) => visible.ids.has(id))
  const shown = inTree.filter((m) => visible.ids.has(m.id))
  const stepOf = (id: string) => (levels.get(id) ?? 0) + 1
  const tiers = options.arrangement === 'rarity' ? rarityTiers(shown, visible.edges) : null
  const cards = { kind: 'mutation' as const, width: CARD_WIDTH, height: CARD_HEIGHT, gap: CARD_GAP }
  const mutationColumns = tiers
    ? data.rarities.flatMap((rarity) => {
        const ofRarity = shown.filter((m) => m.rarity === rarity)
        const tierList = [...new Set(ofRarity.map((m) => tiers.get(m.id) ?? 0))].sort((a, b) => a - b)
        return tierList.map((tier) => ({
          ...cards,
          key: `rarity-${rarity}-${tier}`,
          group: `rarity-${rarity}`,
          title: formatRarity(rarity),
          rarity,
          ids: ofRarity
            .filter((m) => (tiers.get(m.id) ?? 0) === tier)
            .sort((a, b) => stepOf(a.id) - stepOf(b.id) || a.name.localeCompare(b.name, 'fr'))
            .map((m) => m.id),
        }))
      })
    : [...new Set(shown.map((m) => stepOf(m.id)))]
        .sort((a, b) => a - b)
        .map((step) => ({
          ...cards,
          key: `step-${step}`,
          group: `step-${step}`,
          title: tr(`Étape ${step}`, `Step ${step}`),
          rarity: null,
          ids: shown
            .filter((m) => stepOf(m.id) === step)
            .sort(byRarityThenName)
            .map((m) => m.id),
        }))
  const baseColumn = {
    key: 'base',
    group: 'base',
    title: tr('Crops de base', 'Base crops'),
    rarity: null,
    kind: 'base' as const,
    ids: baseIds,
    width: BASE_WIDTH,
    height: BASE_HEIGHT,
    gap: BASE_GAP,
  }
  const columns = [...(baseIds.length > 0 ? [baseColumn] : []), ...mutationColumns]

  const fixedWidth = columns.reduce((sum, column) => sum + column.width, 0)
  const free = (options.availableWidth ?? DEFAULT_WIDTH) - fixedWidth
  const columnGap =
    columns.length > 1 ? Math.min(MAX_COLUMN_GAP, Math.max(MIN_COLUMN_GAP, Math.floor(free / (columns.length - 1)))) : 0
  const layout = layoutColumns(columns, visible.edges, { top: HEADER_HEIGHT, columnGap })

  return {
    width: layout.width,
    height: layout.height,
    nodes: columns.flatMap((column, index) =>
      column.ids.map((id) => {
        const position = layout.positions.get(id) ?? { x: 0, y: 0 }
        const step = column.kind === 'base' ? 0 : stepOf(id)
        return { id, kind: column.kind, column: index, step, x: position.x, y: position.y, width: column.width, height: column.height }
      }),
    ),
    edges: visible.edges.map((edge) => ({ ...edge, path: layout.paths.get(edge.id) ?? '' })),
    columns: columns.map((column, index) => ({
      key: column.key,
      title: column.title,
      x: layout.columnX[index] ?? 0,
      width: column.width,
      count: column.ids.length,
    })),
    headers: headersOf(columns, layout.columnX),
    specials,
  }
}

interface HeaderSource {
  readonly group: string
  readonly title: string
  readonly rarity: string | null
  readonly ids: readonly string[]
  readonly width: number
}

/** Un titre par groupe de colonnes voisines : une rareté sur deux colonnes n'a qu'un titre. */
function headersOf(columns: readonly HeaderSource[], columnX: readonly number[]): TreeHeader[] {
  const headers: TreeHeader[] = []
  columns.forEach((column, index) => {
    const x = columnX[index] ?? 0
    const last = headers.at(-1)
    if (last?.key === column.group) {
      headers[headers.length - 1] = { ...last, width: x + column.width - last.x, count: last.count + column.ids.length }
    } else {
      headers.push({ key: column.group, title: column.title, rarity: column.rarity, x, width: column.width, count: column.ids.length })
    }
  })
  return headers
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
  if (edge.relation === 'consumed') return tr(`${edge.units} consommé`, `${edge.units} consumed`)
  if (edge.relation === 'catalyst') return tr(`${edge.units} catalyseur`, `${edge.units} catalyst`)
  return `×${edge.units}`
}

/** Nœud estompé : une mutation est mise en avant, et il n'est ni elle, ni sur son chemin, ni une de ses recettes. */
export function isDimmed(id: string, focus: TreeFocus | null): boolean {
  return focus !== null && id !== focus.id && !focus.path.has(id) && !focus.uses.has(id)
}
