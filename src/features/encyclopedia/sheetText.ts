/**
 * Textes de la fiche d'une mutation, à la manière du menu « Garden Mutation » du jeu : infobulles
 * des cases (codes couleur Minecraft) et lignes de l'onglet d'infos. Les données viennent de
 * mutations.json, jamais d'ici.
 */
import { harvestHint } from '../../components/game/harvestHint'
import { formatNumber, formatRarity } from '../../components/labels'
import { WIKI_CREDITS } from '../../data/wikiImages'
import { tr } from '../../i18n/locale'
import type { RecipeInput, RecipeUse } from '../../logic/graph'
import { RARITY_MC_CODES } from '../../theme/palette'
import type { BestiaryEntry, CropRef, GameData, Goal, Mutation } from '../../types/game'

/** Nom d'un crop avec la couleur de sa rareté (blanc pour un crop de base). */
export function coloredName(data: GameData, crop: CropRef): string {
  if (crop.kind === 'base') return `§f${crop.name}`
  const mutation = data.mutationsById.get(crop.id)
  return `§${RARITY_MC_CODES[mutation?.rarity ?? ''] ?? 'f'}${mutation?.name ?? crop.id}`
}

export function cropName(data: GameData, crop: CropRef): string {
  return crop.kind === 'base' ? crop.name : (data.mutationsById.get(crop.id)?.name ?? crop.id)
}

/** Page du wiki : sa recherche, qui ouvre directement la page de l'objet quand elle existe. */
export function wikiUrl(name: string): string {
  return `${WIKI_CREDITS.sourceUrl}wiki/Special:Search?query=${encodeURIComponent(name)}&go=Go`
}

/** Ce qu'une recette fait de la mutation : « 6 à poser », « 1 consommé », « 1 en catalyseur ». */
export function recipeUseText(use: Pick<RecipeUse, 'relation' | 'units' | 'cells'>): string {
  switch (use.relation) {
    case 'condition':
      return tr(`${use.units} à poser`, `${use.units} to place`) + (use.cells !== use.units ? tr(` (${use.cells} cases)`, ` (${use.cells} cells)`) : '')
    case 'consumed':
      return tr(`${use.units} consommé`, `${use.units} consumed`)
    case 'catalyst':
      return tr(`${use.units} en catalyseur`, `${use.units} as catalyst`)
  }
}

/** Infobulle de la case de la mutation, au centre de la plantation. */
export function spotTooltip(data: GameData, mutation: Mutation): string[] {
  return [
    coloredName(data, { kind: 'mutation', id: mutation.id }),
    `§7${tr("Emplacement : elle pousse ici", 'Spot: it grows here')}`,
    `§7${tr('Sol : ', 'Soil: ')}§f${mutation.surface}`,
  ]
}

/** Infobulle d'un ingrédient : ce qu'il faut en poser (ou en consommer), et sa fiche s'il en a une. */
export function ingredientTooltip(data: GameData, input: RecipeInput): string[] {
  const lines = [coloredName(data, input.crop)]
  if (input.relation === 'condition') {
    lines.push(`§7${tr('À poser autour : ', 'To place around: ')}§f${input.units}`)
    if (input.cells !== input.units) lines.push(`§8${tr(`${input.cells} cases autour de l'emplacement`, `${input.cells} cells around the spot`)}`)
  } else if (input.relation === 'consumed') {
    lines.push(`§7${tr('Consommé : ', 'Consumed: ')}§f${input.units} §7${tr('par mutation faite', 'for each one made')}`)
  } else {
    lines.push(`§7${tr('Catalyseur : ', 'Catalyst: ')}§f${input.units} §7${tr('(pas consommé)', '(not consumed)')}`)
  }
  lines.push(input.crop.kind === 'mutation' ? `§e${tr('Cliquer pour voir sa fiche !', 'Click to view its sheet!')}` : `§8${tr('Crop de base', 'Base crop')}`)
  return lines
}

interface InfoContext {
  readonly stateLabel: string
  readonly usedIn: readonly RecipeUse[]
  readonly goals: readonly Goal[]
  readonly bestiary: readonly BestiaryEntry[]
}

/** Onglet d'infos : toute la fiche en lignes courtes, comme la description d'un objet du jeu. */
export function infoLines(data: GameData, mutation: Mutation, context: InfoContext): string[] {
  const color = RARITY_MC_CODES[mutation.rarity] ?? 'f'
  const lines = [
    `§${color}§l${formatRarity(mutation.rarity).toUpperCase()} MUTATION`,
    `§8${context.stateLabel}`,
    '',
    `§7${tr('Taille ', 'Size ')}§f${mutation.size}§7 · ${tr('Sol ', 'Soil ')}§f${mutation.surface}§7 · Stages §f${mutation.growthStages ?? '?'}`,
  ]
  const care = [
    `§7Decay §f${mutation.decayDays !== null ? tr(`${mutation.decayDays} jours`, `${mutation.decayDays} days`) : tr('aucune', 'none')}`,
    mutation.needsWater !== null
      ? `§7${tr('Arrosage ', 'Watering ')}${mutation.needsWater ? `§b${tr('nécessaire', 'needed')}` : `§f${tr('inutile', 'not needed')}`}`
      : null,
  ].filter((part) => part !== null)
  if (care.length > 0) lines.push(care.join('§7 · '))
  // Récolte avant la fin de la croissance (Magic Jellybean, Glasscorn, All-in Aloe).
  const harvest = harvestHint(mutation)
  if (harvest) lines.push(`§e${harvest}`)

  const drops = Object.entries(mutation.drops)
  if (drops.length > 0) {
    lines.push('', `§7${tr('Drops :', 'Drops:')}`)
    for (const [item, amount] of drops) lines.push(`§f${formatNumber(amount)} §7${item}`)
  }

  if (mutation.effects.length > 0) {
    lines.push('', `§7${tr('Effets sur les crops voisins :', 'Effects on neighboring crops:')}`)
    for (const name of mutation.effects) {
      const effect = data.effects.get(name)
      const positive = effect?.type === 'positive'
      lines.push(`${positive ? '§a+ ' : '§c− '}${name}${effect ? ` §8${effect.value}` : ''}`)
    }
  }

  const uses = [
    ...context.usedIn.map((use) => `${coloredName(data, { kind: 'mutation', id: use.mutationId })} §8${recipeUseText(use)}`),
    ...mutation.usages.map((usage) => `§f${usage.target}${usage.quantity !== null ? ` §8× ${usage.quantity}` : ''}`),
    ...context.goals.map((goal) => `§f${goal.name} §8${tr('(objectif)', '(goal)')}`),
  ]
  if (uses.length > 0) lines.push('', `§7${tr('Sert à :', 'Used for:')}`, ...uses)

  lines.push(
    '',
    `§7${tr('Route Rose Dragon (AVRG) : ', 'Rose Dragon route (AVRG): ')}§fOptimum ${mutation.roseDragonOptimum}§7 · §fMinimum ${mutation.roseDragonMinimum ?? '—'}`,
  )

  for (const entry of context.bestiary) {
    lines.push(
      `§7Bestiary : §f${entry.mob} §8${entry.maxKills === null ? tr('kills max inconnus', 'unknown max kills') : tr(`${entry.maxKills} kills max`, `${entry.maxKills} max kills`)}`,
    )
  }
  if (mutation.notes) lines.push('', `§7${mutation.notes}`)
  if (mutation.avrgNotes) lines.push('', `§6${tr('Guide AVRG : ', 'AVRG guide: ')}§7${mutation.avrgNotes}`)
  return lines
}
