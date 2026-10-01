/** Textes de la liste de courses : recette d'une mutation et créneau de production. */
import type { ScheduleEntry } from '../../logic/growth'
import { recipeInputs } from '../../logic/graph'
import { tr } from '../../i18n/locale'
import { plural } from '../labels'
import type { CropRef, GameData, Mutation } from '../../types/game'

export function cropName(data: GameData, crop: CropRef): string {
  return crop.kind === 'base' ? crop.name : (data.mutationsById.get(crop.id)?.name ?? crop.id)
}

/**
 * Ce qu'il faut pour lancer la recette, une ligne par rôle, ex. :
 * « Autour de l'emplacement : 2 Snoozling (6 cases), 6 Thunderling ».
 */
export function recipeLines(data: GameData, mutation: Mutation): string[] {
  const inputs = recipeInputs(data, mutation)
  const lines: string[] = []
  if (mutation.conditions.length === 0 && mutation.specialCondition) {
    lines.push(tr(`Condition spéciale : ${mutation.specialCondition}`, `Special condition: ${mutation.specialCondition}`))
  }
  const around = inputs
    .filter((input) => input.relation === 'condition')
    .map((input) => {
      const cells = input.cells !== input.units ? tr(` (${input.cells} cases)`, ` (${input.cells} cells)`) : ''
      return `${input.units} ${cropName(data, input.crop)}${cells}`
    })
  if (around.length > 0) lines.push(tr(`Autour de l'emplacement : ${around.join(', ')}`, `Around the spot: ${around.join(', ')}`))
  for (const input of inputs) {
    const name = cropName(data, input.crop)
    if (input.relation === 'consumed') lines.push(tr(`Consomme ${input.units} ${name} par exemplaire`, `Consumes ${input.units} ${name} for each one made`))
    if (input.relation === 'catalyst') {
      lines.push(tr(`Avec ${input.units} ${name} (catalyseur, non consommé)`, `With ${input.units} ${name} (catalyst, not consumed)`))
    }
  }
  return lines
}

/** Créneau de production d'une étape, ex. « Stages 14 → 18 (4 stages) ». */
export function scheduleText(entry: ScheduleEntry): string {
  if (entry.unknownDuration) return tr('Durée inconnue', 'Unknown duration')
  if (entry.productionStages === 0) return tr('Spawn instantané (aucun growth stage)', 'Instant spawn (no growth stage)')
  const stages = entry.productionStages
  return `Stages ${entry.startStage} → ${entry.finishStage} (${plural(stages, 'stage')})`
}
