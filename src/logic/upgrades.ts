/**
 * Upgrades du Greenhouse (menu « Greenhouse Upgrades » du jeu) : total des bonus selon le tier,
 * état de chaque tier et effet d'un clic. Logique pure, sans React.
 */
import type { GameData, Upgrade, UpgradeEffect } from '../types/game'

export function upgradeByEffect(data: GameData, effect: UpgradeEffect): Upgrade | undefined {
  return data.mechanics.greenhouseUpgrades.items.find((upgrade) => upgrade.effect === effect)
}

export interface UpgradeTotal {
  /** Somme des bonus connus jusqu'au tier donné. */
  readonly value: number
  /** false si un des tiers comptés a un bonus inconnu : `value` n'est alors qu'un minimum. */
  readonly complete: boolean
}

/** Bonus cumulé des tiers 1 à `tier`. */
export function cumulativeBonus(upgrade: Upgrade, tier: number): UpgradeTotal {
  const counted = upgrade.tiers.slice(0, Math.max(0, tier))
  const value = counted.reduce<number>((sum, bonus) => sum + (bonus ?? 0), 0)
  // Arrondi : évite les 0,15000000000000002 des additions de décimaux.
  return { value: Math.round(value * 1000) / 1000, complete: counted.every((bonus) => bonus !== null) }
}

/** Tier atteint pour un total donné : le plus haut dont le bonus cumulé ne dépasse pas `total`. */
export function tierFromTotal(upgrade: Upgrade, total: number): number {
  let tier = 0
  for (let next = 1; next <= upgrade.tiers.length; next += 1) {
    const cumulative = cumulativeBonus(upgrade, next)
    if (!cumulative.complete || cumulative.value > total + 1e-6) break
    tier = next
  }
  return tier
}

export type TierState = 'unlocked' | 'next' | 'locked'

/** État d'un tier (numéroté à partir de 1) quand `current` tiers sont débloqués. */
export function tierState(tier: number, current: number): TierState {
  if (tier <= current) return 'unlocked'
  return tier === current + 1 ? 'next' : 'locked'
}

/**
 * Tier choisi par un clic sur le tier `clicked` : on débloque jusqu'à lui ; recliquer sur le
 * dernier tier débloqué le retire (pour pouvoir revenir à 0).
 */
export function clickedTier(current: number, clicked: number): number {
  return clicked === current ? clicked - 1 : clicked
}

const ROMAN: readonly [number, string][] = [
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
]

/** Numéro de tier en chiffres romains, comme dans le jeu (1 à 39). */
export function romanNumeral(value: number): string {
  let rest = Math.max(0, Math.floor(value))
  let out = ''
  for (const [amount, letters] of ROMAN) {
    while (rest >= amount) {
      out += letters
      rest -= amount
    }
  }
  return out
}

/**
 * Colonnes d'une rangée de 9 cases où placer `count` éléments, centrés : espacés d'une case s'ils
 * tiennent (comme les 2 tiers de Plot Limit), sinon côte à côte.
 */
export function spreadColumns(count: number, width = 9): number[] {
  const gap = count * 2 - 1 <= width ? 2 : 1
  const span = (count - 1) * gap + 1
  const start = Math.max(0, Math.floor((width - span) / 2))
  return Array.from({ length: count }, (_, index) => start + index * gap)
}
