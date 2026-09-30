import { describe, expect, it } from 'vitest'
import { projectData } from '../test/projectData'
import { goalCompletion, goalProgress, mergeGoalTargets } from './goals'
import { computePlan, planProgress } from './recipes'

const data = projectData()
const NONE = new Set<string>()

function goal(id: string) {
  const found = data.goals.find((g) => g.id === id)
  if (!found) throw new Error(`Objectif introuvable : ${id}`)
  return found
}

describe('objectifs : fusion des cibles', () => {
  it('Rose Dragon : 1 de chaque légendaire, ses coûts et la route AVRG', () => {
    const merged = mergeGoalTargets(data, new Set(['rose_dragon']), NONE)
    expect(merged.targets).toEqual([
      { mutationId: 'glasscorn', quantity: 1 },
      { mutationId: 'devourer', quantity: 1 },
      { mutationId: 'all_in_aloe', quantity: 1 },
      { mutationId: 'phantomleaf', quantity: 1 },
      { mutationId: 'timestalk', quantity: 1 },
    ])
    expect(merged.other).toEqual({ Coins: 500_000_000, Copper: 20_000, 'Condensed Helianthus': 5 })
    expect(merged.route?.targets).toEqual(merged.targets)
    expect(merged.route?.totals.size).toBe(38)
    expect(merged.unknownQuantities).toEqual([])
  })

  it('additionne les consommations de plusieurs objectifs (œuf + shards → 2 Devourer)', () => {
    const merged = mergeGoalTargets(data, new Set(['rose_dragon', 'cocoa_leech_shards']), NONE)
    expect(merged.targets.find((t) => t.mutationId === 'devourer')?.quantity).toBe(2)
    // Quantité inconnue dans le JSON : comptée 1 et signalée.
    expect(merged.unknownQuantities).toEqual([{ goalId: 'cocoa_leech_shards', mutationId: 'devourer' }])
  })

  it('les deux crafts au Creambloom demandent 2 Creambloom et gardent les paliers DNA', () => {
    const merged = mergeGoalTargets(data, new Set(['mutation_sacks', 'trunk_polish']), NONE)
    expect(merged.targets).toEqual([{ mutationId: 'creambloom', quantity: 2 }])
    expect(merged.milestones).toEqual([
      'DNA Analysis Milestone I',
      'DNA Analysis Milestone III',
      'DNA Analysis Milestone V',
    ])
    expect(merged.route).toBeNull()
  })

  it('« Analyser les 40 » demande un exemplaire de chaque mutation pas encore analysée', () => {
    const merged = mergeGoalTargets(data, new Set(['analyze_all']), new Set(['dustgrain', 'godseed']))
    expect(merged.targets).toHaveLength(38)
    expect(merged.targets.every((t) => t.quantity === 1)).toBe(true)
    expect(merged.targets.some((t) => t.mutationId === 'dustgrain')).toBe(false)
  })

  it('sans objectif coché, rien à faire', () => {
    const merged = mergeGoalTargets(data, NONE, NONE)
    expect(merged).toMatchObject({ targets: [], route: null, other: {}, milestones: [] })
  })

  it("dans le plan, une mutation consommée ET posée s'additionne", () => {
    const merged = mergeGoalTargets(data, new Set(['rose_dragon', 'analyze_all']), NONE)
    const p = computePlan(data, { targets: merged.targets, inventory: {}, mode: 'minimum' })
    expect(p.needs.get('glasscorn')?.required).toBe(2) // l'œuf + l'analyse
    expect(p.needs.get('chloronite')?.required).toBe(12) // 11 posées + 1 analysée
  })

  it('deux objectifs qui demandent la même recette ne doublent pas ses ingrédients', () => {
    const merged = mergeGoalTargets(data, new Set(['rose_dragon', 'cocoa_leech_shards']), NONE)
    const p = computePlan(data, { targets: merged.targets, inventory: {}, mode: 'minimum' })
    expect(p.needs.get('devourer')?.required).toBe(2)
    expect(p.needs.get('puffercloud')?.required).toBe(4) // un seul anneau pour les 2 Devourer
  })
})

describe('objectifs : avancement', () => {
  it('compte les mutations demandées déjà en stock, sans dépasser la quantité demandée', () => {
    const progress = goalProgress(data, goal('rose_dragon'), { glasscorn: 1, devourer: 3 }, NONE)
    expect(progress).toEqual({ done: 2, total: 5 })
  })

  it('« Analyser les 40 » avance avec les mutations analysées', () => {
    const analyzed = new Set(['dustgrain', 'choconut', 'ashwreath', 'lonelily'])
    expect(goalProgress(data, goal('analyze_all'), {}, analyzed)).toEqual({ done: 4, total: 40 })
  })

  it('Rose Dragon en Optimum : avancement sur les 388 exemplaires de la route AVRG', () => {
    expect(goalCompletion(data, goal('rose_dragon'), {}, NONE, 'optimum')).toEqual({
      done: 0,
      total: 388,
      measure: 'copies',
    })
  })

  it("un objectif est à 100 % dès qu'on possède ce qu'il consomme", () => {
    const legendaries = { glasscorn: 1, devourer: 1, all_in_aloe: 1, phantomleaf: 1, timestalk: 1 }
    expect(goalCompletion(data, goal('rose_dragon'), legendaries, NONE, 'optimum')).toEqual({
      done: 5,
      total: 5,
      measure: 'copies',
    })
  })

  it("compte les ingrédients déjà en stock (Trunk Polish : 8 Choconut sur 9 exemplaires)", () => {
    expect(goalCompletion(data, goal('trunk_polish'), { choconut: 8 }, NONE, 'minimum')).toEqual({
      done: 8,
      total: 9,
      measure: 'copies',
    })
  })

  it('« Analyser les 40 » compte les analyses', () => {
    expect(goalCompletion(data, goal('analyze_all'), {}, new Set(['dustgrain']), 'optimum')).toEqual({
      done: 1,
      total: 40,
      measure: 'analyses',
    })
  })

  it("l'avancement d'un plan compte le stock utile sur le total nécessaire", () => {
    const p = computePlan(data, {
      targets: [{ mutationId: 'chocoberry', quantity: 1 }],
      inventory: { choconut: 10, gloomgourd: 1 },
      mode: 'minimum',
    })
    // Besoins : 1 Chocoberry, 6 Choconut, 2 Gloomgourd ; utile en stock : 6 + 1.
    expect(planProgress(p)).toEqual({ done: 7, total: 9 })
  })
})
