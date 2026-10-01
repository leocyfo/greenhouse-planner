/** Outils : suivi des Ethereal Vines (logique pure). */
import type { GameData } from '../types/game'

export interface VineCounts {
  /** Vines dépensées case par case dans le 1er greenhouse. */
  readonly first: number
  /** Vines payées au NPC pour les greenhouses 2 et 3 : 0, ou leur prix une fois achetés. */
  readonly second: number
  readonly third: number
}

/** Greenhouse acheté au NPC en une fois : il arrive entièrement ouvert. */
export interface GreenhousePurchase {
  readonly key: 'second' | 'third'
  /** Index du greenhouse (0 = le 1er). */
  readonly index: number
  readonly price: number
  readonly unlocked: boolean
}

export interface VineProgress {
  /** 1er greenhouse : 1 vine = 1 case, jusqu'à `needed`. */
  readonly first: { readonly spent: number; readonly needed: number }
  readonly purchases: readonly GreenhousePurchase[]
  readonly spent: number
  readonly total: number
  /** Cases utilisables dans le 1er greenhouse : cases de départ + 1 par vine dépensée. */
  readonly firstGreenhouseSpots: number
  readonly firstGreenhouseCells: number
  /** Index des greenhouses utilisables : le 1er, plus ceux achetés. */
  readonly unlockedGreenhouses: readonly number[]
}

/**
 * Avancement des Ethereal Vines (données : 88 pour ouvrir tout le 1er greenhouse, case par
 * case ; 100 pour le 2e et 150 pour le 3e, payées au NPC en une fois ; 338 au total).
 */
export function vineProgress(data: GameData, counts: VineCounts): VineProgress {
  const vines = data.mechanics.etherealVines
  const { width, height } = data.mechanics.greenhouse
  const first = Math.min(vines.maxFirstGreenhouse, Math.max(0, Math.floor(counts.first)))
  // L'achat se fait en une fois : un montant partiel (ancienne saisie) ne débloque rien.
  const purchases: GreenhousePurchase[] = [
    { key: 'second', index: 1, price: vines.unlockSecond, unlocked: counts.second >= vines.unlockSecond },
    { key: 'third', index: 2, price: vines.unlockThird, unlocked: counts.third >= vines.unlockThird },
  ]
  return {
    first: { spent: first, needed: vines.maxFirstGreenhouse },
    purchases,
    spent: first + purchases.reduce((sum, purchase) => sum + (purchase.unlocked ? purchase.price : 0), 0),
    total: vines.total,
    firstGreenhouseSpots: Math.min(width * height, vines.firstGreenhouseInitialSpots + first),
    firstGreenhouseCells: width * height,
    unlockedGreenhouses: [0, ...purchases.filter((purchase) => purchase.unlocked).map((purchase) => purchase.index)],
  }
}

/**
 * Coche ou décoche l'achat d'un greenhouse. Le déblocage est séquentiel : acheter le 2e
 * suppose toutes les cases du 1er ouvertes, acheter le 3e suppose le 2e acheté. À l'inverse,
 * décocher le 2e décoche aussi le 3e.
 */
export function withGreenhousePurchase(
  data: GameData,
  counts: VineCounts,
  key: GreenhousePurchase['key'],
  unlocked: boolean,
): VineCounts {
  const vines = data.mechanics.etherealVines
  if (unlocked) {
    return {
      first: vines.maxFirstGreenhouse,
      second: vines.unlockSecond,
      third: key === 'third' ? vines.unlockThird : counts.third,
    }
  }
  return key === 'second' ? { ...counts, second: 0, third: 0 } : { ...counts, third: 0 }
}

/** Tier de l'upgrade Plot Limit : un tier par greenhouse acheté au NPC. */
export function plotLimitTier(data: GameData, counts: VineCounts): number {
  return vineProgress(data, counts).purchases.filter((purchase) => purchase.unlocked).length
}

/** Règle le tier Plot Limit : 0 = aucun greenhouse acheté, 1 = le 2e, 2 = le 2e et le 3e. */
export function withPlotLimitTier(data: GameData, counts: VineCounts, tier: number): VineCounts {
  if (tier <= 0) return withGreenhousePurchase(data, counts, 'second', false)
  if (tier === 1) return withGreenhousePurchase(data, withGreenhousePurchase(data, counts, 'third', false), 'second', true)
  return withGreenhousePurchase(data, counts, 'third', true)
}
