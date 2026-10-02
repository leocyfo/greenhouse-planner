import { describe, expect, it } from 'vitest'
import { mergeGoalTargets } from '../../logic/goals'
import { computePlan, type Inventory } from '../../logic/recipes'
import { layoutFromPreset } from '../../store/grids'
import type { GridState } from '../../store/state'
import { projectData } from '../../test/projectData'
import type { GuideChapter } from '../../types/game'
import { chapterView, farmIngredients, guideChapters, guideContext, guideNow, placementFor } from './guideModel'

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
    expect(guideNow(data, ctx, views, [0, 1, 2])).toEqual({ toPlace: [], running: [], next: [] })
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

  it('deux fermes ne comptent pas deux fois le même stock', () => {
    // 20 Ashwreath et 17 Chocoberry : de quoi poser la Blastberry, pas en plus la Merging Superfarm (16 Ashwreath).
    const inventory = { ashwreath: 20, chocoberry: 17, witherbloom: 12, wild_rose: 0, veilshroom: 14, scourroot: 11 }
    const ctx = context(inventory)
    const now = guideNow(data, ctx, guideChapters(data, ctx), [0, 1, 2])
    const placed = now.toPlace.flatMap((group) => group.chapters.map((view) => view.chapter.id))
    expect(placed.includes('blastberry') && placed.includes('merging_superfarm')).toBe(false)
  })

})
