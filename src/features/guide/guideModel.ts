/**
 * Guide du Rose Dragon, d'après le guide AVRG (data.guide) : pour chaque chapitre (une ferme),
 * ce que la ferme demande, ce qu'elle donne, où elle est posée dans les greenhouses et où en est
 * le joueur. Tout vient des données, du stock et du calcul (computePlan) ; rien n'est écrit ici à
 * la main.
 */
import type { GridInput } from '../../logic/grid'
import { cropKey } from '../../logic/neighborRule'
import type { Inventory, MutationNeed, Plan } from '../../logic/recipes'
import { activeLayoutOf, toGridInput } from '../../store/grids'
import type { GridState } from '../../store/state'
import type { CropRef, GameData, GuideChapter, LayoutPreset, Mutation } from '../../types/game'
import { emptyGrid, farmsIn, isGuideOnly, largestFirst, ownPlotOf, packFarms, type FoundFarm, type PackResult } from './farmPacking'

export interface FarmIngredient {
  readonly crop: CropRef
  /** Crops à poser dans la ferme (une mutation 2x2 compte une fois). */
  readonly count: number
  /** Stock, pour une mutation ; null pour un crop de base (acheté ou récolté à côté). */
  readonly owned: number | null
}

export interface FarmOutput {
  readonly mutation: Mutation
  /** Besoin de la route du Rose Dragon ; null si la mutation n'y sert pas. */
  readonly need: MutationNeed | null
  readonly owned: number
}

/**
 * - done : tout ce que la ferme donne est en stock, en quantité suffisante ;
 * - placed : la ferme est posée dans un greenhouse ;
 * - ready : toutes les mutations à poser sont en stock ;
 * - missing : il en manque.
 */
export type ChapterStatus = 'done' | 'placed' | 'ready' | 'missing'

export interface ChapterView {
  readonly chapter: GuideChapter
  /** Plan choisi : optimum, ou la version minimum. */
  readonly layout: LayoutPreset
  readonly ingredients: readonly FarmIngredient[]
  readonly outputs: readonly FarmOutput[]
  /** Greenhouses dont le plan affiché contient la ferme (optimum ou minimum). */
  readonly placedIn: readonly number[]
  /** Les mêmes (gardé pour la lisibilité des appels). */
  readonly activeIn: readonly number[]
  readonly status: ChapterStatus
}

/** Crops à poser dans une ferme, mutations d'abord (dans l'ordre du plan), puis crops de base. */
export function farmIngredients(layout: LayoutPreset, inventory: Inventory): FarmIngredient[] {
  const counts = new Map<string, { crop: CropRef; count: number }>()
  for (const placement of layout.placements) {
    const key = cropKey(placement.crop)
    const entry = counts.get(key)
    counts.set(key, { crop: placement.crop, count: (entry?.count ?? 0) + 1 })
  }
  const all = [...counts.values()].map(({ crop, count }) => ({
    crop,
    count,
    owned: crop.kind === 'mutation' ? (inventory[crop.id] ?? 0) : null,
  }))
  return [...all.filter((item) => item.crop.kind === 'mutation'), ...all.filter((item) => item.crop.kind === 'base')]
}

/** Mutations que la ferme fait spawn (emplacements du plan), dans l'ordre des données. */
export function farmOutputs(data: GameData, layout: LayoutPreset, plan: Plan, inventory: Inventory): FarmOutput[] {
  const ids = new Set(layout.spots.flatMap((spot) => spot.expect))
  return data.mutations
    .filter((mutation) => ids.has(mutation.id))
    .map((mutation) => ({ mutation, need: plan.needs.get(mutation.id) ?? null, owned: inventory[mutation.id] ?? 0 }))
}

/** Fermes du guide dans un greenhouse. */
export interface GreenhouseFarms {
  /** Plan affiché, et les fermes qu'il contient. */
  readonly grid: GridInput | null
  readonly active: readonly FoundFarm[]
  /** Au moins une ferme du plan affiché est en cours (pas finie). */
  readonly running: boolean
  /**
   * On peut ajouter des fermes au plan affiché : il ne contient que des fermes du guide, et il est
   * vide ou au moins une de ses fermes est en cours (sinon : un nouveau plan).
   */
  readonly reuse: boolean
}

export interface ChapterContext {
  readonly plan: Plan
  readonly inventory: Inventory
  readonly grids: GridState
  readonly greenhouses: readonly GreenhouseFarms[]
}

/** Tout ce que le guide lit : besoins, stock, plans des greenhouses et les fermes qu'ils contiennent. */
export function guideContext(data: GameData, plan: Plan, inventory: Inventory, grids: GridState): ChapterContext {
  const size = data.mechanics.greenhouse
  const greenhouses = grids.greenhouses.map((greenhouse) => {
    const active = activeLayoutOf(greenhouse)
    const grid = active ? toGridInput(active, size) : null
    const activeFarms = grid ? farmsIn(data, grid) : []
    const running = activeFarms.some((farm) => !chapterDone(data, farm.chapter, plan, inventory))
    const reuse = grid !== null && isGuideOnly(data, grid, activeFarms) && (grid.placements.length === 0 || running)
    return { grid, active: activeFarms, running, reuse }
  })
  return { plan, inventory, grids, greenhouses }
}

/** Tout ce que la ferme donne pour la route est en stock. */
function chapterDone(data: GameData, chapter: GuideChapter, plan: Plan, inventory: Inventory): boolean {
  const needed = farmOutputs(data, chapter.layout, plan, inventory).filter((output) => output.need !== null)
  return needed.length > 0 && needed.every((output) => output.need?.missing === 0)
}

/** Où en est un chapitre, avec le plan choisi (optimum par défaut). */
export function chapterView(data: GameData, chapter: GuideChapter, context: ChapterContext, minimum = false): ChapterView {
  const layout = minimum && chapter.minimumLayout ? chapter.minimumLayout : chapter.layout
  const ingredients = farmIngredients(layout, context.inventory)
  const outputs = farmOutputs(data, layout, context.plan, context.inventory)
  // Posée = dans le plan affiché d'un greenhouse (ce qui est vraiment dans le jeu) ; un ancien plan
  // gardé dans la liste ne compte pas.
  const activeIn: number[] = []
  context.greenhouses.forEach((greenhouse, index) => {
    if (greenhouse.active.some((farm) => farm.chapter.id === chapter.id)) activeIn.push(index)
  })
  const placedIn = activeIn
  const needed = outputs.filter((output) => output.need !== null)
  const done = needed.length > 0 && needed.every((output) => output.need?.missing === 0)
  const ready = ingredients.every((item) => item.owned === null || item.owned >= item.count)
  const status: ChapterStatus = done ? 'done' : placedIn.length > 0 ? 'placed' : ready ? 'ready' : 'missing'
  return { chapter, layout, ingredients, outputs, placedIn, activeIn, status }
}

/** Tous les chapitres du guide, dans l'ordre (plan optimum). */
export function guideChapters(data: GameData, context: ChapterContext): ChapterView[] {
  return data.guide.sections.flatMap((section) => section.chapters.map((chapter) => chapterView(data, chapter, context)))
}

export interface FarmsToPlace {
  readonly greenhouse: number
  /** Les fermes vont dans un nouveau plan (le plan affiché a d'autres crops, ou ses fermes sont finies). */
  readonly newPlan: boolean
  /** Le plan obtenu : fermes déjà là, puis les fermes à poser (`added`). */
  readonly result: PackResult
  readonly chapters: readonly ChapterView[]
}

export interface RunningFarms {
  readonly greenhouse: number
  readonly chapters: readonly ChapterView[]
}

export interface GuideNow {
  /** À poser maintenant : les fermes prêtes, réunies par greenhouse quand elles tiennent ensemble. */
  readonly toPlace: readonly FarmsToPlace[]
  /** En cours : les fermes posées dans le plan affiché d'un greenhouse, pas encore finies. */
  readonly running: readonly RunningFarms[]
  /** La suite, dans l'ordre du guide (fermes pas finies, ni en cours, ni à poser maintenant). */
  readonly next: readonly ChapterView[]
}

/**
 * Ce qu'il y a à faire, d'après le stock et les greenhouses : les fermes AVRG prêtes, dans l'ordre du
 * guide, tant que le stock libre suffit (une ferme réserve les mutations qu'elle pose : deux fermes
 * ne comptent pas deux fois les mêmes Ashwreath), réunies dans le même greenhouse quand elles y
 * tiennent ensemble (Gloomgourd + Dustgrain…), à côté des fermes en cours s'il reste de la place.
 */
export function guideNow(data: GameData, context: ChapterContext, views: readonly ChapterView[], unlocked: readonly number[]): GuideNow {
  const running: RunningFarms[] = []
  for (const greenhouse of unlocked) {
    const ids = new Set(context.greenhouses[greenhouse]?.active.map((farm) => farm.chapter.id))
    const chapters = views.filter((view) => ids.has(view.chapter.id) && view.status !== 'done')
    if (chapters.length > 0) running.push({ greenhouse, chapters })
  }

  // Fermes prêtes, dans l'ordre du guide, tant que le stock libre suffit.
  const free = new Map(Object.entries(context.inventory))
  const candidates: ChapterView[] = []
  for (const view of views) {
    if (view.status !== 'ready') continue
    const needs = view.ingredients.filter((item) => item.crop.kind === 'mutation')
    const enough = needs.every((item) => item.crop.kind === 'mutation' && (free.get(item.crop.id) ?? 0) >= item.count)
    if (!enough) continue
    for (const item of needs) if (item.crop.kind === 'mutation') free.set(item.crop.id, (free.get(item.crop.id) ?? 0) - item.count)
    candidates.push(view)
  }

  const ownPlot = ownPlotOf(data)
  const toPlace: FarmsToPlace[] = []
  let left = candidates
  for (const greenhouse of unlocked) {
    const farms = context.greenhouses[greenhouse]
    if (!farms || left.length === 0) continue
    const reuse = farms.reuse && farms.grid !== null
    const base = reuse && farms.grid ? farms.grid : emptyGrid(data)
    const result = packFarms(data, base, largestFirst(data, left.map((view) => view.layout)), reuse ? farms.active : [], ownPlot)
    if (result.added.length === 0) continue
    const added = new Set(result.added.map((farm) => farm.preset.id))
    toPlace.push({ greenhouse, newPlan: !reuse, result, chapters: left.filter((view) => added.has(view.layout.id)) })
    left = left.filter((view) => !added.has(view.layout.id))
  }

  const busy = new Set([...running, ...toPlace].flatMap((group) => group.chapters.map((view) => view.chapter.id)))
  const next = views.filter((view) => view.status !== 'done' && !busy.has(view.chapter.id))
  return { toPlace, running, next }
}

/**
 * Poser des fermes dans un greenhouse :
 * - add : elles tiennent dans le plan affiché, à côté des fermes du guide en cours (ou il est vide) ;
 * - new : le greenhouse est libre (ses fermes sont finies, ou c'est un autre plan) : nouveau plan ;
 * - full : des fermes y poussent encore et il n'y a pas la place à côté.
 */
export type Placement = { readonly mode: 'add'; readonly result: PackResult } | { readonly mode: 'new' } | { readonly mode: 'full' }

export function placementFor(data: GameData, context: ChapterContext, greenhouse: number, presets: readonly LayoutPreset[]): Placement {
  const farms = context.greenhouses[greenhouse]
  if (!farms?.grid || !farms.reuse) return farms?.running ? { mode: 'full' } : { mode: 'new' }
  const result = packFarms(data, farms.grid, largestFirst(data, presets), farms.active, ownPlotOf(data))
  if (result.rest.length === 0) return { mode: 'add', result }
  return farms.running ? { mode: 'full' } : { mode: 'new' }
}
