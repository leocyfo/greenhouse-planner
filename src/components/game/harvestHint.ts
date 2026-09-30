/** Indication de récolte d'une mutation (badge « récolte » et fiche). */
import type { Mutation } from '../../types/game'
import { capitalize } from '../labels'

/** Explication d'une récolte avant la fin de la croissance, ou null. */
export function harvestHint(mutation: Mutation): string | null {
  const harvest = mutation.harvest
  if (!harvest) return null
  const parts: string[] = []
  if (harvest.firstStage !== null && harvest.lastStage !== null) {
    parts.push(`Récoltable du stage ${harvest.firstStage} au stage ${harvest.lastStage}`)
  } else if (harvest.firstStage !== null) {
    parts.push(
      `Récoltable dès le stage ${harvest.firstStage}` +
        (harvest.every !== null ? `, puis tous les ${harvest.every} stages` : ''),
    )
  }
  if (harvest.resetsAfterStage !== null) parts.push(`repart au stage 1 après le stage ${harvest.resetsAfterStage}`)
  if (harvest.recommendedStage !== null) {
    const fragments = harvest.fragments
      ? ` (${harvest.fragments.atRecommendedStage} fragments ; ${harvest.fragments.perMutation} fragments = 1 mutation)`
      : ''
    parts.push(`récolte conseillée par AVRG au stage ${harvest.recommendedStage}${fragments}`)
  }
  return `${capitalize(parts.join(', '))}.`
}
