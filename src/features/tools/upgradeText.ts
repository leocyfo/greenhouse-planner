/**
 * Textes du menu Greenhouse Upgrades : infobulles à la manière du jeu (codes couleur Minecraft)
 * et noms accessibles. Les noms et bonus viennent des données, jamais d'ici.
 */
import type { McColor } from '../../components/minecraft/mcFormat'
import { cumulativeBonus, romanNumeral, type TierState } from '../../logic/upgrades'
import type { Upgrade, UpgradeEffect } from '../../types/game'

/** Couleur de la valeur de chaque effet, comme dans le jeu : aqua, jaune, vert. */
const VALUE_COLOR: Record<UpgradeEffect, McColor> = { growthSpeed: 'b', plantYield: 'e', plotLimit: 'a' }

const STATE_COLOR: Record<TierState, McColor> = { unlocked: 'a', next: 'e', locked: 'c' }
const STATE_LINE: Record<TierState, string> = {
  unlocked: '§a§lDÉBLOQUÉ',
  next: '§e§lPROCHAIN TIER',
  locked: '§c§lVERROUILLÉ',
}
const STATE_TEXT: Record<TierState, string> = { unlocked: 'débloqué', next: 'prochain tier', locked: 'verrouillé' }

const number = (value: number) => value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })

/** Bonus total au tier donné : « 50 % », « au moins 8 % » (tiers inconnus), « +2 ». */
export function upgradeValue(upgrade: Upgrade, tier: number): string {
  const total = cumulativeBonus(upgrade, tier)
  const value = upgrade.unit === 'percent' ? `${number(total.value)} %` : `+${number(total.value)}`
  return total.complete ? value : `au moins ${value}`
}

/** Bonus d'un seul tier : « +10 % Growth Speed », « +1 plot », ou null s'il est inconnu. */
export function tierBonusText(upgrade: Upgrade, tier: number): string | null {
  const bonus = upgrade.tiers[tier - 1]
  if (bonus === null || bonus === undefined) return null
  return upgrade.unit === 'percent' ? `+${number(bonus)} % ${upgrade.name}` : `+${number(bonus)} plot`
}

/** Infobulle d'un upgrade dans le menu principal. */
export function upgradeTooltip(upgrade: Upgrade, tier: number): string[] {
  const lines = [
    `§a${upgrade.name}`,
    `§7${upgrade.description}`,
    '',
    `§7Tier actuel : §a${tier}/${upgrade.tiers.length}`,
    `§7${upgrade.name} : §${VALUE_COLOR[upgrade.effect]}${upgradeValue(upgrade, tier)}`,
  ]
  lines.push('', '§eCliquer pour voir !')
  return lines
}

/** Infobulle d'un tier ; `extra` = lignes propres à l'effet (greenhouse débloqué, prix…). */
export function tierTooltip(
  upgrade: Upgrade,
  tier: number,
  current: number,
  state: TierState,
  extra: readonly string[] = [],
): string[] {
  const bonus = tierBonusText(upgrade, tier)
  const action =
    tier === current
      ? '§7Cliquer pour le retirer'
      : state === 'unlocked'
        ? '§7Cliquer pour revenir à ce tier'
        : state === 'next'
          ? '§eCliquer pour le débloquer'
          : "§eCliquer pour débloquer jusqu'ici"
  return [
    `§${STATE_COLOR[state]}${upgrade.name} ${romanNumeral(tier)}`,
    bonus ? `§${VALUE_COLOR[upgrade.effect]}${bonus}` : '§8Bonus inconnu',
    ...extra,
    '',
    STATE_LINE[state],
    action,
  ]
}

export function upgradeLabel(upgrade: Upgrade, tier: number): string {
  return `${upgrade.name} : tier ${tier} sur ${upgrade.tiers.length}, ${upgradeValue(upgrade, tier)}. Voir les tiers.`
}

export function tierLabel(upgrade: Upgrade, tier: number, state: TierState): string {
  return `${upgrade.name} ${romanNumeral(tier)} : ${tierBonusText(upgrade, tier) ?? 'bonus inconnu'}, ${STATE_TEXT[state]}`
}
