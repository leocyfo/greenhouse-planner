/**
 * Niveau d'eau d'un crop pendant sa croissance.
 *
 * Modèle (estimation, mechanics.water.modelVerified = false) : à chaque growth stage, le crop
 * perd `lossPerStage` × (1 − rétention / 100), où la rétention est la somme des effets d'eau
 * reçus en % (Water Retain +50, Improved Water Retain +100, Water Drain −30). Si le niveau est
 * négatif pendant un stage, le crop peut ne pas avancer. Une fois fully grown, l'eau ne compte plus.
 */

export interface WaterSettings {
  readonly startLevel: number
  /** Perte de base par stage (2 à 3 d'après les données). */
  readonly lossPerStage: number
  /** Somme des effets d'eau reçus, en %. */
  readonly retentionPercent: number
  readonly levelRange: { readonly min: number; readonly max: number }
}

export interface WaterStage {
  /** Numéro du stage (1 = premier). */
  readonly stage: number
  /** Niveau à la fin du stage. */
  readonly level: number
  /** Niveau négatif : le crop peut ne pas avancer pendant ce stage. */
  readonly negative: boolean
}

/** Perte réelle par stage ; jamais négative (une rétention de +100 % annule la perte). */
export function effectiveLossPerStage(lossPerStage: number, retentionPercent: number): number {
  return Math.max(0, lossPerStage * (1 - retentionPercent / 100))
}

function clampLevel(level: number, range: WaterSettings['levelRange']): number {
  return Math.min(range.max, Math.max(range.min, level))
}

/** Nombre de stages complets avant que le niveau devienne négatif (Infinity si aucune perte). */
export function stagesBeforeDry(settings: WaterSettings): number {
  const start = clampLevel(settings.startLevel, settings.levelRange)
  if (start < 0) return 0
  const loss = effectiveLossPerStage(settings.lossPerStage, settings.retentionPercent)
  if (loss === 0) return Infinity
  // Petite marge pour les arrondis flottants (ex. 100 / 2,5 doit donner 40, pas 39).
  return Math.floor(start / loss + 1e-9)
}

/** Niveau d'eau stage par stage, borné à l'intervalle des données (−100 à 100). */
export function simulateWater(settings: WaterSettings, stages: number): WaterStage[] {
  const loss = effectiveLossPerStage(settings.lossPerStage, settings.retentionPercent)
  const result: WaterStage[] = []
  let level = clampLevel(settings.startLevel, settings.levelRange)
  for (let stage = 1; stage <= stages; stage += 1) {
    level = clampLevel(level - loss, settings.levelRange)
    result.push({ stage, level, negative: level < 0 })
  }
  return result
}
