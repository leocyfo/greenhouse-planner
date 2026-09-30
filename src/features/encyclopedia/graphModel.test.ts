import { describe, expect, it } from 'vitest'
import { recipesUsing } from '../../logic/graph'
import { computePlan } from '../../logic/recipes'
import { mutationById, projectData } from '../../test/projectData'
import {
  amountText,
  baseNodeId,
  buildTree,
  CARD_WIDTH,
  chainOf,
  chainTotals,
  edgeRole,
  focusOn,
  HEADER_HEIGHT,
  isDimmed,
  MAX_COLUMN_GAP,
  MIN_COLUMN_GAP,
  mutationState,
  type TreeModel,
} from './graphModel'

const data = projectData()

describe('graphe : état des mutations', () => {
  const state = (id: string, inventory: Record<string, number> = {}, required = 0) =>
    mutationState(
      data,
      mutationById(data, id),
      required > 0
        ? { mutationId: id, required, owned: inventory[id] ?? 0, missing: 0, buy: false, basis: 'computed', level: 0, sources: [] }
        : undefined,
      inventory,
    )

  it('distingue disponible, verrouillée et spéciale', () => {
    expect(state('dustgrain')).toBe('available') // que des crops de base
    expect(state('lonelily')).toBe('available') // spawn seule sur les cases vides
    expect(state('chocoberry')).toBe('locked')
    expect(state('chocoberry', { choconut: 6, gloomgourd: 2 })).toBe('available')
    expect(state('godseed')).toBe('special')
  })

  it('est complétée avec au moins un exemplaire et tout ce que demandent les objectifs', () => {
    expect(state('dustgrain', { dustgrain: 1 })).toBe('complete')
    expect(state('dustgrain', { dustgrain: 5 }, 11)).toBe('available')
    expect(state('dustgrain', { dustgrain: 11 }, 11)).toBe('complete')
  })
})

describe('arbre : disposition par étape', () => {
  const tree = buildTree(data, { arrangement: 'step', showBaseCrops: false })
  const node = (id: string) => tree.nodes.find((n) => n.id === id)

  it("range chaque mutation dans la colonne de son étape, les conditions spéciales à part", () => {
    expect(tree.columns.map((c) => [c.title, c.count])).toEqual([
      ['Étape 1', 9],
      ['Étape 2', 8],
      ['Étape 3', 8],
      ['Étape 4', 7],
      ['Étape 5', 5],
      ['Étape 6', 1],
    ])
    expect(tree.nodes).toHaveLength(38)
    expect([...tree.specials].sort()).toEqual(['godseed', 'jerryflower'])
    expect(node('dustgrain')?.column).toBe(0)
    expect(node('all_in_aloe')?.column).toBe(5)
  })

  it('fait aller tous les liens de gauche à droite, du bord de l’ingrédient à celui de la recette', () => {
    for (const edge of tree.edges) {
      const from = node(edge.source)
      const to = node(edge.target)
      expect(from && to && from.column < to.column, edge.id).toBe(true)
      expect(edge.path.startsWith(`M${(from?.x ?? 0) + CARD_WIDTH} `), edge.id).toBe(true)
      expect(edge.path.split(' ').at(-2)?.endsWith(String(to?.x)), edge.id).toBe(true)
    }
  })

  it('ne superpose jamais deux cartes et reste sous les titres', () => {
    for (const column of tree.columns) {
      const cards = tree.nodes.filter((n) => n.x === column.x).sort((a, b) => a.y - b.y)
      cards.forEach((card, index) => {
        expect(card.y, card.id).toBeGreaterThanOrEqual(HEADER_HEIGHT)
        expect(card.y + card.height, card.id).toBeLessThanOrEqual(tree.height)
        const next = cards[index + 1]
        if (next) expect(card.y + card.height, card.id).toBeLessThan(next.y)
      })
    }
  })

  it('relie chaque recette à ses ingrédients mutations (conditions et prérequis)', () => {
    const edge = (source: string, target: string) => tree.edges.find((e) => e.source === source && e.target === target)
    expect(edge('chocoberry', 'blastberry')).toMatchObject({ relation: 'condition', cells: 5, units: 5 })
    expect(edge('snoozling', 'plantboy_advance')).toMatchObject({ cells: 6, units: 2 })
    expect(edge('turtlellini', 'shellfruit')).toMatchObject({ relation: 'consumed' })
    expect(edge('blastberry', 'shellfruit')).toMatchObject({ relation: 'catalyst' })
    expect(tree.edges).toHaveLength(57)
    expect(tree.edges.some((e) => e.source.startsWith('base:'))).toBe(false)
  })

  it('ajoute une colonne de crops de base en option', () => {
    const withBase = buildTree(data, { arrangement: 'step', showBaseCrops: true })
    expect(withBase.nodes).toHaveLength(55)
    expect(withBase.columns[0]).toMatchObject({ title: 'Crops de base', count: 17 })
    expect(withBase.columns[1]).toMatchObject({ title: 'Étape 1', count: 9 })
    expect(withBase.edges.find((e) => e.source === baseNodeId('Wheat') && e.target === 'dustgrain')).toMatchObject({ units: 2 })
  })

  it('donne une disposition identique à chaque calcul', () => {
    expect(buildTree(data, { arrangement: 'step', showBaseCrops: false })).toEqual(tree)
  })

  it('ne fait jamais passer un lien sous une carte : il traverse chaque étape sautée entre les cartes', () => {
    expectNoEdgeUnderCards(tree)
    expectNoEdgeUnderCards(buildTree(data, { arrangement: 'step', showBaseCrops: true }))
  })

  it("adapte l'espace entre les colonnes à la largeur disponible, dans des bornes", () => {
    const gapOf = (model: TreeModel) => (model.columns[1]?.x ?? 0) - CARD_WIDTH
    const wide = buildTree(data, { arrangement: 'step', showBaseCrops: false, availableWidth: 1850 })
    expect(gapOf(wide)).toBe(MAX_COLUMN_GAP)
    expect(gapOf(buildTree(data, { arrangement: 'step', showBaseCrops: false, availableWidth: 1300 }))).toBe(Math.floor((1300 - 6 * CARD_WIDTH) / 5))
    const narrow = buildTree(data, { arrangement: 'step', showBaseCrops: false, availableWidth: 400 })
    expect(gapOf(narrow)).toBe(MIN_COLUMN_GAP) // plus large que l'écran : l'arbre défile
    expect(narrow.width).toBeGreaterThan(400)
    // Seules les abscisses changent.
    expect(wide.nodes.map((n) => [n.id, n.y])).toEqual(narrow.nodes.map((n) => [n.id, n.y]))
  })
})

/** Chaque lien traverse les colonnes qu'il saute par un segment droit (L), hors de toute carte. */
function expectNoEdgeUnderCards(model: TreeModel) {
  const nodeById = new Map(model.nodes.map((n) => [n.id, n]))
  for (const edge of model.edges) {
    const from = nodeById.get(edge.source)
    const to = nodeById.get(edge.target)
    const points = [...edge.path.matchAll(/([MCL])([^MCL]+)/g)].map(([, command, args]) => {
      const numbers = (args ?? '').trim().split(/\s+/).map(Number)
      return { command, x: numbers.at(-2) ?? 0, y: numbers.at(-1) ?? 0 }
    })
    const crossings = points.flatMap((point, index) => (point.command === 'L' ? [{ from: points[index - 1], to: point }] : []))
    expect(crossings, edge.id).toHaveLength((to?.column ?? 0) - (from?.column ?? 0) - 1)
    for (const crossing of crossings) {
      expect(crossing.from?.y, edge.id).toBe(crossing.to.y)
      const cards = model.nodes.filter((n) => n.x === crossing.from?.x)
      expect(cards.length, edge.id).toBeGreaterThan(0)
      for (const card of cards) {
        const outside = crossing.to.y < card.y - 4 || crossing.to.y > card.y + card.height + 4
        expect(outside, `${edge.id} sous ${card.id}`).toBe(true)
      }
    }
  }
}

describe('arbre : mutation choisie', () => {
  const ids = (model: TreeModel) => model.nodes.map((n) => n.id).sort()
  const columns = (model: TreeModel) => model.columns.map((c) => [c.title, c.count])

  it('liste toutes les mutations à faire avant une mutation', () => {
    expect([...chainOf(data, 'blastberry')].sort()).toEqual(['ashwreath', 'chocoberry', 'choconut', 'gloomgourd'])
    expect(chainOf(data, 'dustgrain').size).toBe(0)
    expect(chainOf(data, 'glasscorn').size).toBe(13)
  })

  it('« avant et après » : ses ingrédients directs et les recettes qui l’utilisent, dans leurs étapes', () => {
    const model = buildTree(data, { arrangement: 'step', showBaseCrops: false, selection: { id: 'snoozling', mode: 'neighbors' } })
    expect(ids(model)).toEqual(
      ['creambloom', 'dustgrain', 'duskbloom', 'plantboy_advance', 'puffercloud', 'snoozling', 'stoplight_petal', 'thornshade', 'witherbloom'].sort(),
    )
    expect(model.edges.every((e) => e.source === 'snoozling' || e.target === 'snoozling')).toBe(true)
    expect(model.edges).toHaveLength(8)
    expect(columns(model)).toEqual([
      ['Étape 1', 2],
      ['Étape 2', 3],
      ['Étape 3', 1],
      ['Étape 4', 2],
      ['Étape 5', 1],
    ])
    expectNoEdgeUnderCards(model)
  })

  it('« tout le chemin » : toutes les mutations à faire avant elle, et rien après', () => {
    const model = buildTree(data, { arrangement: 'step', showBaseCrops: false, selection: { id: 'glasscorn', mode: 'chain' } })
    expect(ids(model)).toEqual(['glasscorn', ...chainOf(data, 'glasscorn')].sort())
    expect(columns(model)).toEqual([
      ['Étape 1', 5],
      ['Étape 2', 4],
      ['Étape 3', 3],
      ['Étape 4', 1],
      ['Étape 5', 1],
    ])
    const focus = focusOn(model.edges, 'glasscorn')
    expect(model.edges.every((e) => edgeRole(e, focus) === 'path')).toBe(true)
    expectNoEdgeUnderCards(model)
  })

  it('garde les étapes sans mutation affichée hors de la vue, et les crops de base utilisés seulement', () => {
    const aloe = buildTree(data, { arrangement: 'step', showBaseCrops: false, selection: { id: 'all_in_aloe', mode: 'neighbors' } })
    expect(columns(aloe)).toEqual([
      ['Étape 3', 1],
      ['Étape 5', 1],
      ['Étape 6', 1],
    ])
    const withBase = buildTree(data, { arrangement: 'step', showBaseCrops: true, selection: { id: 'blastberry', mode: 'chain' } })
    expect(withBase.columns[0]).toMatchObject({ title: 'Crops de base', count: 5 })
    expect(ids(withBase).filter((id) => id.startsWith('base:'))).toEqual(
      ['Cocoa Beans', 'Fire', 'Melon', 'Nether Wart', 'Pumpkin'].map(baseNodeId).sort(),
    )
  })

  it('montre tout l’arbre pour une mutation hors de l’arbre ou inconnue', () => {
    const full = buildTree(data, { arrangement: 'step', showBaseCrops: false })
    expect(buildTree(data, { arrangement: 'step', showBaseCrops: false, selection: { id: 'godseed', mode: 'chain' } })).toEqual(full)
    expect(buildTree(data, { arrangement: 'step', showBaseCrops: false, selection: { id: 'inconnue', mode: 'neighbors' } })).toEqual(full)
  })
})

describe('arbre : mutation mise en avant', () => {
  const tree = buildTree(data, { arrangement: 'step', showBaseCrops: false })
  const edge = (source: string, target: string) => tree.edges.find((e) => e.source === source && e.target === target)

  it("montre tout son chemin jusqu'au départ, et les recettes qui l'utilisent", () => {
    const focus = focusOn(tree.edges, 'blastberry')
    expect([...focus.path].sort()).toEqual(['ashwreath', 'chocoberry', 'choconut', 'gloomgourd'])
    expect([...focus.uses].sort()).toEqual(['shellfruit', 'startlevine'])
    const role = (source: string, target: string) => {
      const found = edge(source, target)
      return found ? edgeRole(found, focus) : 'absent'
    }
    expect(role('chocoberry', 'blastberry')).toBe('path')
    expect(role('choconut', 'chocoberry')).toBe('path')
    expect(role('blastberry', 'startlevine')).toBe('use')
    expect(role('cheesebite', 'startlevine')).toBe('none')
  })

  it('estompe le reste, et rien sans mise en avant', () => {
    const focus = focusOn(tree.edges, 'blastberry')
    expect(isDimmed('cheesebite', focus)).toBe(true)
    expect(isDimmed('choconut', focus)).toBe(false)
    expect(isDimmed('startlevine', focus)).toBe(false)
    expect(isDimmed('cheesebite', null)).toBe(false)
  })

  it('écrit la quantité de chaque ingrédient', () => {
    expect(amountText({ relation: 'condition', units: 5 })).toBe('×5')
    expect(amountText({ relation: 'consumed', units: 1 })).toBe('1 consommé')
    expect(amountText({ relation: 'catalyst', units: 2 })).toBe('2 catalyseur')
  })
})

describe('graphe : recettes qui utilisent une mutation', () => {
  it('liste les recettes où la mutation sert, avec la quantité', () => {
    expect(recipesUsing(data, 'snoozling').map((use) => [use.mutationId, use.units])).toEqual([
      ['plantboy_advance', 2],
      ['puffercloud', 1],
      ['stoplight_petal', 2],
    ])
    expect(recipesUsing(data, 'blastberry').map((use) => [use.mutationId, use.relation])).toEqual([
      ['shellfruit', 'catalyst'],
      ['startlevine', 'condition'],
    ])
    expect(recipesUsing(data, 'glasscorn')).toEqual([])
  })

  it("s'appuie sur le même plan que le reste de l'app pour l'état", () => {
    const plan = computePlan(data, { targets: [{ mutationId: 'dustgrain', quantity: 3 }], inventory: { dustgrain: 3 }, mode: 'minimum' })
    expect(mutationState(data, mutationById(data, 'dustgrain'), plan.needs.get('dustgrain'), { dustgrain: 3 })).toBe('complete')
  })
})

describe('arbre : colonnes par rareté', () => {
  const tree = buildTree(data, { arrangement: 'rarity', showBaseCrops: false })
  const headers = (model: TreeModel) => model.headers.map((h) => [h.title, h.count])

  it('range chaque mutation dans la colonne de sa rareté, de Common à Legendary', () => {
    expect(headers(tree)).toEqual([
      ['Common', 9],
      ['Uncommon', 6],
      ['Rare', 9],
      ['Epic', 9],
      ['Legendary', 5],
    ])
    for (const node of tree.nodes) {
      const header = tree.headers.find((h) => node.x >= h.x && node.x < h.x + h.width)
      expect(header?.rarity, node.id).toBe(mutationById(data, node.id).rarity)
    }
  })

  it('coupe une rareté en deux quand une recette demande une mutation de la même rareté', () => {
    const epic = tree.columns.filter((c) => c.title === 'Epic')
    expect(epic.map((c) => c.count)).toEqual([7, 2])
    const second = tree.nodes.filter((n) => n.x === epic[1]?.x).map((n) => n.id)
    expect(second.sort()).toEqual(['plantboy_advance', 'shellfruit'])
  })

  it('garde tous les liens de gauche à droite, jamais sous une carte', () => {
    for (const model of [
      tree,
      buildTree(data, { arrangement: 'rarity', showBaseCrops: true }),
      buildTree(data, { arrangement: 'rarity', showBaseCrops: false, selection: { id: 'all_in_aloe', mode: 'chain' } }),
    ]) {
      const column = new Map(model.nodes.map((n) => [n.id, n.column]))
      for (const edge of model.edges) expect((column.get(edge.source) ?? 0) < (column.get(edge.target) ?? 0), edge.id).toBe(true)
      expectNoEdgeUnderCards(model)
    }
  })

  it("ne coupe pas la rareté quand l'ingrédient de même rareté n'est pas affiché", () => {
    const model = buildTree(data, { arrangement: 'rarity', showBaseCrops: false, selection: { id: 'blastberry', mode: 'neighbors' } })
    expect(headers(model)).toEqual([
      ['Common', 1],
      ['Uncommon', 1],
      ['Rare', 1],
      ['Epic', 2],
    ])
    expect(model.columns).toHaveLength(4)
  })

  it('garde l’étape de fabrication de chaque mutation', () => {
    const step = (id: string) => tree.nodes.find((n) => n.id === id)?.step
    expect(step('dustgrain')).toBe(1)
    expect(step('soggybud')).toBe(2)
    expect(step('all_in_aloe')).toBe(6)
  })

  it('revient aux étapes si une recette demandait un jour une mutation plus rare qu’elle', () => {
    const mutations = data.mutations.map((m) => (m.id === 'chocoberry' ? { ...m, rarity: 'LEGENDARY', rarityRank: 4 } : m))
    const changed = { ...data, mutations, mutationsById: new Map(mutations.map((m) => [m.id, m])) }
    expect(buildTree(changed, { arrangement: 'rarity', showBaseCrops: false }).headers[0]?.title).toBe('Étape 1')
  })
})

describe('arbre : quantités de « Tout le chemin »', () => {
  it('donne le total de chaque ingrédient pour 1 exemplaire, comme le Calculateur en mode Minimum', () => {
    const totals = chainTotals(data, 'blastberry')
    expect(Object.fromEntries(totals)).toMatchObject({ chocoberry: 5, ashwreath: 3, choconut: 6, gloomgourd: 2 })
    expect(totals.has('blastberry')).toBe(false)
    // Les crops de base aussi, pour la colonne des crops de base.
    expect(totals.get(baseNodeId('Cocoa Beans'))).toBeGreaterThan(0)
  })

  it('ne compte pas le stock et suit le calcul du plan', () => {
    const plan = computePlan(data, { targets: [{ mutationId: 'all_in_aloe', quantity: 1 }], inventory: {}, mode: 'minimum' })
    const totals = chainTotals(data, 'all_in_aloe')
    for (const id of chainOf(data, 'all_in_aloe')) expect(totals.get(id), id).toBe(plan.needs.get(id)?.required)
  })
})
