import { describe, expect, it } from 'vitest'
import { maxedGrowthSettings } from '../../logic/growth'
import { defaultPersistedState, type CalculatorState } from '../../store/state'
import { mutationById, projectData } from '../../test/projectData'
import { computeCalculatorResult } from './calculatorResult'
import { recipeLines, scheduleText } from '../../components/game/recipeText'

const data = projectData()
const growth = maxedGrowthSettings(data.mechanics.growthStage.formula)
const base = defaultPersistedState(data).calculator
const NONE = new Set<string>()

function result(calculator: Partial<CalculatorState>, inventory: Record<string, number> = {}) {
  return computeCalculatorResult(data, { ...base, ...calculator }, inventory, NONE, growth)
}

describe('calculateur : résultat', () => {
  it('additionne les cibles à la main et celles des objectifs ajoutés', () => {
    const r = result({ targets: [{ mutationId: 'glasscorn', quantity: 1 }], goalIds: ['rose_dragon'] })
    expect(r.plan.targets.find((t) => t.mutationId === 'glasscorn')?.quantity).toBe(2)
    expect(r.tree).toHaveLength(5)
  })

  it("n'applique l'Optimum qu'avec un objectif de la route AVRG", () => {
    expect(result({ goalIds: ['rose_dragon'], mode: 'optimum' }).plan.optimumApplied).toBe(true)
    expect(result({ targets: [{ mutationId: 'glasscorn', quantity: 1 }], mode: 'optimum' }).plan.optimumApplied).toBe(false)
  })

  it("peut ignorer l'inventaire", () => {
    const inventory = { glasscorn: 1 }
    const target = { targets: [{ mutationId: 'glasscorn', quantity: 1 }] }
    expect(result(target, inventory).plan.needs.get('glasscorn')?.missing).toBe(0)
    expect(result({ ...target, ignoreInventory: true }, inventory).plan.needs.get('glasscorn')?.missing).toBe(1)
  })

  it('estime les Lonelily avec les cases vides choisies', () => {
    const r = result({ targets: [{ mutationId: 'noctilume', quantity: 1 }], spots: 6, lonelilyCells: 100 })
    expect(r.randomSpawn?.mutationId).toBe('lonelily')
    expect(r.estimate.schedule.get('lonelily')?.productionStages).toBe(14) // 6 à 0,45 par stage
    expect(result({ targets: [{ mutationId: 'noctilume', quantity: 1 }], lonelilyCells: 0 }).estimate.unknown).toEqual(['lonelily'])
  })

  it('signale les quantités inconnues des objectifs ajoutés', () => {
    expect(result({ goalIds: ['cocoa_leech_shards'] }).unknownQuantities).toEqual([
      { goalId: 'cocoa_leech_shards', mutationId: 'devourer' },
    ])
  })
})

describe('calculateur : textes de la liste de courses', () => {
  it('décrit les ingrédients à poser, avec les cases des mutations multi-cases', () => {
    expect(recipeLines(data, mutationById(data, 'chocoberry'))).toEqual([
      "Autour de l'emplacement : 6 Choconut, 2 Gloomgourd",
    ])
    expect(recipeLines(data, mutationById(data, 'plantboy_advance'))).toEqual([
      "Autour de l'emplacement : 2 Snoozling (6 cases), 6 Thunderling",
    ])
  })

  it('décrit les conditions spéciales, les prérequis consommés et les catalyseurs', () => {
    expect(recipeLines(data, mutationById(data, 'shellfruit'))).toEqual([
      'Condition spéciale : Exploser un Turtlellini avec des Blastberry (2 explosions)',
      'Consomme 1 Turtlellini par exemplaire',
      'Avec 2 Blastberry (catalyseur, non consommé)',
    ])
    expect(recipeLines(data, mutationById(data, 'lonelily'))).toEqual([
      'Condition spéciale : 0 crop adjacent (spawn sur plots vides)',
    ])
  })

  it('décrit le créneau de production', () => {
    const entry = { mutationId: 'x', startStage: 14, productionStages: 4, finishStage: 18, waitsFor: null, unknownDuration: false }
    expect(scheduleText(entry)).toBe('Stages 14 → 18 (4 stages)')
    expect(scheduleText({ ...entry, productionStages: 0 })).toBe('Spawn instantané (aucun growth stage)')
    expect(scheduleText({ ...entry, unknownDuration: true })).toBe('Durée inconnue')
  })
})
