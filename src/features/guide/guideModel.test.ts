import { describe, expect, it } from 'vitest'
import { mergeGoalTargets } from '../../logic/goals'
import { computePlan, type Inventory } from '../../logic/recipes'
import { layoutFromPreset } from '../../store/grids'
import type { GridState } from '../../store/state'
import { projectData } from '../../test/projectData'
import type { GuideChapter } from '../../types/game'
import { farmsIn } from './farmPacking'
import { addedIngredients, chapterView, farmIngredients, farmOutputs, farmTiming, guideChapters, guideContext, guideNow, placementFor } from './guideModel'

const data = projectData()
const size = { width: data.mechanics.greenhouse.width, height: data.mechanics.greenhouse.height }
const chapters = data.guide.sections.flatMap((section) => section.chapters)
const chapter = (id: string): GuideChapter => {
  const found = chapters.find((c) => c.id === id)
  if (!found) throw new Error(`chapitre inconnu : ${id}`)
  return found
}

function context(inventory: Inventory = {}, grids: GridState = emptyGrids()) {
  const goal = mergeGoalTargets(data, new Set([data.guide.goalId]), new Set())
  return guideContext(data, computePlan(data, { targets: goal.targets, inventory, mode: 'optimum', route: goal.route }), inventory, grids)
}

function emptyGrids(): GridState {
  return {
    activeGreenhouse: 0,
    greenhouses: [0, 1, 2].map((index) => ({
      activeLayoutId: `vide-${index}`,
      layouts: [{ id: `vide-${index}`, name: 'Plan 1', ground: new Array<string>(size.width * size.height).fill('Dirt'), placements: [] }],
    })),
  }
}

/** Greenhouse 2 avec la ferme du chapitre comme plan affiché. */
function withFarm(id: string): GridState {
  const grids = emptyGrids()
  const farm = layoutFromPreset('ferme', chapter(id).layout, size, 'Dirt')
  return { ...grids, greenhouses: grids.greenhouses.map((g, i) => (i === 1 ? { activeLayoutId: 'ferme', layouts: [...g.layouts, farm] } : g)) }
}

describe('guide du Rose Dragon', () => {
  it('compte ce que la ferme demande : mutations d’abord, puis crops de base', () => {
    const items = farmIngredients(chapter('blastberry').layout, { chocoberry: 20 })
    // Les chiffres du guide AVRG pour la Blastberry optimum : 20 Ashwreath, 17 Chocoberry.
    expect(items.map((item) => [item.crop.kind === 'mutation' ? item.crop.id : item.crop.name, item.count, item.owned])).toEqual([
      ['ashwreath', 20, 0],
      ['chocoberry', 17, 20],
    ])
    expect(farmIngredients(chapter('first_steps_gloomgourd').layout, {}).every((item) => item.crop.kind === 'base')).toBe(true)
  })

  it('dit ce que la ferme donne, avec le besoin de la route AVRG', () => {
    const view = chapterView(data, chapter('first_big_farm'), context())
    expect(view.outputs.map((o) => o.mutation.id)).toEqual(
      expect.arrayContaining(['soggybud', 'ashwreath', 'witherbloom', 'veilshroom', 'scourroot', 'choconut', 'shadevine']),
    )
    expect(view.outputs.find((o) => o.mutation.id === 'ashwreath')?.need?.required).toBe(36)
  })

  it('suit l’état : il manque, prête, posée dans un greenhouse, faite', () => {
    expect(chapterView(data, chapter('blastberry'), context()).status).toBe('missing')
    expect(chapterView(data, chapter('first_steps_gloomgourd'), context()).status).toBe('ready')
    const placed = chapterView(data, chapter('first_steps_gloomgourd'), context({}, withFarm('first_steps_gloomgourd')))
    expect(placed.status).toBe('placed')
    expect(placed.placedIn).toEqual([1])
    expect(placed.activeIn).toEqual([1])
    expect(chapterView(data, chapter('first_steps_gloomgourd'), context({ gloomgourd: 12 })).status).toBe('done')
  })

  it('au départ, aucune ferme n’est finie', () => {
    expect(guideChapters(data, context()).filter((view) => view.status === 'done')).toEqual([])
  })

  it('une ferme dont les mutations ne sont plus demandées disparaît (tout l’œuf est en stock)', () => {
    const goal = data.goals.find((g) => g.id === data.guide.goalId)
    const inventory = Object.fromEntries((goal?.mutations ?? []).map((r) => [r.mutationId, r.quantity ?? 1]))
    const ctx = context(inventory)
    const views = guideChapters(data, ctx)
    expect(views.filter((view) => view.status !== 'done').map((view) => view.chapter.id)).toEqual([])
    expect(guideNow(data, ctx, views, [0, 1, 2])).toEqual({ toPlace: [], upgrades: [], running: [], next: [] })
    // Les 7 Blastberry de la route en stock : la ferme Blastberry est finie, celles d'avant restent.
    const blastberry = guideChapters(data, context({ blastberry: 7 }))
    expect(blastberry.find((view) => view.chapter.id === 'blastberry')?.status).toBe('done')
    expect(blastberry.find((view) => view.chapter.id === 'first_steps_gloomgourd')?.status).toBe('ready')
  })

  it('la version minimum demande moins (Blastberry)', () => {
    const optimum = chapterView(data, chapter('blastberry'), context())
    const minimum = chapterView(data, chapter('blastberry'), context(), true)
    expect(minimum.layout.id).toBe('avrg_blastberry_min')
    const count = (view: typeof optimum) => view.ingredients.reduce((sum, item) => sum + item.count, 0)
    expect(count(minimum)).toBeLessThan(count(optimum))
  })

  it('reconnaît une ferme du guide dans la grille, même chargée depuis l’onglet Grille', () => {
    const ctx = context({}, withFarm('chloronite'))
    expect(ctx.greenhouses[1]?.active.map((farm) => farm.chapter.id)).toEqual(['chloronite'])
    expect(ctx.greenhouses[0]?.active).toEqual([])
    expect(chapterView(data, chapter('chloronite'), ctx).activeIn).toEqual([1])
  })

  it('au départ : Gloomgourd et Dustgrain réunis dans le Greenhouse 1, la suite dans l’ordre du guide', () => {
    const ctx = context()
    const now = guideNow(data, ctx, guideChapters(data, ctx), [0])
    expect(now.running).toEqual([])
    expect(now.toPlace).toHaveLength(1)
    expect(now.toPlace[0]?.chapters.map((view) => view.chapter.id)).toEqual(['first_steps_gloomgourd', 'first_steps_dustgrain'])
    expect(now.next[0]?.chapter.id).toBe('first_big_farm')
  })

  it('une ferme posée est en cours ; ce qui reste prêt s’ajoute à côté', () => {
    const ctx = context({}, withFarm('first_steps_gloomgourd'))
    const now = guideNow(data, ctx, guideChapters(data, ctx), [1])
    expect(now.running.map((group) => [group.greenhouse, group.chapters.map((view) => view.chapter.id)])).toEqual([[1, ['first_steps_gloomgourd']]])
    expect(now.toPlace[0]?.newPlan).toBe(false)
    expect(now.toPlace[0]?.chapters.map((view) => view.chapter.id)).toEqual(['first_steps_dustgrain'])
  })

  it('une ferme dans un ancien plan (pas affiché) n’est pas en cours', () => {
    const grids = withFarm('first_steps_gloomgourd')
    // Le plan vide redevient le plan affiché du greenhouse 2 : la ferme reste dans la liste des plans.
    const back: GridState = { ...grids, greenhouses: grids.greenhouses.map((g, i) => (i === 1 ? { ...g, activeLayoutId: 'vide-1' } : g)) }
    const view = chapterView(data, chapter('first_steps_gloomgourd'), context({}, back))
    expect(view.placedIn).toEqual([])
    expect(view.status).toBe('ready')
  })

  it('ajoute une ferme à côté de celle qui pousse si elle tient, sinon le greenhouse est plein', () => {
    const ctx = context({}, withFarm('first_steps_gloomgourd'))
    const small = placementFor(data, ctx, 1, [chapter('first_steps_dustgrain').layout])
    expect(small.mode).toBe('add')
    expect(small.mode === 'add' && small.result.farms.map((farm) => farm.preset.id)).toEqual(['avrg_first_steps_gloomgourd', 'avrg_first_steps_dustgrain'])
    expect(placementFor(data, ctx, 1, [chapter('first_big_farm').layout]).mode).toBe('full')
    // Greenhouse vide : la ferme s'y pose ; ferme finie : nouveau plan.
    expect(placementFor(data, ctx, 0, [chapter('first_big_farm').layout]).mode).toBe('add')
    const doneCtx = context({ gloomgourd: 12 }, withFarm('first_steps_gloomgourd'))
    expect(placementFor(data, doneCtx, 1, [chapter('first_big_farm').layout]).mode).toBe('new')
  })

  describe('Snoozling Complex : l’étape 2 se construit sur l’étape 1', () => {
    const step = (id: string, ctx: ReturnType<typeof context>) => guideChapters(data, ctx).find((view) => view.chapter.id === id)

    it('relie les deux étapes et ne demande que ce qu’il faut ajouter', () => {
      expect(chapter('snoozling_complex_2').upgrades?.id).toBe('snoozling_complex_1')
      const added = addedIngredients(chapter('snoozling_complex_1').layout, chapter('snoozling_complex_2').layout, {})
      expect(added.map((item) => [item.crop.kind === 'mutation' ? item.crop.id : item.crop.name, item.count])).toEqual([
        ['snoozling', 1],
        ['thunderling', 6],
      ])
    })

    it('au départ, l’étape 2 attend l’étape 1', () => {
      const ctx = context()
      expect(step('snoozling_complex_2', ctx)?.status).toBe('waiting')
      expect(step('snoozling_complex_1', ctx)?.nextStage?.id).toBe('snoozling_complex_2')
    })

    it('étape 1 en cours : la carte montre ce qu’il manque pour l’étape 2', () => {
      const ctx = context({}, withFarm('snoozling_complex_1'))
      const view = step('snoozling_complex_2', ctx)
      expect(view?.upgradeIn).toEqual([1])
      expect(view?.status).toBe('missing')
      const now = guideNow(data, ctx, guideChapters(data, ctx), [0, 1, 2])
      const running = now.running.find((group) => group.greenhouse === 1)
      expect(running?.chapters.map((v) => v.chapter.id)).toEqual(['snoozling_complex_1'])
      expect(running?.nextStages.map((v) => v.chapter.id)).toEqual(['snoozling_complex_2'])
      expect(now.next.some((v) => v.chapter.id === 'snoozling_complex_2')).toBe(false)
    })

    it('avec 1 Snoozling et 6 Thunderlings : passer à l’étape 2 dans le même greenhouse', () => {
      const ctx = context({ snoozling: 1, thunderling: 6 }, withFarm('snoozling_complex_1'))
      const now = guideNow(data, ctx, guideChapters(data, ctx), [0, 1, 2])
      expect(now.upgrades.map((upgrade) => [upgrade.greenhouse, upgrade.view.chapter.id])).toEqual([[1, 'snoozling_complex_2']])
      // L'étape 1 est remplacée, à la même place : le plan obtenu contient l'étape 2 seule.
      const result = now.upgrades[0]?.result
      expect(result && farmsIn(data, result.grid).map((farm) => [farm.chapter.id, farm.dx, farm.dy])).toEqual([['snoozling_complex_2', 0, 0]])
      expect(now.running.some((group) => group.chapters.some((v) => v.chapter.id === 'snoozling_complex_1'))).toBe(false)
      expect(now.toPlace.some((group) => group.greenhouse === 1)).toBe(false)
    })

    it('étape 2 posée : l’étape 1 est finie, l’étape 2 en cours', () => {
      const ctx = context({}, withFarm('snoozling_complex_2'))
      expect(step('snoozling_complex_1', ctx)?.status).toBe('done')
      expect(step('snoozling_complex_2', ctx)?.status).toBe('placed')
    })
  })

  describe('durée d’une ferme et decay de ce qu’on y pose', () => {
    const timing = (id: string, stageSeconds: number, inventory: Inventory = {}) => {
      const layout = chapter(id).layout
      const ctx = context(inventory)
      return farmTiming(data, layout, farmOutputs(data, layout, ctx.plan, inventory), stageSeconds)
    }

    it('Snoozling Complex, étape 1 : 48 stages (6 Thunderlings sur 2 emplacements, 4 Stoplight Petals sur 1)', () => {
      const t = timing('snoozling_complex_1', 3600)
      expect(t.stages).toBe(48)
      expect(t.seconds).toBe(48 * 3600)
      // Soggybud et Do-not-eat-shroom meurent après 3 jours, Noctilume et Snoozling après 6.
      expect(t.decays.map((d) => d.days)).toEqual([3, 3, 6, 6])
      expect(t.firstDecay?.days).toBe(3)
      expect(t.tooLong).toBe(false) // 48 h
      expect(timing('snoozling_complex_1', 7200).tooLong).toBe(true) // 96 h > 3 jours
    })

    it('une mutation sans growth stage spawn au plus une fois par stage et par emplacement', () => {
      const layout = chapter('first_steps_gloomgourd').layout
      const spots = layout.spots.filter((spot) => spot.expect.includes('gloomgourd')).length
      const t = timing('first_steps_gloomgourd', 3600)
      expect(t.stages).toBe(Math.ceil(12 / spots))
      expect(t.decays).toEqual([]) // seulement des crops de base
      expect(t.tooLong).toBe(false)
    })

    it('plus rien à obtenir : 0 ; une mutation qui ne decay jamais passe en dernier', () => {
      expect(timing('first_steps_gloomgourd', 3600, { gloomgourd: 12 }).stages).toBe(0)
      const aloe = timing('all_in_aloe', 3600)
      expect(aloe.decays.at(-1)).toEqual({ mutationId: 'magic_jellybean', days: null })
      expect(aloe.firstDecay).toEqual({ mutationId: 'plantboy_advance', days: 5 })
    })
  })

  it('deux fermes ne comptent pas deux fois le même stock', () => {
    // 20 Ashwreath et 17 Chocoberry : de quoi poser la Blastberry, pas en plus la Merging Superfarm (16 Ashwreath).
    const inventory = { ashwreath: 20, chocoberry: 17, witherbloom: 12, wild_rose: 0, veilshroom: 14, scourroot: 11 }
    const ctx = context(inventory)
    const now = guideNow(data, ctx, guideChapters(data, ctx), [0, 1, 2])
    const placed = now.toPlace.flatMap((group) => group.chapters.map((view) => view.chapter.id))
    expect(placed.includes('blastberry') && placed.includes('merging_superfarm')).toBe(false)
  })

})
