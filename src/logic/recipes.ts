/**
 * Calcul des besoins pour obtenir des mutations cibles.
 *
 * Règles (voir docs/SPEC.md, « Décisions validées ») :
 *
 * 1. Les ingrédients ne sont pas consommés au spawn : l'anneau posé autour d'un emplacement
 *    fait spawn la mutation autant de fois qu'on veut. Une recette compte donc ses ingrédients
 *    UNE fois, quelle que soit la quantité voulue.
 *
 * 2. Règle de somme : après son premier growth stage, une mutation posée ne peut plus être
 *    ramassée (lock-in). Un ingrédient posé pour une recette ne sert donc pas à une autre :
 *    deux recettes différentes qui utilisent le même ingrédient s'additionnent.
 *    Cette règle redonne exactement les minimums du guide AVRG (Chloronite 11 = 6 pour le
 *    Glasscorn + 5 pour le Chorus Fruit, Duskbloom 12 = 3 + 6 + 3…).
 *
 * 3. L'inventaire est soustrait à chaque niveau : une recette n'est lancée que s'il manque
 *    des exemplaires de sa mutation ; sinon ses ingrédients ne sont pas demandés.
 *
 * 4. Mode Optimum : pour les mutations de la route AVRG (Rose Dragon), le total AVRG
 *    (roseDragonOptimum) remplace le calcul, car il intègre déjà le partage d'ingrédients de
 *    ses plans (3 Snoozlings au lieu de 5). Il s'applique tant qu'une recette de la route a
 *    besoin de la mutation ; les besoins des autres objectifs s'ajoutent par-dessus.
 *    Limite : si une partie de la route est déjà faite, les totaux AVRG peuvent surestimer
 *    les ingrédients intermédiaires. Le mode Minimum, lui, est exact à chaque niveau.
 *    Les crops de base restent comptés au minimum (les données n'ont pas de totaux AVRG).
 *
 * 5. Option « les mutations analysées s'achètent au bazar » (dit par AVRG pour Dustgrain et
 *    Gloomgourd seulement, donc à vérifier) : une mutation achetable qui manque est achetée
 *    au lieu d'être cultivée. Sa recette n'est pas lancée, comme pour une mutation en stock.
 */
import type { CropRef, GameData, Mutation } from '../types/game'
import { compareFarmOrder, recipeInputs, recipeLevels, type InputRelation } from './graph'

/** Exemplaires possédés, par id de mutation. */
export type Inventory = Readonly<Record<string, number>>

export type PlanMode = 'minimum' | 'optimum'

/** Mutation voulue et quantité à obtenir (consommée par l'objectif ou demandée). */
export interface Target {
  readonly mutationId: string
  readonly quantity: number
}

/** Route AVRG utilisée par le mode Optimum. */
export interface OptimumRoute {
  /** Ce que l'objectif de la route consomme (œuf du Rose Dragon : 1 de chaque légendaire). */
  readonly targets: readonly Target[]
  /** Totaux AVRG par id de mutation (roseDragonOptimum > 0). */
  readonly totals: ReadonlyMap<string, number>
}

export interface PlanRequest {
  readonly targets: readonly Target[]
  /** Inventaire à soustraire ; passer {} pour l'ignorer. */
  readonly inventory: Inventory
  readonly mode: PlanMode
  readonly route?: OptimumRoute | null
  /** Mutations achetables au bazar (règle 5), voir bazaarBuyable. */
  readonly buyable?: ReadonlySet<string>
}

const NOTHING_BUYABLE: ReadonlySet<string> = new Set()

/** Mutations achetables au bazar : les mutations analysées, si l'option est activée (règle 5). */
export function bazaarBuyable(analyzed: ReadonlySet<string>, enabled: boolean): ReadonlySet<string> {
  return enabled ? analyzed : NOTHING_BUYABLE
}

/** Qui demande une mutation, et combien. `parentId` null = cible directe. */
export interface NeedSource {
  readonly parentId: string | null
  readonly relation: 'target' | InputRelation
  readonly quantity: number
}

export interface MutationNeed {
  readonly mutationId: string
  /** Exemplaires nécessaires au total (consommés + posés). */
  readonly required: number
  readonly owned: number
  /** Exemplaires à obtenir : required − owned, au minimum 0. */
  readonly missing: number
  /** true = les exemplaires manquants s'achètent au bazar (règle 5) : recette non lancée. */
  readonly buy: boolean
  /** computed = règles 1 à 3 ; avrg-optimum = total AVRG (règle 4). */
  readonly basis: 'computed' | 'avrg-optimum'
  readonly level: number
  readonly sources: readonly NeedSource[]
}

export interface BaseCropNeed {
  readonly name: string
  readonly quantity: number
  /** null = inconnu (à vérifier). */
  readonly purchasable: boolean | null
  readonly sources: readonly { readonly parentId: string; readonly quantity: number }[]
}

/** Mutation sans recette de voisinage (Lonelily, Shellfruit, Godseed, Jerryflower). */
export interface SpecialNeed {
  readonly mutationId: string
  readonly text: string
  readonly missing: number
}

export interface Plan {
  readonly mode: PlanMode
  /** false si le mode Optimum est demandé sans route AVRG : le calcul est alors le minimum. */
  readonly optimumApplied: boolean
  /** Cibles regroupées par mutation. */
  readonly targets: readonly Target[]
  /** Toutes les mutations nécessaires (required > 0), possédées ou non. */
  readonly needs: ReadonlyMap<string, MutationNeed>
  /** Mutations à faire pousser (missing > 0, hors achats au bazar), ingrédients d'abord. */
  readonly farmOrder: readonly string[]
  /** Mutations à acheter au bazar (règle 5) et quantité manquante, dans l'ordre de farm. */
  readonly toBuy: readonly Target[]
  readonly baseCrops: readonly BaseCropNeed[]
  readonly special: readonly SpecialNeed[]
}

/** Regroupe des cibles par mutation en additionnant les quantités (ignore les quantités ≤ 0). */
export function mergeTargets(targets: readonly Target[]): Target[] {
  const totals = new Map<string, number>()
  for (const target of targets) {
    if (target.quantity > 0) totals.set(target.mutationId, (totals.get(target.mutationId) ?? 0) + target.quantity)
  }
  return [...totals].map(([mutationId, quantity]) => ({ mutationId, quantity }))
}

function sumByMutation(targets: readonly Target[]): Map<string, number> {
  return new Map(mergeTargets(targets).map((t) => [t.mutationId, t.quantity]))
}

function ownedCount(inventory: Inventory, id: string): number {
  const value = inventory[id] ?? 0
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
}

export function computePlan(data: GameData, request: PlanRequest): Plan {
  const levels = recipeLevels(data)
  const route = request.mode === 'optimum' ? (request.route ?? null) : null
  // Une cible inconnue (ex. ancienne sauvegarde après une modification du JSON) est ignorée.
  const targets = mergeTargets(request.targets).filter((t) => data.mutationsById.has(t.mutationId))
  const targetQuantity = sumByMutation(targets)
  const routeTargetQuantity = sumByMutation(route?.targets ?? [])
  const inRoute = (id: string | null) => id !== null && (route?.totals.get(id) ?? 0) > 0
  const buyable = request.buyable ?? NOTHING_BUYABLE

  // Parcours des recettes avant leurs ingrédients (niveau décroissant) : quand on arrive à une
  // mutation, toutes les recettes qui peuvent l'utiliser ont déjà été traitées.
  const order = [...data.mutations].sort((a, b) => (levels.get(b.id) ?? 0) - (levels.get(a.id) ?? 0))

  const incoming = new Map<string, NeedSource[]>()
  const baseCropSources = new Map<string, { parentId: string; quantity: number }[]>()
  const needs = new Map<string, MutationNeed>()

  for (const mutation of order) {
    const directTarget = targetQuantity.get(mutation.id) ?? 0
    const sources: NeedSource[] = [
      ...(directTarget > 0 ? [{ parentId: null, relation: 'target' as const, quantity: directTarget }] : []),
      ...(incoming.get(mutation.id) ?? []),
    ]
    const { required, basis } = requiredQuantity(sources, {
      routeTotal: route?.totals.get(mutation.id) ?? 0,
      routeTarget: routeTargetQuantity.get(mutation.id) ?? 0,
      inRoute,
      optimum: route !== null,
    })
    if (required === 0) continue

    const owned = ownedCount(request.inventory, mutation.id)
    const missing = Math.max(0, required - owned)
    const buy = missing > 0 && buyable.has(mutation.id)
    needs.set(mutation.id, {
      mutationId: mutation.id,
      required,
      owned,
      missing,
      buy,
      basis,
      level: levels.get(mutation.id) ?? 0,
      sources,
    })
    // Assez en stock (règle 3) ou achetée au bazar (règle 5) : la recette n'est pas lancée.
    if (missing === 0 || buy) continue

    for (const input of recipeInputs(data, mutation)) {
      // Une condition compte une fois par recette (règle 1) ; un prérequis consommé, par exemplaire.
      const quantity = input.relation === 'consumed' ? input.units * missing : input.units
      if (input.crop.kind === 'mutation') {
        push(incoming, input.crop.id, { parentId: mutation.id, relation: input.relation, quantity })
      } else {
        push(baseCropSources, input.crop.name, { parentId: mutation.id, quantity })
      }
    }
  }

  const byFarmOrder = compareFarmOrder(levels)
  const toObtain = data.mutations.filter((m) => (needs.get(m.id)?.missing ?? 0) > 0).sort(byFarmOrder)
  const toGrow = toObtain.filter((m) => needs.get(m.id)?.buy !== true)

  return {
    mode: request.mode,
    optimumApplied: route !== null,
    targets,
    needs,
    farmOrder: toGrow.map((m) => m.id),
    toBuy: toObtain
      .filter((m) => needs.get(m.id)?.buy === true)
      .map((m) => ({ mutationId: m.id, quantity: needs.get(m.id)?.missing ?? 0 })),
    baseCrops: [...baseCropSources]
      .map(([name, sources]) => ({
        name,
        quantity: sources.reduce((sum, s) => sum + s.quantity, 0),
        purchasable: data.baseCropsByName.get(name)?.purchasable ?? null,
        sources,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    special: toGrow
      .filter((m) => m.conditions.length === 0 && m.specialCondition !== null)
      .map((m) => ({ mutationId: m.id, text: m.specialCondition ?? '', missing: needs.get(m.id)?.missing ?? 0 })),
  }
}

interface RouteContext {
  /** Total AVRG de la mutation (0 si hors route). */
  readonly routeTotal: number
  /** Quantité consommée directement par l'objectif de la route. */
  readonly routeTarget: number
  readonly inRoute: (id: string | null) => boolean
  readonly optimum: boolean
}

/** Quantité totale nécessaire d'une mutation d'après ce que lui demandent ses sources. */
function requiredQuantity(
  sources: readonly NeedSource[],
  context: RouteContext,
): { required: number; basis: MutationNeed['basis'] } {
  let targets = 0
  let planted = 0
  let consumed = 0
  let catalyst = 0
  // Ce que demandent les recettes hors route (ajouté au total AVRG en mode Optimum).
  let outsideRoute = 0
  let neededByRouteRecipe = false

  for (const source of sources) {
    switch (source.relation) {
      case 'target':
        targets += source.quantity
        break
      case 'condition':
        planted += source.quantity
        if (context.inRoute(source.parentId)) neededByRouteRecipe = true
        else outsideRoute += source.quantity
        break
      case 'consumed':
        consumed += source.quantity
        if (!context.inRoute(source.parentId)) outsideRoute += source.quantity
        break
      case 'catalyst':
        // Un catalyseur doit être disponible mais n'est pas consommé : on garde le maximum.
        catalyst = Math.max(catalyst, source.quantity)
        break
    }
  }

  // Règle 4 : le total AVRG s'applique si la route a besoin de la mutation, soit comme cible
  // (légendaires de l'œuf), soit comme ingrédient posé autour d'une recette de la route.
  const useRoute =
    context.optimum && context.routeTotal > 0 && (context.routeTarget > 0 || neededByRouteRecipe)
  if (useRoute) {
    const extraTargets = Math.max(0, targets - context.routeTarget)
    return { required: Math.max(context.routeTotal + extraTargets + outsideRoute, catalyst), basis: 'avrg-optimum' }
  }
  return { required: Math.max(targets + planted + consumed, catalyst), basis: 'computed' }
}

function push<T>(map: Map<string, T[]>, key: string, value: T): void {
  const list = map.get(key)
  if (list) list.push(value)
  else map.set(key, [value])
}

// ---------------------------------------------------------------------------
// Arbre dépliable des besoins
// ---------------------------------------------------------------------------

export interface PlanTreeNode {
  /** Chemin unique dans l'arbre (clé React). */
  readonly key: string
  readonly crop: CropRef
  readonly relation: 'target' | InputRelation
  /**
   * Quantité pour ce parent : cible → quantité voulue ; condition → exemplaires à poser pour
   * cette recette ; consumed → exemplaires consommés par cette branche ; catalyst → minimum.
   */
  readonly quantity: number
  /** Cases demandées par une condition (0 sinon) : plus que `quantity` pour une mutation multi-cases. */
  readonly cells: number
  /** Besoin agrégé de la mutation dans le plan (null pour un crop de base). */
  readonly need: MutationNeed | null
  /** Recette dépliée seulement si la mutation manque et n'est pas achetée au bazar. */
  readonly children: readonly PlanTreeNode[]
}

/** Arbre des besoins, une racine par cible. Les sous-arbres partagés sont répétés. */
export function buildPlanTree(data: GameData, plan: Plan): PlanTreeNode[] {
  const build = (
    crop: CropRef,
    relation: PlanTreeNode['relation'],
    quantity: number,
    cells: number,
    key: string,
  ): PlanTreeNode => {
    if (crop.kind === 'base') return { key, crop, relation, quantity, cells, need: null, children: [] }
    const need = plan.needs.get(crop.id) ?? null
    const mutation: Mutation | undefined = data.mutationsById.get(crop.id)
    const children =
      mutation && need && need.missing > 0 && !need.buy
        ? recipeInputs(data, mutation).map((input, index) =>
            build(
              input.crop,
              input.relation,
              input.relation === 'consumed' ? input.units * quantity : input.units,
              input.cells,
              `${key}/${index}`,
            ),
          )
        : []
    return { key, crop, relation, quantity, cells, need, children }
  }
  return plan.targets.map((target) =>
    build({ kind: 'mutation', id: target.mutationId }, 'target', target.quantity, 0, target.mutationId),
  )
}

/** Toutes les clés de l'arbre (pour « tout déplier »). */
export function planTreeKeys(nodes: readonly PlanTreeNode[]): string[] {
  return nodes.flatMap((node) => [node.key, ...planTreeKeys(node.children)])
}

/** Avancement d'un plan : exemplaires déjà en stock sur le total nécessaire. */
export function planProgress(plan: Plan): { readonly done: number; readonly total: number } {
  let done = 0
  let total = 0
  for (const need of plan.needs.values()) {
    done += Math.min(need.owned, need.required)
    total += need.required
  }
  return { done, total }
}
