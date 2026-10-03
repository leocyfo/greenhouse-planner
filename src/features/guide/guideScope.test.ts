import { describe, expect, it } from 'vitest'
import { mergeGoalTargets } from '../../logic/goals'
import { computePlan } from '../../logic/recipes'
import { projectData } from '../../test/projectData'
import { ALL_GOALS, effectProviders, guideGoalIds, guideName, guideScope, supportMutations } from './guideScope'

const data = projectData()
const mutation = (id: string) => {
  const found = data.mutationsById.get(id)
  if (!found) throw new Error(`mutation inconnue : ${id}`)
  return found
}
const scopeOf = (guide: string, analyzed: ReadonlySet<string> = new Set()) => guideScope(data, guideGoalIds(data, guide), analyzed)

describe('guides : un par objectif, ou tous réunis', () => {
  it('trouve les objectifs d’un guide (un id inconnu revient au Rose Dragon)', () => {
    expect(guideGoalIds(data, 'mutation_sacks')).toEqual(['mutation_sacks'])
    expect(guideGoalIds(data, ALL_GOALS)).toEqual(data.goals.map((goal) => goal.id))
    expect(guideGoalIds(data, 'inconnu')).toEqual(['rose_dragon'])
    expect(guideName(data, 'rose_dragon')).toBe('Rose Dragon Pet')
  })

  it('Rose Dragon : les 20 fermes AVRG, et la route du guide redonne les totaux d’AVRG', () => {
    const scope = scopeOf('rose_dragon')
    expect(scope.chapterIds.size).toBe(20)
    expect(scope.manual).toEqual(['shellfruit'])
    // Ce que posent les fermes + l'œuf = roseDragonOptimum (Turtlellini est compté par sa consommation).
    const different = data.mutations.filter((m) => m.id !== 'turtlellini' && (scope.route.totals.get(m.id) ?? 0) !== m.roseDragonOptimum)
    expect(different.map((m) => m.id)).toEqual([])
    // Le plan du guide est celui de la route AVRG, mutation par mutation.
    const plan = computePlan(data, { targets: scope.targets, inventory: {}, mode: 'optimum', route: scope.route })
    const goal = mergeGoalTargets(data, new Set(['rose_dragon']), new Set())
    const avrg = computePlan(data, { targets: goal.targets, inventory: {}, mode: 'optimum', route: goal.route })
    expect(data.mutations.map((m) => plan.needs.get(m.id)?.required ?? 0)).toEqual(data.mutations.map((m) => avrg.needs.get(m.id)?.required ?? 0))
    expect(plan.needs.get('ashwreath')?.required).toBe(36)
    expect(plan.needs.get('turtlellini')?.required).toBe(5)
  })

  it('Mutations Sacks : seulement les fermes jusqu’au Creambloom, et celles de leurs ingrédients', () => {
    const scope = scopeOf('mutation_sacks')
    expect([...scope.chapterIds]).toEqual(['first_steps_gloomgourd', 'first_steps_dustgrain', 'first_big_farm', 'choconut_duskbloom_superfarm'])
    expect(scope.manual).toEqual([])
  })

  it('Cocoa Leech Shards : jusqu’au Devourer, sans l’étape 2 du Snoozling Complex (PlantBoy Advance inutile)', () => {
    const scope = scopeOf('cocoa_leech_shards')
    expect(scope.chapterIds.has('devourer')).toBe(true)
    expect(scope.chapterIds.has('snoozling_complex_1')).toBe(true)
    expect(scope.chapterIds.has('snoozling_complex_2')).toBe(false)
    expect(scope.chapterIds.has('blastberry')).toBe(false)
  })

  it('Sun’s Grasp : les mutations qui donnent les effets du Godseed, puis le Godseed à la main', () => {
    // Immunity vient des Cocoa Beans ; pour les autres effets, la mutation la plus commune.
    expect(supportMutations(data, mutation('godseed'))).toEqual(['ashwreath', 'shadevine', 'gloomgourd', 'witherbloom'])
    expect(effectProviders(data, mutation('godseed')).find((p) => p.effect === 'Immunity')?.baseCrops).toEqual(['Cocoa Beans'])
    const scope = scopeOf('suns_grasp')
    expect([...scope.chapterIds]).toEqual(['first_steps_gloomgourd', 'first_big_farm'])
    expect(scope.manual).toEqual(['godseed'])
  })

  it('Analyser les 40 et tout combiné : toutes les fermes, et les 3 mutations sans ferme AVRG à la main', () => {
    for (const guide of ['analyze_all', ALL_GOALS]) {
      const scope = scopeOf(guide)
      expect(scope.chapterIds.size).toBe(20)
      expect(scope.manual).toEqual(['shellfruit', 'godseed', 'jerryflower'])
    }
    // 36 Ashwreath posées + 1 à analyser + 1 à poser autour du Godseed (à analyser lui aussi).
    expect(scopeOf('analyze_all').route.totals.get('ashwreath')).toBe(38)
    // Tout analysé : plus rien à faire pour ce guide.
    expect(scopeOf('analyze_all', new Set(data.mutations.map((m) => m.id))).chapterIds.size).toBe(0)
  })
})
