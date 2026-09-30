/**
 * Textes du Mutations Sack : infobulles à la manière du jeu (codes couleur Minecraft) et noms
 * accessibles des cases. Les données viennent de mutations.json, jamais d'ici.
 */
import { formatRarity } from '../../components/labels'
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
  if (!need) return 'pas demandée par tes objectifs'
  return need.missing > 0 ? `${owned} / ${need.required}, manque ${need.missing}` : `${owned} / ${need.required}, couvert`
}

/** Infobulle d'une mutation du sac. */
export function sackTooltip(entry: SackEntry): string[] {
  const { mutation, owned, need, analyzed } = entry
  const lines = [
    `§${RARITY_MC_CODES[mutation.rarity] ?? 'f'}${mutation.name}`,
    `§8${formatRarity(mutation.rarity)} · ${mutation.size} · sol ${mutation.surface}`,
    '',
    `§7En stock : §a${owned}`,
    need
      ? `§7Besoin : §e${owned} / ${need.required}${need.missing > 0 ? ` §c(manque ${need.missing})` : ' §a✓'}`
      : '§7Pas demandée par tes objectifs',
    `§7Analysée : ${analyzed ? '§aoui' : '§cnon'}`,
  ]
  lines.push('', '§eCliquer pour voir !')
  return lines
}

/** Nom accessible d'une case de mutation. */
export function sackLabel(entry: SackEntry): string {
  return `${entry.mutation.name} : ${entry.owned} en stock, ${needText(entry)}, ${entry.analyzed ? 'analysée' : 'pas analysée'}. Ouvrir la fiche.`
}

/** Infobulle d'un objet du sac que l'application ne suit pas (fragment, Dead Plant). */
export function untrackedTooltip(name: string): string[] {
  return [`§f${name}`, '§8Objet du sac', '', '§7Pas suivi par le planificateur.']
}

/** Infobulle du « ? » : capacités du sac et repères des cases. */
export function sackHelpTooltip(sack: MutationsSack): string[] {
  return [
    `§d${sack.name}`,
    ...Object.entries(sack.capacity).map(([size, amount]) => `§7${size} : §a${amount.toLocaleString('fr-FR')} §7de chaque objet`),
    '',
    '§fNombre §7: en stock',
    '§7Objet pâle : aucun en stock',
    '§a✓ §7: besoin de tes objectifs couvert',
    '§5Reflet violet §7: mutation analysée',
    '',
    '§eClique sur une mutation pour sa fiche',
  ]
}
