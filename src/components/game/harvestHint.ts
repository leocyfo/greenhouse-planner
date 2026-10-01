/** Indication de récolte d'une mutation (badge « récolte » et fiche). */
import type { Mutation } from '../../types/game'
import { tr } from '../../i18n/locale'
import { capitalize } from '../labels'

/** Explication d'une récolte avant la fin de la croissance, ou null. */
export function harvestHint(mutation: Mutation): string | null {
  const harvest = mutation.harvest
  if (!harvest) return null
  const parts: string[] = []
  if (harvest.firstStage !== null && harvest.lastStage !== null) {
    parts.push(
      tr(`Récoltable du stage ${harvest.firstStage} au stage ${harvest.lastStage}`, `Harvestable from stage ${harvest.firstStage} to stage ${harvest.lastStage}`),
    )
  } else if (harvest.firstStage !== null) {
    parts.push(
      tr(`Récoltable dès le stage ${harvest.firstStage}`, `Harvestable from stage ${harvest.firstStage}`) +
        (harvest.every !== null ? tr(`, puis tous les ${harvest.every} stages`, `, then every ${harvest.every} stages`) : ''),
    )
  }
  if (harvest.resetsAfterStage !== null) {
    parts.push(tr(`repart au stage 1 après le stage ${harvest.resetsAfterStage}`, `goes back to stage 1 after stage ${harvest.resetsAfterStage}`))
  }
  if (harvest.recommendedStage !== null) {
    const fragments = harvest.fragments
      ? tr(
          ` (${harvest.fragments.atRecommendedStage} fragments ; ${harvest.fragments.perMutation} fragments = 1 mutation)`,
          ` (${harvest.fragments.atRecommendedStage} fragments; ${harvest.fragments.perMutation} fragments = 1 mutation)`,
        )
      : ''
    parts.push(
      tr(`récolte conseillée par AVRG au stage ${harvest.recommendedStage}${fragments}`, `AVRG recommends harvesting at stage ${harvest.recommendedStage}${fragments}`),
    )
  }
  return `${capitalize(parts.join(', '))}.`
}
