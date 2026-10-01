/**
 * Textes du menu Greenhouse Upgrades : infobulles à la manière du jeu (codes couleur Minecraft)
 * et noms accessibles. Les noms et bonus viennent des données, jamais d'ici.
 */
import type { McColor } from '../../components/minecraft/mcFormat'
import { formatDecimal, tr } from '../../i18n/locale'
import { cumulativeBonus, romanNumeral, type TierState } from '../../logic/upgrades'
import type { Upgrade, UpgradeEffect } from '../../types/game'

/** Couleur de la valeur de chaque effet, comme dans le jeu : aqua, jaune, vert. */
const VALUE_COLOR: Record<UpgradeEffect, McColor> = { growthSpeed: 'b', plantYield: 'e', plotLimit: 'a' }

const STATE_COLOR: Record<TierState, McColor> = { unlocked: 'a', next: 'e', locked: 'c' }
/** Ligne d'état d'un tier, en capitales comme dans le jeu. */
function stateLine(state: TierState): string {
  switch (state) {
    case 'unlocked':
      return tr('§a§lDÉBLOQUÉ', '§a§lUNLOCKED')
    case 'next':
      return tr('§e§lPROCHAIN TIER', '§e§lNEXT TIER')
    case 'locked':
      return tr('§c§lVERROUILLÉ', '§c§lLOCKED')
  }
}

function stateText(state: TierState): string {
  switch (state) {
    case 'unlocked':
      return tr('débloqué', 'unlocked')
    case 'next':
      return tr('prochain tier', 'next tier')
    case 'locked':
      return tr('verrouillé', 'locked')
  }
}

const number = (value: number) => formatDecimal(value, 2)
/** « 50 % » en français, « 50% » en anglais. */
const percent = (value: number) => tr(`${number(value)} %`, `${number(value)}%`)

/** Bonus total au tier donné : « 50 % », « au moins 8 % » (tiers inconnus), « +2 ». */
export function upgradeValue(upgrade: Upgrade, tier: number): string {
  const total = cumulativeBonus(upgrade, tier)
  const value = upgrade.unit === 'percent' ? percent(total.value) : `+${number(total.value)}`
  return total.complete ? value : tr(`au moins ${value}`, `at least ${value}`)
}

/** Bonus d'un seul tier : « +10 % Growth Speed », « +1 plot », ou null s'il est inconnu. */
export function tierBonusText(upgrade: Upgrade, tier: number): string | null {
  const bonus = upgrade.tiers[tier - 1]
  if (bonus === null || bonus === undefined) return null
  return upgrade.unit === 'percent' ? `+${percent(bonus)} ${upgrade.name}` : `+${number(bonus)} plot`
}

/** Infobulle d'un upgrade dans le menu principal. */
export function upgradeTooltip(upgrade: Upgrade, tier: number): string[] {
  const lines = [
    `§a${upgrade.name}`,
    `§7${upgrade.description}`,
    '',
    tr(`§7Tier actuel : §a${tier}/${upgrade.tiers.length}`, `§7Current tier: §a${tier}/${upgrade.tiers.length}`),
    tr(`§7${upgrade.name} : `, `§7${upgrade.name}: `) + `§${VALUE_COLOR[upgrade.effect]}${upgradeValue(upgrade, tier)}`,
  ]
  lines.push('', tr('§eCliquer pour voir !', '§eClick to view!'))
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
      ? tr('§7Cliquer pour le retirer', '§7Click to remove it')
      : state === 'unlocked'
        ? tr('§7Cliquer pour revenir à ce tier', '§7Click to go back to this tier')
        : state === 'next'
          ? tr('§eCliquer pour le débloquer', '§eClick to unlock')
          : tr("§eCliquer pour débloquer jusqu'ici", '§eClick to unlock up to here')
  return [
    `§${STATE_COLOR[state]}${upgrade.name} ${romanNumeral(tier)}`,
    bonus ? `§${VALUE_COLOR[upgrade.effect]}${bonus}` : tr('§8Bonus inconnu', '§8Unknown bonus'),
    ...extra,
    '',
    stateLine(state),
    action,
  ]
}

export function upgradeLabel(upgrade: Upgrade, tier: number): string {
  return tr(
    `${upgrade.name} : tier ${tier} sur ${upgrade.tiers.length}, ${upgradeValue(upgrade, tier)}. Voir les tiers.`,
    `${upgrade.name}: tier ${tier} of ${upgrade.tiers.length}, ${upgradeValue(upgrade, tier)}. See the tiers.`,
  )
}

export function tierLabel(upgrade: Upgrade, tier: number, state: TierState): string {
  return tr(
    `${upgrade.name} ${romanNumeral(tier)} : ${tierBonusText(upgrade, tier) ?? 'bonus inconnu'}, ${stateText(state)}`,
    `${upgrade.name} ${romanNumeral(tier)}: ${tierBonusText(upgrade, tier) ?? 'unknown bonus'}, ${stateText(state)}`,
  )
}
