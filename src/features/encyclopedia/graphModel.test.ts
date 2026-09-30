import { describe, expect, it } from 'vitest'
import { recipesUsing } from '../../logic/graph'
import { computePlan } from '../../logic/recipes'
import { mutationById, projectData } from '../../test/projectData'
import { baseNodeId, buildGraph, COLUMN_WIDTH, mutationState } from './graphModel'

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

describe('graphe : disposition', () => {
  const graph = buildGraph(data, { showBaseCrops: false })

  it('place les 40 mutations en 5 colonnes, de Common à Legendary', () => {
    expect(graph.nodes).toHaveLength(40)
    expect(graph.columns.map((c) => [c.label, c.count])).toEqual([
      ['Common', 9],
      ['Uncommon', 6],
      ['Rare', 9],
      ['Epic', 9],
      ['Legendary', 7],
    ])
    for (const node of graph.nodes) {
      expect(node.x, node.id).toBe(mutationById(data, node.id).rarityRank * COLUMN_WIDTH)
    }
  })

  it('ne superpose jamais deux nœuds d’une même colonne', () => {
    for (const column of graph.columns) {
      const ys = graph.nodes.filter((n) => n.x === column.x).map((n) => n.y)
      expect(new Set(ys).size, column.label).toBe(ys.length)
    }
  })

  it('relie chaque recette à ses ingrédients mutations (conditions et prérequis)', () => {
    const edge = (source: string, target: string) => graph.edges.find((e) => e.source === source && e.target === target)
    expect(edge('chocoberry', 'blastberry')).toMatchObject({ relation: 'condition', cells: 5, units: 5 })
    expect(edge('snoozling', 'plantboy_advance')).toMatchObject({ cells: 6, units: 2 })
    expect(edge('turtlellini', 'shellfruit')).toMatchObject({ relation: 'consumed' })
    expect(edge('blastberry', 'shellfruit')).toMatchObject({ relation: 'catalyst' })
    expect(graph.edges.some((e) => e.source.startsWith('base:'))).toBe(false)
  })

  it('ajoute une colonne de crops de base en option', () => {
    const withBase = buildGraph(data, { showBaseCrops: true })
    expect(withBase.nodes).toHaveLength(57)
    expect(withBase.columns[0]).toMatchObject({ label: 'Crops de base', count: 17 })
    expect(withBase.edges.find((e) => e.source === baseNodeId('Wheat') && e.target === 'dustgrain')).toMatchObject({
      units: 2,
    })
  })

  it('donne une disposition identique à chaque calcul', () => {
    expect(buildGraph(data, { showBaseCrops: false })).toEqual(graph)
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
