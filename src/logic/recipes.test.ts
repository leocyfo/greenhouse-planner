import { describe, expect, it } from 'vitest'
import { mutationById, projectData } from '../test/projectData'
import { mergeGoalTargets } from './goals'
import { recipeInputs, recipeLevels } from './graph'
import {
  bazaarBuyable,
  buildPlanTree,
  computePlan,
  planTreeKeys,
  type Plan,
  type PlanRequest,
  type PlanTreeNode,
} from './recipes'

const data = projectData()
const NONE = new Set<string>()
const roseDragon = mergeGoalTargets(data, new Set(['rose_dragon']), NONE)

function plan(targets: Record<string, number>, options: Partial<PlanRequest> = {}): Plan {
  return computePlan(data, {
    targets: Object.entries(targets).map(([mutationId, quantity]) => ({ mutationId, quantity })),
    inventory: {},
    mode: 'minimum',
    ...options,
  })
}

function roseDragonPlan(options: Partial<PlanRequest> = {}): Plan {
  return computePlan(data, { targets: roseDragon.targets, inventory: {}, mode: 'minimum', ...options })
}

function required(p: Plan): Record<string, number> {
  return Object.fromEntries([...p.needs].map(([id, need]) => [id, need.required]))
}

function baseCrops(p: Plan): Record<string, number> {
  return Object.fromEntries(p.baseCrops.map((crop) => [crop.name, crop.quantity]))
}

function child(node: PlanTreeNode | undefined, id: string): PlanTreeNode {
  const found = node?.children.find((c) => (c.crop.kind === 'mutation' ? c.crop.id : c.crop.name) === id)
  if (!found) throw new Error(`Enfant introuvable : ${id}`)
  return found
}

function countNodes(nodes: readonly PlanTreeNode[]): number {
  return nodes.reduce((sum, node) => sum + 1 + countNodes(node.children), 0)
}

describe('recettes : règles de base', () => {
  it('une mutation commune demande ses crops de base', () => {
    const p = plan({ dustgrain: 1 })
    expect(required(p)).toEqual({ dustgrain: 1 })
    expect(baseCrops(p)).toEqual({ Wheat: 2 })
    expect(p.farmOrder).toEqual(['dustgrain'])
  })

  it('une recette demande ses ingrédients mutations, puis leurs crops de base', () => {
    const p = plan({ chocoberry: 1 })
    expect(required(p)).toEqual({ chocoberry: 1, choconut: 6, gloomgourd: 2 })
    expect(baseCrops(p)).toEqual({ 'Cocoa Beans': 2, Melon: 1, Pumpkin: 1 })
  })

  it('la quantité voulue ne multiplie pas les ingrédients : un anneau fait spawn plusieurs fois', () => {
    expect(required(plan({ chocoberry: 5 }))).toEqual({ chocoberry: 5, choconut: 6, gloomgourd: 2 })
  })

  it('deux recettes différentes additionnent leurs ingrédients (lock-in)', () => {
    // Chocoberry : 6 Choconut ; Creambloom : 8 Choconut.
    expect(required(plan({ chocoberry: 1, creambloom: 1 })).choconut).toBe(14)
  })

  it('ignore les cibles inconnues et les quantités nulles', () => {
    const p = plan({ mutation_supprimee: 3, dustgrain: 0, choconut: 2 })
    expect(p.targets).toEqual([{ mutationId: 'choconut', quantity: 2 }])
    expect(buildPlanTree(data, p)).toHaveLength(1)
  })

  it('convertit les cases en mutations pour les ingrédients multi-cases', () => {
    const inputs = (id: string) => recipeInputs(data, mutationById(data, id))
    expect(inputs('all_in_aloe')).toContainEqual(
      expect.objectContaining({ crop: { kind: 'mutation', id: 'plantboy_advance' }, cells: 2, units: 1 }),
    )
    expect(inputs('plantboy_advance')).toContainEqual(
      expect.objectContaining({ crop: { kind: 'mutation', id: 'snoozling' }, cells: 6, units: 2 }),
    )
    expect(inputs('thunderling')).toContainEqual(
      expect.objectContaining({ crop: { kind: 'mutation', id: 'noctilume' }, cells: 3, units: 2 }),
    )
  })
})

describe('recettes : arbre complet du Rose Dragon (minimum, inventaire vide)', () => {
  const p = roseDragonPlan()

  it('calcule le besoin de chacune des 38 mutations de la route', () => {
    expect(required(p)).toEqual({
      // Légendaires consommés par l'œuf
      glasscorn: 1, devourer: 1, all_in_aloe: 1, phantomleaf: 1, timestalk: 1,
      // Épiques et rares
      startlevine: 6, chloronite: 11, puffercloud: 4, zombud: 4, magic_jellybean: 9,
      plantboy_advance: 1, chorus_fruit: 6, shellfruit: 6, stoplight_petal: 4, thunderling: 6,
      snoozling: 5, noctilume: 4, turtlellini: 6, blastberry: 4, cheesebite: 4, fleshtrap: 2,
      do_not_eat_shroom: 6, soggybud: 9,
      // Peu communes
      cindershade: 6, coalroot: 6, creambloom: 8, thornshade: 5, duskbloom: 12, chocoberry: 5,
      // Communes
      lonelily: 10, veilshroom: 8, scourroot: 7, ashwreath: 12, witherbloom: 7, dustgrain: 5,
      gloomgourd: 4, shadevine: 2, choconut: 18,
    })
  })

  it('redonne les minimums AVRG là où ses plans ne partagent pas de crops entre recettes', () => {
    // Écarts attendus, dus aux plans AVRG : Snoozling, Noctilume, Chorus Fruit, Shellfruit et
    // Turtlellini (crops partagés entre deux recettes), Chocoberry (explosions des Blastberry),
    // Magic Jellybean (8 contre 9) et les communes (fermes à plusieurs emplacements).
    const matching = [
      'chloronite', 'duskbloom', 'soggybud', 'creambloom', 'thornshade', 'cindershade',
      'do_not_eat_shroom', 'coalroot', 'fleshtrap', 'blastberry', 'cheesebite', 'startlevine',
      'puffercloud', 'zombud', 'stoplight_petal', 'thunderling', 'plantboy_advance',
      'glasscorn', 'devourer', 'all_in_aloe', 'phantomleaf', 'timestalk',
    ]
    for (const id of matching) {
      expect(p.needs.get(id)?.required, id).toBe(mutationById(data, id).roseDragonMinimum)
    }
  })

  it('additionne les crops de base de toutes les recettes lancées', () => {
    expect(baseCrops(p)).toEqual({
      'Brown Mushroom': 1, Cactus: 1, Carrot: 1, 'Cocoa Beans': 2, 'Dead Plant': 8, Fermento: 4,
      Fire: 2, Melon: 3, Moonflower: 2, 'Nether Wart': 2, Potato: 1, Pumpkin: 1, 'Red Mushroom': 1,
      'Sugar Cane': 6, Sunflower: 2, Wheat: 2, 'Wild Rose': 4,
    })
  })

  it("construit l'arbre dépliable depuis les 5 légendaires", () => {
    const tree = buildPlanTree(data, p)
    expect(tree.map((node) => node.crop)).toEqual(
      ['glasscorn', 'devourer', 'all_in_aloe', 'phantomleaf', 'timestalk'].map((id) => ({ kind: 'mutation', id })),
    )
    const glasscorn = tree[0]
    expect(glasscorn?.children.map((c) => [c.crop, c.relation, c.quantity])).toEqual([
      [{ kind: 'mutation', id: 'startlevine' }, 'condition', 6],
      [{ kind: 'mutation', id: 'chloronite' }, 'condition', 6],
    ])
    const blastberry = child(child(glasscorn, 'startlevine'), 'blastberry')
    expect(blastberry.children.map((c) => [c.crop, c.quantity])).toEqual([
      [{ kind: 'mutation', id: 'chocoberry' }, 5],
      [{ kind: 'mutation', id: 'ashwreath' }, 3],
    ])
    expect(child(child(blastberry, 'ashwreath'), 'Fire')).toMatchObject({ quantity: 2, need: null, children: [] })
    // Un PlantBoy 2x2 fournit les 2 cases demandées par All-in Aloe.
    expect(child(tree[2], 'plantboy_advance')).toMatchObject({ quantity: 1, cells: 2 })
    // Shellfruit : Turtlellini consommées (1 par Shellfruit), Blastberry en catalyseur.
    const shellfruit = child(tree[3], 'shellfruit')
    expect(shellfruit.children.map((c) => [c.crop, c.relation, c.quantity])).toEqual([
      [{ kind: 'mutation', id: 'turtlellini' }, 'consumed', 4],
      [{ kind: 'mutation', id: 'blastberry' }, 'catalyst', 2],
    ])
    // Chaque recette dépliée sous chacun de ses parents : 245 nœuds au total.
    expect(countNodes(tree)).toBe(245)
    expect(new Set(planTreeKeys(tree)).size).toBe(245) // clés uniques
  })

  it('ne déplie pas une mutation déjà en stock', () => {
    const tree = buildPlanTree(data, roseDragonPlan({ inventory: { startlevine: 6 } }))
    expect(child(tree[0], 'startlevine').children).toEqual([])
  })

  it('ordonne la farm des ingrédients vers les légendaires (tri topologique)', () => {
    const position = new Map(p.farmOrder.map((id, index) => [id, index]))
    for (const id of p.farmOrder) {
      for (const input of recipeInputs(data, mutationById(data, id))) {
        if (input.crop.kind !== 'mutation') continue
        const ingredientPosition = position.get(input.crop.id)
        if (ingredientPosition !== undefined) {
          expect(ingredientPosition, `${input.crop.id} avant ${id}`).toBeLessThan(position.get(id) ?? -1)
        }
      }
    }
    expect(p.farmOrder).toHaveLength(38)
    expect(p.farmOrder.at(-1)).toBe('all_in_aloe') // niveau le plus haut (5)
  })
})

describe("recettes : soustraction de l'inventaire à chaque niveau", () => {
  it("une cible déjà possédée n'est pas lancée et ne demande aucun ingrédient", () => {
    const p = roseDragonPlan({ inventory: { glasscorn: 1 } })
    expect(p.needs.get('glasscorn')).toMatchObject({ required: 1, owned: 1, missing: 0 })
    expect(p.needs.has('startlevine')).toBe(false)
    expect(p.needs.get('chloronite')?.required).toBe(5) // reste le Chorus Fruit
  })

  it("un ingrédient en stock coupe sa branche, mais le catalyseur reste demandé", () => {
    const p = roseDragonPlan({ inventory: { startlevine: 6 } })
    expect(p.needs.get('startlevine')?.missing).toBe(0)
    expect(p.needs.has('cheesebite')).toBe(false)
    // Les Blastberry ne servent plus qu'aux explosions du Shellfruit.
    expect(p.needs.get('blastberry')?.required).toBe(2)
  })

  it("un stock partiel ne coupe pas la recette : l'anneau reste nécessaire", () => {
    const p = roseDragonPlan({ inventory: { startlevine: 3 } })
    expect(p.needs.get('startlevine')).toMatchObject({ required: 6, owned: 3, missing: 3 })
    expect(p.needs.get('blastberry')?.required).toBe(4)
    expect(p.needs.get('cheesebite')?.required).toBe(4)
  })

  it("un stock supérieur au besoin n'est jamais compté en négatif", () => {
    const p = plan({ chocoberry: 1 }, { inventory: { choconut: 50, chocoberry: 0 } })
    expect(p.needs.get('choconut')).toMatchObject({ required: 6, owned: 50, missing: 0 })
    expect(p.farmOrder).toEqual(['gloomgourd', 'chocoberry'])
  })
})

describe('recettes : conditions spéciales', () => {
  it('Shellfruit consomme une Turtlellini par exemplaire et demande des Blastberry en catalyseur', () => {
    const p = plan({ shellfruit: 3 })
    expect(p.needs.get('turtlellini')?.required).toBe(3)
    expect(p.needs.get('blastberry')?.required).toBe(2)
    expect(p.special).toEqual([
      { mutationId: 'shellfruit', text: mutationById(data, 'shellfruit').specialCondition, missing: 3 },
    ])
    const position = (id: string) => p.farmOrder.indexOf(id)
    expect(position('turtlellini')).toBeLessThan(position('shellfruit'))
    expect(position('blastberry')).toBeLessThan(position('shellfruit'))
  })

  it('Godseed et Jerryflower affichent leur condition spéciale, sans ingrédient', () => {
    const p = plan({ godseed: 1, jerryflower: 1 })
    expect(p.special.map((s) => s.mutationId)).toEqual(['godseed', 'jerryflower'])
    expect(p.special[0]?.text).toBe(mutationById(data, 'godseed').specialCondition)
    expect(p.baseCrops).toEqual([])
  })

  it('Lonelily apparaît dans les conditions spéciales quand une recette en demande', () => {
    const p = plan({ noctilume: 1 })
    expect(p.needs.get('lonelily')?.required).toBe(6)
    expect(p.special.map((s) => s.mutationId)).toEqual(['lonelily'])
  })
})

describe('recettes : mutations analysées achetées au bazar (option)', () => {
  const buyable = (...ids: string[]) => ({ buyable: new Set(ids) })

  it("achète la mutation au lieu de la cultiver : ni ingrédient, ni farm, ni arbre déplié", () => {
    const p = plan({ dustgrain: 3 }, buyable('dustgrain'))
    expect(p.toBuy).toEqual([{ mutationId: 'dustgrain', quantity: 3 }])
    expect(p.needs.get('dustgrain')).toMatchObject({ required: 3, missing: 3, buy: true })
    expect(p.farmOrder).toEqual([])
    expect(baseCrops(p)).toEqual({})
    expect(buildPlanTree(data, p)[0]?.children).toEqual([])
  })

  it("un ingrédient acheté coupe sa branche ; la recette qui l'utilise reste cultivée", () => {
    const p = plan({ chocoberry: 1 }, buyable('choconut'))
    expect(required(p)).toEqual({ chocoberry: 1, choconut: 6, gloomgourd: 2 })
    expect(p.toBuy).toEqual([{ mutationId: 'choconut', quantity: 6 }])
    expect(p.farmOrder).toEqual(['gloomgourd', 'chocoberry'])
    expect(baseCrops(p)).toEqual({ Melon: 1, Pumpkin: 1 })
  })

  it("n'achète que ce qui manque, et rien quand le stock suffit", () => {
    expect(plan({ dustgrain: 3 }, { ...buyable('dustgrain'), inventory: { dustgrain: 1 } }).toBuy).toEqual([
      { mutationId: 'dustgrain', quantity: 2 },
    ])
    const stocked = plan({ dustgrain: 3 }, { ...buyable('dustgrain'), inventory: { dustgrain: 3 } })
    expect(stocked.toBuy).toEqual([])
    expect(stocked.needs.get('dustgrain')?.buy).toBe(false)
  })

  it('un Shellfruit acheté ne consomme plus de Turtlellini et ne demande plus de Blastberry', () => {
    const p = plan({ shellfruit: 2 }, buyable('shellfruit'))
    expect(required(p)).toEqual({ shellfruit: 2 })
    expect(p.special).toEqual([])
  })

  it("n'achète rien quand l'option est désactivée", () => {
    const analyzed = new Set(['dustgrain'])
    expect(bazaarBuyable(analyzed, true)).toBe(analyzed)
    expect(bazaarBuyable(analyzed, false).size).toBe(0)
    expect(plan({ dustgrain: 1 }, { buyable: bazaarBuyable(analyzed, false) }).farmOrder).toEqual(['dustgrain'])
    expect(roseDragonPlan().toBuy).toEqual([])
  })
})

describe('recettes : mode Optimum (route AVRG)', () => {
  it('reprend exactement les totaux AVRG pour les 38 mutations de la route', () => {
    const p = roseDragonPlan({ mode: 'optimum', route: roseDragon.route })
    expect(p.optimumApplied).toBe(true)
    const routeMutations = data.mutations.filter((m) => m.roseDragonOptimum > 0)
    expect(routeMutations).toHaveLength(38)
    for (const m of routeMutations) expect(p.needs.get(m.id)?.required, m.id).toBe(m.roseDragonOptimum)
    expect(p.needs.get('snoozling')?.basis).toBe('avrg-optimum')
  })

  it("ajoute les besoins des autres objectifs par-dessus (ex. +1 pour l'analyse)", () => {
    const goals = mergeGoalTargets(data, new Set(['rose_dragon', 'analyze_all']), NONE)
    const p = computePlan(data, { targets: goals.targets, inventory: {}, mode: 'optimum', route: goals.route })
    expect(p.needs.get('blastberry')?.required).toBe(8) // 7 AVRG + 1 pour l'analyse
    expect(p.needs.get('glasscorn')?.required).toBe(2) // l'œuf + l'analyse
    expect(p.needs.get('godseed')).toMatchObject({ required: 1, basis: 'computed' })
  })

  it('sans route AVRG, le mode Optimum retombe sur le minimum', () => {
    const optimum = plan({ glasscorn: 1 }, { mode: 'optimum' })
    expect(optimum.optimumApplied).toBe(false)
    expect(required(optimum)).toEqual(required(plan({ glasscorn: 1 })))
  })

  it('une branche déjà faite ne reçoit plus le total AVRG', () => {
    const p = roseDragonPlan({ mode: 'optimum', route: roseDragon.route, inventory: { startlevine: 6 } })
    expect(p.needs.has('cheesebite')).toBe(false)
    expect(p.needs.get('blastberry')).toMatchObject({ required: 2, basis: 'computed' })
  })
})

describe('graphe : niveaux des recettes', () => {
  it('place chaque mutation au-dessus de ses ingrédients', () => {
    const levels = recipeLevels(data)
    expect(levels.get('dustgrain')).toBe(0)
    expect(levels.get('lonelily')).toBe(0)
    expect(levels.get('chocoberry')).toBe(1)
    expect(levels.get('blastberry')).toBe(2)
    expect(levels.get('shellfruit')).toBe(3)
    expect(levels.get('startlevine')).toBe(3)
    expect(levels.get('glasscorn')).toBe(4)
    expect(levels.get('all_in_aloe')).toBe(5)
  })
})
