/**
 * Fermes du guide qui se font en même temps (demande du joueur : « combine le 7, 8 et 9 »).
 * Des chapitres qui se suivent vont ensemble quand :
 * - aucun n'a besoin de ce qu'un chapitre d'avant dans le groupe fait (Cheesebite, Magic Jellybean
 *   et Chloronite prennent leurs ingrédients aux fermes d'avant ; dans l'ordre du guide, ce qui vient
 *   d'une ferme d'après est attendu d'ailleurs, comme les Lonelily qui spawnent au hasard) ;
 * - ils tiennent tous dans un greenhouse vide (même vérification que pour poser : chaque emplacement
 *   fait spawn la même chose que si sa ferme était seule) ;
 * - aucun ne reste seul sur son greenhouse (Chorus Fruit) ni n'est une étape d'une ferme en plusieurs
 *   étapes (Snoozling Complex, qui a déjà sa carte).
 * Parmi les découpages possibles : le moins de groupes, puis les plus gros (7+8+9 plutôt que 6+7 et 8+9).
 */
import type { GameData, GuideChapter } from '../../types/game'
import { emptyGrid, largestFirst, ownPlotOf, packFarms } from './farmPacking'
import { nextStageOf } from './guideModel'

const outputsOf = (chapter: GuideChapter) => new Set(chapter.layout.spots.flatMap((spot) => spot.expect))
const placedOf = (chapter: GuideChapter) => chapter.layout.placements.flatMap((placement) => (placement.crop.kind === 'mutation' ? [placement.crop.id] : []))

/** Ces chapitres peuvent-ils se faire ensemble ? */
function together(data: GameData, chapters: readonly GuideChapter[]): boolean {
  if (chapters.length < 2) return true
  const ownPlot = ownPlotOf(data)
  if (chapters.some((chapter) => ownPlot(chapter.layout) || chapter.upgrades !== null || nextStageOf(data, chapter) !== null)) return false
  const independent = chapters.every((chapter, index) =>
    placedOf(chapter).every((id) => chapters.slice(0, index).every((before) => !outputsOf(before).has(id))),
  )
  if (!independent) return false
  return packFarms(data, emptyGrid(data), largestFirst(data, chapters.map((chapter) => chapter.layout)), [], ownPlot).rest.length === 0
}

const cache = new WeakMap<GameData, Map<string, GuideChapter[][]>>()

/** Les chapitres (dans l'ordre du guide) découpés en groupes à faire en même temps ; un groupe d'un seul = une ferme seule. */
export function farmGroups(data: GameData, chapters: readonly GuideChapter[]): GuideChapter[][] {
  let byKey = cache.get(data)
  if (!byKey) cache.set(data, (byKey = new Map()))
  const key = chapters.map((chapter) => chapter.id).join(',')
  const cached = byKey.get(key)
  if (cached) return cached

  // reach[i] : dernier chapitre j tel que i..j aillent ensemble (un sous-groupe d'un groupe valable l'est aussi).
  const reach = chapters.map((_, i) => {
    let j = i
    while (j + 1 < chapters.length && together(data, chapters.slice(i, j + 2))) j += 1
    return j
  })
  // best[k] : meilleur découpage des k premiers chapitres (moins de groupes, puis somme des carrés des tailles la plus grande).
  const best: { count: number; score: number; groups: GuideChapter[][] }[] = [{ count: 0, score: 0, groups: [] }]
  for (let k = 1; k <= chapters.length; k += 1) {
    let choice: (typeof best)[number] | null = null
    for (let i = k - 1; i >= 0; i -= 1) {
      const before = best[i]
      if ((reach[i] ?? i) < k - 1 || !before) continue
      const candidate = { count: before.count + 1, score: before.score + (k - i) ** 2, groups: [...before.groups, chapters.slice(i, k)] }
      if (!choice || candidate.count < choice.count || (candidate.count === choice.count && candidate.score > choice.score)) choice = candidate
    }
    best.push(choice ?? { count: Infinity, score: 0, groups: [] })
  }
  const groups = best[chapters.length]?.groups ?? chapters.map((chapter) => [chapter])
  byKey.set(key, groups)
  return groups
}
