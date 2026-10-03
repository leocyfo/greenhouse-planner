/**
 * Guide du Rose Dragon, d'après le guide AVRG (data.guide) : pour chaque chapitre (une ferme),
 * ce que la ferme demande, ce qu'elle donne, où elle est posée dans les greenhouses et où en est
 * le joueur. Tout vient des données, du stock et du calcul (computePlan) ; rien n'est écrit ici à
 * la main.
 */
import type { GridInput } from '../../logic/grid'
import { growthWithUpgrades, harvestStage, stageDurationSeconds } from '../../logic/growth'
import { cropKey } from '../../logic/neighborRule'
import type { Inventory, MutationNeed, Plan } from '../../logic/recipes'
import { activeLayoutOf, toGridInput } from '../../store/grids'
import type { GridState } from '../../store/state'
import type { CropRef, GameData, GuideChapter, LayoutPreset, Mutation } from '../../types/game'
import { emptyGrid, farmsIn, isGuideOnly, largestFirst, ownPlotOf, packFarms, swapFarm, type FoundFarm, type PackResult } from './farmPacking'

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
 * - done : plus rien à obtenir de la ferme (tout ce qu'elle donne est en stock, ou plus demandé),
 *   ou l'étape suivante l'a remplacée ;
 * - placed : la ferme est posée dans un greenhouse ;
 * - waiting : étape d'une ferme qui se construit sur l'étape précédente, pas encore posée ;
 * - ready : toutes les mutations à poser sont en stock ;
 * - missing : il en manque.
 */
export type ChapterStatus = 'done' | 'placed' | 'waiting' | 'ready' | 'missing'

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
  /**
   * Greenhouses où pousse l'étape précédente de la ferme : on y passe à cette étape, et
   * `ingredients` ne compte que ce qu'il faut y ajouter.
   */
  readonly upgradeIn: readonly number[]
  /** Étape suivante de la même ferme (elle transforme celle-ci), ou null. */
  readonly nextStage: GuideChapter | null
  /** Durée de la ferme et decay des mutations qu'on y pose. */
  readonly timing: FarmTiming
  readonly status: ChapterStatus
}

/** Decay d'une mutation posée dans la ferme ; days null = elle ne decay jamais. */
export interface PlacedDecay {
  readonly mutationId: string
  readonly days: number | null
}

export interface FarmTiming {
  /**
   * Growth stages pour obtenir ce qui manque, au minimum : un spawn par emplacement à chaque stage
   * (au plus un spawn par stage, même pour une mutation sans growth stage), toutes les sorties en
   * parallèle. 0 = plus rien à obtenir.
   */
  readonly stages: number
  readonly seconds: number
  /** Decay des mutations posées, la plus courte d'abord (celles qui ne decay jamais à la fin). */
  readonly decays: readonly PlacedDecay[]
  /** La première à mourir, ou null si aucune ne decay. */
  readonly firstDecay: { readonly mutationId: string; readonly days: number } | null
  /** La ferme dure plus longtemps que la première decay : ce qui y est posé mourra avant la fin. */
  readonly tooLong: boolean
}

/** Durée d'une ferme (ce qui manque de ce qu'elle donne) et decay de ce qu'on y pose. */
export function farmTiming(data: GameData, layout: LayoutPreset, outputs: readonly FarmOutput[], stageSeconds: number): FarmTiming {
  let stages = 0
  for (const output of outputs) {
    const missing = output.need?.missing ?? 0
    const spots = layout.spots.filter((spot) => spot.expect.includes(output.mutation.id)).length
    if (missing === 0 || spots === 0) continue
    const perRound = Math.max(1, harvestStage(output.mutation) ?? 0)
    stages = Math.max(stages, Math.ceil(missing / spots) * perRound)
  }
  const ids = new Set(layout.placements.flatMap((placement) => (placement.crop.kind === 'mutation' ? [placement.crop.id] : [])))
  const decays = data.mutations
    .filter((mutation) => ids.has(mutation.id))
    .map((mutation) => ({ mutationId: mutation.id, days: mutation.decayDays }))
    .sort((a, b) => (a.days ?? Infinity) - (b.days ?? Infinity))
  const [first] = decays
  const firstDecay = first && first.days !== null ? { mutationId: first.mutationId, days: first.days } : null
  const seconds = stages * stageSeconds
  return { stages, seconds, decays, firstDecay, tooLong: firstDecay !== null && seconds > firstDecay.days * 86_400 }
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

/**
 * Ce qu'il faut ajouter pour passer d'une ferme à la suivante, dans le même greenhouse (étape 1 →
 * étape 2 du Snoozling Complex : 1 Snoozling et 6 Thunderlings) ; ce qui y est déjà posé ne compte pas.
 */
export function addedIngredients(from: LayoutPreset, to: LayoutPreset, inventory: Inventory): FarmIngredient[] {
  const before = new Map(farmIngredients(from, {}).map((item) => [cropKey(item.crop), item.count]))
  return farmIngredients(to, inventory)
    .map((item) => ({ ...item, count: item.count - (before.get(cropKey(item.crop)) ?? 0) }))
    .filter((item) => item.count > 0)
}

/** Étape suivante d'un chapitre : celui qui transforme sa ferme, ou null. */
export function nextStageOf(data: GameData, chapter: GuideChapter): GuideChapter | null {
  return data.guide.sections.flatMap((section) => section.chapters).find((other) => other.upgrades?.id === chapter.id) ?? null
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
  /** Durée d'un growth stage (réglages du joueur), pour la durée des fermes. */
  readonly stageSeconds: number
  /** Chapitres du guide affiché (voir guideScope) ; null : tous. */
  readonly chapterIds: ReadonlySet<string> | null
}

/**
 * Tout ce que le guide lit : besoins, stock, plans des greenhouses et les fermes qu'ils contiennent.
 * Sans durée de stage donnée : celle sans upgrade de Growth Speed.
 */
export function guideContext(
  data: GameData,
  plan: Plan,
  inventory: Inventory,
  grids: GridState,
  stageSeconds = stageDurationSeconds(growthWithUpgrades(0, data.mechanics.growthStage.formula), data.mechanics.growthStage.formula),
  chapterIds: ReadonlySet<string> | null = null,
): ChapterContext {
  const size = data.mechanics.greenhouse
  const greenhouses = grids.greenhouses.map((greenhouse) => {
    const active = activeLayoutOf(greenhouse)
    const grid = active ? toGridInput(active, size) : null
    const activeFarms = grid ? farmsIn(data, grid) : []
    const running = activeFarms.some((farm) => !chapterDone(data, farm.chapter, plan, inventory))
    const reuse = grid !== null && isGuideOnly(data, grid, activeFarms) && (grid.placements.length === 0 || running)
    return { grid, active: activeFarms, running, reuse }
  })
  return { plan, inventory, grids, greenhouses, stageSeconds, chapterIds }
}

/**
 * Plus rien à obtenir de la ferme : chaque mutation qu'elle donne est en stock en quantité
 * suffisante, ou n'est plus demandée (ce qu'elle sert à faire est déjà en stock).
 */
function outputsDone(outputs: readonly FarmOutput[]): boolean {
  return outputs.every((output) => output.need === null || output.need.missing === 0)
}

function chapterDone(data: GameData, chapter: GuideChapter, plan: Plan, inventory: Inventory): boolean {
  return outputsDone(farmOutputs(data, chapter.layout, plan, inventory))
}

/** Où en est un chapitre, avec le plan choisi (optimum par défaut). */
export function chapterView(data: GameData, chapter: GuideChapter, context: ChapterContext, minimum = false): ChapterView {
  const layout = minimum && chapter.minimumLayout ? chapter.minimumLayout : chapter.layout
  const outputs = farmOutputs(data, layout, context.plan, context.inventory)
  // Posée = dans le plan affiché d'un greenhouse (ce qui est vraiment dans le jeu) ; un ancien plan
  // gardé dans la liste ne compte pas.
  const activeIn = greenhousesWith(context, chapter.id)
  const placedIn = activeIn
  // Étape d'une ferme en plusieurs temps : là où pousse l'étape précédente, on n'ajoute que ce qui manque.
  const before = chapter.upgrades
  const upgradeIn = before && placedIn.length === 0 ? greenhousesWith(context, before.id) : []
  const ingredients =
    before && upgradeIn.length > 0 ? addedIngredients(before.layout, layout, context.inventory) : farmIngredients(layout, context.inventory)
  // L'étape suivante seulement si le guide affiché la garde (Cocoa Leech Shards : pas l'étape 2).
  const following = nextStageOf(data, chapter)
  const nextStage = following && (!context.chapterIds || context.chapterIds.has(following.id)) ? following : null
  const replaced = nextStage !== null && greenhousesWith(context, nextStage.id).length > 0
  const waiting = before !== null && placedIn.length === 0 && upgradeIn.length === 0 && !chapterDone(data, before, context.plan, context.inventory)
  const ready = ingredients.every((item) => item.owned === null || item.owned >= item.count)
  const status: ChapterStatus =
    outputsDone(outputs) || replaced ? 'done' : placedIn.length > 0 ? 'placed' : waiting ? 'waiting' : ready ? 'ready' : 'missing'
  const timing = farmTiming(data, layout, outputs, context.stageSeconds)
  return { chapter, layout, ingredients, outputs, placedIn, activeIn, upgradeIn, nextStage, timing, status }
}

/** Greenhouses dont le plan affiché contient la ferme du chapitre. */
function greenhousesWith(context: ChapterContext, chapterId: string): number[] {
  const found: number[] = []
  context.greenhouses.forEach((greenhouse, index) => {
    if (greenhouse.active.some((farm) => farm.chapter.id === chapterId)) found.push(index)
  })
  return found
}

/** Les chapitres du guide affiché (tous par défaut), dans l'ordre (plan optimum). */
export function guideChapters(data: GameData, context: ChapterContext): ChapterView[] {
  return data.guide.sections
    .flatMap((section) => section.chapters)
    .filter((chapter) => !context.chapterIds || context.chapterIds.has(chapter.id))
    .map((chapter) => chapterView(data, chapter, context))
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
  /** Étapes suivantes de ces fermes, pas encore prêtes (ce qu'il manque pour y passer). */
  readonly nextStages: readonly ChapterView[]
}

/** Passer une ferme à son étape suivante, dans son greenhouse (Snoozling Complex : étape 1 → 2). */
export interface FarmUpgrade {
  readonly greenhouse: number
  /** L'étape suivante ; `ingredients` = ce qu'il faut ajouter. */
  readonly view: ChapterView
  /** Le plan obtenu : l'étape précédente remplacée par celle-ci, les autres fermes gardées. */
  readonly result: PackResult
}

export interface GuideNow {
  /** À poser maintenant : les fermes prêtes, réunies par greenhouse quand elles tiennent ensemble. */
  readonly toPlace: readonly FarmsToPlace[]
  /** À faire maintenant : passer une ferme à son étape suivante. */
  readonly upgrades: readonly FarmUpgrade[]
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
  // Fermes prêtes, dans l'ordre du guide, tant que le stock libre suffit. Une étape suivante se fait
  // là où pousse l'étape précédente : elle n'est jamais posée ailleurs.
  const free = new Map(Object.entries(context.inventory))
  const candidates: ChapterView[] = []
  const upgrades: FarmUpgrade[] = []
  for (const view of views) {
    if (view.status !== 'ready') continue
    const needs = view.ingredients.filter((item) => item.crop.kind === 'mutation')
    const enough = needs.every((item) => item.crop.kind === 'mutation' && (free.get(item.crop.id) ?? 0) >= item.count)
    if (!enough) continue
    if (view.upgradeIn.length > 0) {
      const greenhouse = view.upgradeIn.find((index) => unlocked.includes(index))
      const result = greenhouse === undefined ? null : upgradeFor(data, context, greenhouse, view)
      if (greenhouse === undefined || !result) continue
      upgrades.push({ greenhouse, view, result })
    } else {
      candidates.push(view)
    }
    for (const item of needs) if (item.crop.kind === 'mutation') free.set(item.crop.id, (free.get(item.crop.id) ?? 0) - item.count)
  }

  // En cours, sauf l'étape qui passe maintenant à la suivante ; avec, les étapes suivantes pas prêtes.
  const upgrading = new Set(upgrades.map((upgrade) => upgrade.view.chapter.upgrades?.id))
  const running: RunningFarms[] = []
  for (const greenhouse of unlocked) {
    const ids = new Set(context.greenhouses[greenhouse]?.active.map((farm) => farm.chapter.id))
    const chapters = views.filter((view) => ids.has(view.chapter.id) && view.status !== 'done' && !upgrading.has(view.chapter.id))
    const stageIds = new Set(chapters.map((view) => view.nextStage?.id))
    const nextStages = views.filter(
      (view) => stageIds.has(view.chapter.id) && view.upgradeIn.includes(greenhouse) && view.status !== 'done' && !upgrades.some((u) => u.view === view),
    )
    if (chapters.length > 0) running.push({ greenhouse, chapters, nextStages })
  }

  const ownPlot = ownPlotOf(data)
  const toPlace: FarmsToPlace[] = []
  let left = candidates
  for (const greenhouse of unlocked) {
    const farms = context.greenhouses[greenhouse]
    if (!farms || left.length === 0 || upgrades.some((upgrade) => upgrade.greenhouse === greenhouse)) continue
    const reuse = farms.reuse && farms.grid !== null
    const base = reuse && farms.grid ? farms.grid : emptyGrid(data)
    const result = packFarms(data, base, largestFirst(data, left.map((view) => view.layout)), reuse ? farms.active : [], ownPlot)
    if (result.added.length === 0) continue
    const added = new Set(result.added.map((farm) => farm.preset.id))
    toPlace.push({ greenhouse, newPlan: !reuse, result, chapters: left.filter((view) => added.has(view.layout.id)) })
    left = left.filter((view) => !added.has(view.layout.id))
  }

  const busy = new Set([
    ...[...running, ...toPlace].flatMap((group) => group.chapters.map((view) => view.chapter.id)),
    ...running.flatMap((group) => group.nextStages.map((view) => view.chapter.id)),
    ...upgrades.map((upgrade) => upgrade.view.chapter.id),
  ])
  const next = views.filter((view) => view.status !== 'done' && !busy.has(view.chapter.id))
  return { toPlace, upgrades, running, next }
}

/**
 * Passer à l'étape `view` dans ce greenhouse : l'étape précédente qui y pousse est remplacée (à la
 * même place si elle tient), les autres fermes restent. null si l'étape précédente n'y est pas, ou si
 * la nouvelle ne tient pas.
 */
export function upgradeFor(data: GameData, context: ChapterContext, greenhouse: number, view: ChapterView): PackResult | null {
  const before = view.chapter.upgrades
  const farms = context.greenhouses[greenhouse]
  const from = farms?.active.find((farm) => farm.chapter.id === before?.id)
  if (!farms?.grid || !from) return null
  return swapFarm(data, farms.grid, farms.active, from, view.layout)
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
