/**
 * Textes du Mutations Sack : infobulles à la manière du jeu (codes couleur Minecraft) et noms
 * accessibles des cases. Les données viennent de mutations.json, jamais d'ici.
 */
import { formatNumber, formatRarity } from '../../components/labels'
import { tr } from '../../i18n/locale'
import type { MutationNeed } from '../../logic/recipes'
import { RARITY_MC_CODES } from '../../theme/palette'
import type { Mutation, MutationsSack } from '../../types/game'

export interface SackEntry {
  readonly mutation: Mutation
  readonly owned: number
  readonly need: MutationNeed | undefined
  readonly analyzed: boolean
}

function needText({ owned, need }: SackEntry): string {
  if (!need) return tr('pas demandée par tes objectifs', 'not requested by your goals')
  return need.missing > 0
    ? tr(`${owned} / ${need.required}, manque ${need.missing}`, `${owned} / ${need.required}, ${need.missing} missing`)
    : tr(`${owned} / ${need.required}, couvert`, `${owned} / ${need.required}, covered`)
}

/** Infobulle d'une mutation du sac. */
export function sackTooltip(entry: SackEntry): string[] {
  const { mutation, owned, need, analyzed } = entry
  const lines = [
    `§${RARITY_MC_CODES[mutation.rarity] ?? 'f'}${mutation.name}`,
    `§8${formatRarity(mutation.rarity)} · ${mutation.size} · ${tr('sol', 'soil')} ${mutation.surface}`,
    '',
    `§7${tr('En stock : ', 'In stock: ')}§a${formatNumber(owned)}`,
    need
      ? `§7${tr('Besoin : ', 'Needed: ')}§e${formatNumber(owned)} / ${formatNumber(need.required)}${need.missing > 0 ? ` §c(${tr('manque', 'missing')} ${formatNumber(need.missing)})` : ' §a✓'}`
      : `§7${tr('Pas demandée par tes objectifs', 'Not requested by your goals')}`,
    `§7${tr('Analysée : ', 'Analyzed: ')}${analyzed ? `§a${tr('oui', 'yes')}` : `§c${tr('non', 'no')}`}`,
  ]
  lines.push('', `§e${tr('Cliquer pour voir !', 'Click to view!')}`)
  return lines
}

/** Nom accessible d'une case de mutation. */
export function sackLabel(entry: SackEntry): string {
  return tr(
    `${entry.mutation.name} : ${entry.owned} en stock, ${needText(entry)}, ${entry.analyzed ? 'analysée' : 'pas analysée'}. Ouvrir la fiche.`,
    `${entry.mutation.name}: ${entry.owned} in stock, ${needText(entry)}, ${entry.analyzed ? 'analyzed' : 'not analyzed'}. Open the sheet.`,
  )
}

/** Infobulle d'un objet du sac que l'application ne suit pas (fragment, Dead Plant). */
export function untrackedTooltip(name: string): string[] {
  return [`§f${name}`, `§8${tr('Objet du sac', 'Sack item')}`, '', `§7${tr('Pas suivi par le planificateur.', 'Not tracked by the planner.')}`]
}

/** Infobulle du « ? » : capacités du sac et repères des cases. */
export function sackHelpTooltip(sack: MutationsSack): string[] {
  return [
    `§d${sack.name}`,
    ...Object.entries(sack.capacity).map(([size, amount]) =>
      tr(`§7${size} : §a${formatNumber(amount)} §7de chaque objet`, `§7${size}: §a${formatNumber(amount)} §7of each item`),
    ),
    '',
    tr('§fNombre §7: en stock', '§fNumber§7: in stock'),
    tr('§7Objet pâle : aucun en stock', '§7Faded item: none in stock'),
    tr('§a✓ §7: besoin de tes objectifs couvert', '§a✓§7: your goals are covered'),
    tr('§5Reflet violet §7: mutation analysée', '§5Purple glint§7: analyzed mutation'),
    '',
    tr('§eClique sur une mutation pour sa fiche', '§eClick a mutation for its sheet'),
  ]
}
