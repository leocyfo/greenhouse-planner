/**
 * Les guides : un par objectif des données (Rose Dragon, analyser les 40 mutations, crafts…), plus
 * « tous les objectifs réunis ». Chaque guide garde les fermes AVRG utiles à ses objectifs, dans
 * l'ordre d'AVRG ; ce qu'aucune ferme AVRG ne fait (Shellfruit, Godseed, Jerryflower) se fait à la
 * main. Rien n'est inventé : tout vient des objectifs, des recettes et des effets des données.
 */
import { tr } from '../../i18n/locale'
import { mergeGoalTargets } from '../../logic/goals'
import { computePlan, mergeTargets, type OptimumRoute, type Target } from '../../logic/recipes'
import type { GameData, GuideChapter, Mutation } from '../../types/game'

/** Le guide qui réunit tous les objectifs. */
export const ALL_GOALS = 'all'

/** Objectifs d'un guide : un seul, tous (« all »), ou celui du guide AVRG si l'id est inconnu. */
export function guideGoalIds(data: GameData, guide: string): string[] {
  if (guide === ALL_GOALS) return data.goals.map((goal) => goal.id)
  return data.goals.some((goal) => goal.id === guide) ? [guide] : [data.guide.goalId]
}

/** Nom d'un guide : celui de son objectif, ou « Tous les objectifs ». */
export function guideName(data: GameData, guide: string): string {
  if (guide === ALL_GOALS) return tr('Tous les objectifs', 'All goals')
  const [id] = guideGoalIds(data, guide)
  return data.goals.find((goal) => goal.id === id)?.name ?? ''
}

/** Qui donne chaque effet qu'une mutation demande autour d'elle (Godseed) : crops de base et mutations, les plus communes d'abord. */
export interface EffectProviders {
  readonly effect: string
  readonly baseCrops: readonly string[]
  readonly mutations: readonly Mutation[]
}

export function effectProviders(data: GameData, mutation: Mutation): EffectProviders[] {
  return mutation.effects.map((effect) => ({
    effect,
    baseCrops: data.baseCrops.filter((crop) => crop.effects.includes(effect)).map((crop) => crop.name),
    mutations: data.mutations
      .filter((other) => other.id !== mutation.id && other.effects.includes(effect))
      .sort((a, b) => a.rarityRank - b.rarityRank),
  }))
}

/**
 * Mutations à avoir pour poser autour d'une mutation qui demande des effets (Godseed) : pour chaque
 * effet qu'aucun crop de base ne donne, la mutation la plus commune qui le donne.
 */
export function supportMutations(data: GameData, mutation: Mutation): string[] {
  if (mutation.spawnRule !== 'requiredEffectsAround') return []
  const ids = effectProviders(data, mutation)
    .filter((providers) => providers.baseCrops.length === 0)
    .flatMap((providers) => (providers.mutations[0] ? [providers.mutations[0].id] : []))
  return [...new Set(ids)]
}

export interface GuideScope {
  readonly goalIds: readonly string[]
  /**
   * Cibles du guide : ce que consomment ses objectifs, les mutations à poser autour d'un Godseed
   * (1 de chaque), et tout ce que posent ses fermes.
   */
  readonly targets: readonly Target[]
  /**
   * Route du guide, pour le mode Optimum : pour chaque mutation, ce que posent ses fermes plus ce
   * que consomment ses objectifs. Sur les 20 fermes du Rose Dragon, ce sont exactement les totaux
   * d'AVRG (roseDragonOptimum).
   */
  readonly route: OptimumRoute
  /** Chapitres du guide AVRG retenus : chacun apporte une mutation utile qu'aucun précédent ne fait. */
  readonly chapterIds: ReadonlySet<string>
  /** Mutations utiles qu'aucune ferme AVRG ne fait : à faire à la main, dans l'ordre des données. */
  readonly manual: readonly string[]
}

/** Mutations posées par des fermes ; une étape suivante ne compte que ce qu'elle ajoute à la précédente. */
function placedBy(chapters: readonly GuideChapter[]): Target[] {
  const count = (chapter: GuideChapter) => {
    const counts = new Map<string, number>()
    for (const placement of chapter.layout.placements) {
      if (placement.crop.kind === 'mutation') counts.set(placement.crop.id, (counts.get(placement.crop.id) ?? 0) + 1)
    }
    return counts
  }
  const ids = new Set(chapters.map((chapter) => chapter.id))
  return mergeTargets(
    chapters.flatMap((chapter) => {
      const before = chapter.upgrades && ids.has(chapter.upgrades.id) ? count(chapter.upgrades) : new Map<string, number>()
      return [...count(chapter)].map(([mutationId, quantity]) => ({ mutationId, quantity: quantity - (before.get(mutationId) ?? 0) }))
    }),
  )
}

/**
 * Route d'un guide : le total de chaque mutation est sa cible (posée + consommée) ; les mutations
 * que font ses fermes en sont membres, leurs recettes étant déjà comptées dans ce que posent les fermes.
 */
function routeOf(targets: readonly Target[], chapters: readonly GuideChapter[]): OptimumRoute {
  const totals = new Map(targets.map((target) => [target.mutationId, target.quantity]))
  const members = new Set([...totals.keys(), ...chapters.flatMap((chapter) => chapter.layout.spots.flatMap((spot) => spot.expect))])
  return { targets, totals, members }
}

/**
 * Ce que couvre un guide, d'après tout l'arbre de ses objectifs (sans compter le stock, pour que les
 * fermes restent à leur place quand le stock monte). On recommence jusqu'à ce que rien ne change :
 * 1. besoins : ce que consomment les objectifs, les mutations à poser autour d'un Godseed, ce que
 *    posent les fermes retenues, et leurs recettes ;
 * 2. fermes AVRG, dans l'ordre : celles qui apportent une mutation utile qu'aucune ferme retenue
 *    avant ne fait.
 */
export function guideScope(data: GameData, goalIds: readonly string[], analyzed: ReadonlySet<string>): GuideScope {
  const consumed = mergeGoalTargets(data, new Set(goalIds), analyzed).targets
  const chapters = data.guide.sections.flatMap((section) => section.chapters)
  const outputsOf = (chapter: GuideChapter) => chapter.layout.spots.flatMap((spot) => spot.expect)

  let picked: GuideChapter[] = []
  let support: Target[] = []
  let targets: Target[] = []
  let needed = new Set<string>()
  // Chaque tour ajoute des besoins ; au plus un tour par chapitre (garde-fou).
  for (let round = 0; round <= chapters.length; round += 1) {
    targets = mergeTargets([...consumed, ...support, ...placedBy(picked)])
    const plan = computePlan(data, { targets, inventory: {}, mode: 'optimum', route: routeOf(targets, picked) })
    needed = new Set([...plan.needs.values()].filter((need) => need.required > 0).map((need) => need.mutationId))

    const nextSupport = mergeTargets(
      data.mutations.filter((mutation) => needed.has(mutation.id)).flatMap((mutation) => supportMutations(data, mutation).map((id) => ({ mutationId: id, quantity: 1 }))),
    )
    const produced = new Set<string>()
    const next = chapters.filter((chapter) => {
      const useful = outputsOf(chapter).filter((id) => needed.has(id))
      if (!useful.some((id) => !produced.has(id))) return false
      for (const id of useful) produced.add(id)
      return true
    })
    const same = (a: readonly { readonly id?: string; readonly mutationId?: string }[], b: typeof a) =>
      a.map((x) => x.id ?? x.mutationId).join() === b.map((x) => x.id ?? x.mutationId).join()
    if (same(next, picked) && same(nextSupport, support)) break
    picked = next
    support = nextSupport
  }

  const covered = new Set(chapters.flatMap(outputsOf))
  const manual = data.mutations.filter((mutation) => needed.has(mutation.id) && !covered.has(mutation.id)).map((mutation) => mutation.id)
  return {
    goalIds,
    targets,
    route: routeOf(targets, picked),
    chapterIds: new Set(picked.map((chapter) => chapter.id)),
    manual,
  }
}
