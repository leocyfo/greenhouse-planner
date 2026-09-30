import { describe, expect, it } from 'vitest'
import { recipesUsing } from '../../logic/graph'
import { computePlan } from '../../logic/recipes'
import { mutationById, projectData } from '../../test/projectData'
import {
  amountText,
  baseNodeId,
  buildTree,
  CARD_WIDTH,
  edgeRole,
  focusOn,
  HEADER_HEIGHT,
  isDimmed,
  mutationState,
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
  const tree = buildTree(data, { showBaseCrops: false })
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
    const withBase = buildTree(data, { showBaseCrops: true })
    expect(withBase.nodes).toHaveLength(55)
    expect(withBase.columns[0]).toMatchObject({ title: 'Crops de base', count: 17 })
    expect(withBase.columns[1]).toMatchObject({ title: 'Étape 1', count: 9 })
    expect(withBase.edges.find((e) => e.source === baseNodeId('Wheat') && e.target === 'dustgrain')).toMatchObject({ units: 2 })
  })

  it('donne une disposition identique à chaque calcul', () => {
    expect(buildTree(data, { showBaseCrops: false })).toEqual(tree)
  })
})

describe('arbre : mutation mise en avant', () => {
  const tree = buildTree(data, { showBaseCrops: false })
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
