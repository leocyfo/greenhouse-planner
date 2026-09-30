/** Textes de la liste de courses : recette d'une mutation et créneau de production. */
import type { ScheduleEntry } from '../../logic/growth'
import { recipeInputs } from '../../logic/graph'
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
    lines.push(`Condition spéciale : ${mutation.specialCondition}`)
  }
  const around = inputs
    .filter((input) => input.relation === 'condition')
    .map((input) => {
      const cells = input.cells !== input.units ? ` (${input.cells} cases)` : ''
      return `${input.units} ${cropName(data, input.crop)}${cells}`
    })
  if (around.length > 0) lines.push(`Autour de l'emplacement : ${around.join(', ')}`)
  for (const input of inputs) {
    const name = cropName(data, input.crop)
    if (input.relation === 'consumed') lines.push(`Consomme ${input.units} ${name} par exemplaire`)
    if (input.relation === 'catalyst') lines.push(`Avec ${input.units} ${name} (catalyseur, non consommé)`)
  }
  return lines
}

/** Créneau de production d'une étape, ex. « Stages 14 → 18 (4 stages) ». */
export function scheduleText(entry: ScheduleEntry): string {
  if (entry.unknownDuration) return 'Durée inconnue'
  if (entry.productionStages === 0) return 'Spawn instantané (aucun growth stage)'
  const stages = entry.productionStages
  return `Stages ${entry.startStage} → ${entry.finishStage} (${stages} stage${stages > 1 ? 's' : ''})`
}
