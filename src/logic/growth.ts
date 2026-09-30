/**
 * Croissance : durée d'un growth stage et estimation du temps d'un plan.
 *
 * Modèle de temps (celui du guide AVRG) : spawns instantanés et efficacité parfaite.
 * Un emplacement produit une mutation par « tour » ; un tour dure le nombre de stages
 * jusqu'à la récolte. Ex. 6 Thunderlings (16 stages) sur 2 emplacements = 3 tours = 48 stages,
 * puis le PlantBoy Advance (12 stages) : 60 stages, exactement le minimum annoncé par AVRG.
 */
import type { GameData, Mechanics, Mutation } from '../types/game'
import { recipeInputs } from './graph'
import type { Plan } from './recipes'

export type GrowthFormula = Mechanics['growthStage']['formula']

export interface GrowthSettings {
  /** Bonus des upgrades Growth Speed du greenhouse, de 0 à upgradesMax (0,5 = +50 %). */
  readonly upgrades: number
  /** Nombre de crops uniques plantés (0 à uniqueCropsMax). */
  readonly uniqueCrops: number
  /** Stat Crop Growth (0 à cropGrowthMax). */
  readonly cropGrowth: number
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

/** Ramène chaque réglage dans les bornes de la formule. */
export function clampGrowthSettings(settings: GrowthSettings, formula: GrowthFormula): GrowthSettings {
  return {
    upgrades: clamp(settings.upgrades, 0, formula.upgradesMax),
    uniqueCrops: Math.round(clamp(settings.uniqueCrops, 0, formula.uniqueCropsMax)),
    cropGrowth: clamp(settings.cropGrowth, 0, formula.cropGrowthMax),
  }
}

export function maxedGrowthSettings(formula: GrowthFormula): GrowthSettings {
  return { upgrades: formula.upgradesMax, uniqueCrops: formula.uniqueCropsMax, cropGrowth: formula.cropGrowthMax }
}

/**
 * Réglages utilisés par l'application : seul le Growth Speed (menu des upgrades) se règle ;
 * crops uniques et Crop Growth sont comptés au maximum.
 */
export function growthWithUpgrades(upgrades: number, formula: GrowthFormula): GrowthSettings {
  return { ...maxedGrowthSettings(formula), upgrades }
}

/**
 * Durée d'un growth stage, en secondes :
 * baseHours / (1 + upgrades + crops uniques × bonus par crop + Crop Growth / diviseur).
 * Estimation non vérifiée : tout maxé elle donne bien 1h 44m 20s, mais AVRG mesure 2h 00m sans
 * crop unique là où elle donne 2h 21m.
 */
export function stageDurationSeconds(settings: GrowthSettings, formula: GrowthFormula): number {
  const s = clampGrowthSettings(settings, formula)
  const speed =
    1 + s.upgrades + s.uniqueCrops * formula.bonusPerUniqueCrop + s.cropGrowth / formula.cropGrowthDivisor
  return (formula.baseHours * 3600) / speed
}

/**
 * Stage auquel on récolte : stage recommandé (ex. Magic Jellybean à 36 selon AVRG), sinon
 * premier stage récoltable (Glasscorn 7), sinon fin de croissance. null = inconnu.
 */
export function harvestStage(mutation: Mutation): number | null {
  return mutation.harvest?.recommendedStage ?? mutation.harvest?.firstStage ?? mutation.growthStages
}

/** Stages pour produire `quantity` exemplaires avec `spots` emplacements. null = durée inconnue. */
export function productionStages(mutation: Mutation, quantity: number, spots: number): number | null {
  const stages = harvestStage(mutation)
  if (stages === null) return null
  return Math.ceil(Math.max(0, quantity) / Math.max(1, Math.floor(spots))) * stages
}

export interface ScheduleEntry {
  readonly mutationId: string
  readonly startStage: number
  readonly productionStages: number
  readonly finishStage: number
  /** Ingrédient dont on attend la production pour démarrer (chemin critique). */
  readonly waitsFor: string | null
  /** Durée inconnue : comptée 0 dans l'estimation. */
  readonly unknownDuration: boolean
}

export interface PlanTimeEstimate {
  readonly schedule: ReadonlyMap<string, ScheduleEntry>
  /** Mutations du chemin le plus long, dans l'ordre de production. */
  readonly criticalPath: readonly string[]
  readonly criticalPathStages: number
  readonly criticalPathSeconds: number
  /** Somme de toutes les productions, si tout était fait l'un après l'autre. */
  readonly totalStages: number
  /** Mutations sans durée connue : l'estimation est alors partielle. */
  readonly unknown: readonly string[]
}

export interface TimeOptions {
  /** Emplacements de spawn par recette (1 = une seule case, comme en mode Minimum). */
  readonly spots: number
  readonly stageSeconds: number
  /**
   * Mutations qui spawnent au hasard (Lonelily), avec le nombre moyen de spawns par stage.
   * Leur production ne dépend pas des emplacements mais de ce rythme.
   */
  readonly randomSpawns?: ReadonlyMap<string, number>
}

export interface RandomSpawn {
  readonly mutationId: string
  /** Spawns attendus par growth stage, fourchette des données. */
  readonly perStage: { readonly min: number; readonly max: number }
}

/**
 * Mutation qui spawn au hasard sur les cases de Dirt vides (Lonelily) et son rythme pour
 * `emptyCells` cases : 100 cases × 0,004 à 0,005 ≈ 0,4 à 0,5 par stage.
 */
export function randomSpawnRate(data: GameData, emptyCells: number): RandomSpawn | null {
  const rate = data.mechanics.lonelilyRatePerCell
  const mutation = data.mutationsByName.get(rate.mutation)
  if (!mutation) return null
  const cells = Math.max(0, emptyCells)
  return { mutationId: mutation.id, perStage: { min: cells * rate.min, max: cells * rate.max } }
}

/**
 * Estimation minimale du temps d'un plan : chaque recette démarre dès que ses ingrédients
 * sont disponibles (en stock ou produits), toutes les recettes avancent en parallèle.
 */
export function estimatePlanTime(data: GameData, plan: Plan, options: TimeOptions): PlanTimeEstimate {
  const spots = Math.max(1, Math.floor(options.spots))
  const schedule = new Map<string, ScheduleEntry>()

  // Stages pour produire `count` exemplaires : par tours d'emplacements, ou au rythme des
  // spawns aléatoires (Lonelily). null = durée inconnue.
  const produce = (mutation: Mutation, count: number): number | null => {
    const perStage = options.randomSpawns?.get(mutation.id)
    if (perStage === undefined) return productionStages(mutation, count, spots)
    if (count <= 0) return 0
    return perStage > 0 ? Math.ceil(count / perStage) : null
  }

  // Stage où `units` exemplaires d'un ingrédient sont disponibles pour une recette.
  const readyStage = (id: string, units: number): number => {
    const entry = schedule.get(id)
    const need = plan.needs.get(id)
    const mutation = data.mutationsById.get(id)
    if (!entry || !need || !mutation) return 0 // en stock : rien à produire
    const toProduce = Math.max(0, units - need.owned)
    if (toProduce === 0) return 0
    return entry.startStage + (produce(mutation, toProduce) ?? 0)
  }

  for (const id of plan.farmOrder) {
    const mutation = data.mutationsById.get(id)
    const need = plan.needs.get(id)
    if (!mutation || !need) continue
    let startStage = 0
    let waitsFor: string | null = null
    for (const input of recipeInputs(data, mutation)) {
      if (input.crop.kind !== 'mutation') continue
      const ready = readyStage(input.crop.id, input.units)
      if (ready > startStage) {
        startStage = ready
        waitsFor = input.crop.id
      }
    }
    const production = produce(mutation, need.missing)
    schedule.set(id, {
      mutationId: id,
      startStage,
      productionStages: production ?? 0,
      finishStage: startStage + (production ?? 0),
      waitsFor,
      unknownDuration: production === null,
    })
  }

  let last: ScheduleEntry | null = null
  let totalStages = 0
  for (const entry of schedule.values()) {
    totalStages += entry.productionStages
    if (!last || entry.finishStage >= last.finishStage) last = entry
  }
  const criticalPath: string[] = []
  for (let entry = last; entry; entry = entry.waitsFor ? (schedule.get(entry.waitsFor) ?? null) : null) {
    criticalPath.unshift(entry.mutationId)
  }
  const criticalPathStages = last?.finishStage ?? 0

  return {
    schedule,
    criticalPath,
    criticalPathStages,
    criticalPathSeconds: criticalPathStages * options.stageSeconds,
    totalStages,
    unknown: [...schedule.values()].filter((e) => e.unknownDuration).map((e) => e.mutationId),
  }
}

export interface DecayWarning {
  readonly mutationId: string
  readonly productionSeconds: number
  readonly limitSeconds: number
}

/**
 * Recettes dont la production dure plus longtemps que la vie des ingrédients : les mutations
 * posées autour meurent environ `decayDays` jours après leur pose, il faudra les remplacer.
 */
export function decayWarnings(
  data: GameData,
  estimate: PlanTimeEstimate,
  stageSeconds: number,
  decayDays: number,
): DecayWarning[] {
  const limitSeconds = decayDays * 86_400
  const warnings: DecayWarning[] = []
  for (const entry of estimate.schedule.values()) {
    const mutation = data.mutationsById.get(entry.mutationId)
    const usesMutations = mutation?.conditions.some((c) => c.crop.kind === 'mutation') ?? false
    const productionSeconds = entry.productionStages * stageSeconds
    if (usesMutations && productionSeconds > limitSeconds) {
      warnings.push({ mutationId: entry.mutationId, productionSeconds, limitSeconds })
    }
  }
  return warnings
}
