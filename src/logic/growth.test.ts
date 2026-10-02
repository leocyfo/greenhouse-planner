import { describe, expect, it } from 'vitest'
import { mutationById, projectData } from '../test/projectData'
import { formatDuration } from './format'
import {
  decayWarnings,
  estimatePlanTime,
  growthWithUpgrades,
  harvestStage,
  maxedGrowthSettings,
  productionStages,
  randomSpawnRate,
  stageDurationSeconds,
} from './growth'
import { computePlan } from './recipes'

const data = projectData()
const formula = data.mechanics.growthStage.formula
const NO_BONUS = { upgrades: 0, uniqueCrops: 0, cropGrowth: 0 }
const MAXED = maxedGrowthSettings(formula)

describe("durée d'un growth stage", () => {
  it('dure 4 h sans aucun bonus', () => {
    expect(stageDurationSeconds(NO_BONUS, formula)).toBe(4 * 3600)
    expect(formatDuration(stageDurationSeconds(NO_BONUS, formula))).toBe('4h 00m 00s')
  })

  it('dure environ 1h 44m 20s tout maxé, comme indiqué dans les données', () => {
    const seconds = stageDurationSeconds(MAXED, formula)
    expect(seconds).toBeCloseTo(6260.87, 1)
    expect(formatDuration(seconds)).toBe(data.mechanics.growthStage.maxedDuration)
  })

  it("compte crops uniques et Crop Growth au maximum : seul le Growth Speed se règle dans l'app", () => {
    expect(growthWithUpgrades(formula.upgradesMax, formula)).toEqual(MAXED)
    // Growth Speed tier V (+25 %) : 4 h / (1 + 0,25 + 0,6 + 0,2).
    expect(formatDuration(stageDurationSeconds(growthWithUpgrades(0.25, formula), formula))).toBe('1h 57m 04s')
  })

  it('donne 2h 21m sans crop unique (AVRG mesure 2h 00m : formule à vérifier)', () => {
    const seconds = stageDurationSeconds({ ...MAXED, uniqueCrops: 0 }, formula)
    expect(formatDuration(seconds)).toBe('2h 21m 10s')
  })

  it('ramène les réglages hors bornes dans les limites de la formule', () => {
    expect(stageDurationSeconds({ upgrades: 3, uniqueCrops: 99, cropGrowth: 5000 }, formula)).toBe(
      stageDurationSeconds(MAXED, formula),
    )
    expect(stageDurationSeconds({ upgrades: -1, uniqueCrops: -4, cropGrowth: Number.NaN }, formula)).toBe(
      4 * 3600,
    )
  })
})

describe('stages de production', () => {
  it('utilise le stage de récolte quand la mutation se récolte avant la fin', () => {
    expect(harvestStage(mutationById(data, 'magic_jellybean'))).toBe(36) // recommandé par AVRG
    expect(harvestStage(mutationById(data, 'glasscorn'))).toBe(7)
    expect(harvestStage(mutationById(data, 'all_in_aloe'))).toBe(6)
    expect(harvestStage(mutationById(data, 'chocoberry'))).toBe(6)
    expect(harvestStage(mutationById(data, 'devourer'))).toBe(16)
    expect(harvestStage({ ...mutationById(data, 'devourer'), growthStages: null })).toBeNull() // inconnu
  })

  it('compte un tour par groupe d\'emplacements : 6 Thunderlings sur 2 emplacements = 48 stages', () => {
    expect(productionStages(mutationById(data, 'thunderling'), 6, 2)).toBe(48)
    expect(productionStages({ ...mutationById(data, 'devourer'), growthStages: null }, 1, 1)).toBeNull()
  })
})

describe("estimation du temps d'un plan", () => {
  it('retrouve les 60 stages du Snoozling Complex annoncés par AVRG', () => {
    // Snoozlings, Soggybuds et Noctilumes déjà posés : il reste 6 Thunderlings puis le PlantBoy.
    const p = computePlan(data, {
      targets: [{ mutationId: 'plantboy_advance', quantity: 1 }],
      inventory: { snoozling: 2, soggybud: 5, noctilume: 2 },
      mode: 'minimum',
    })
    const stageSeconds = stageDurationSeconds(MAXED, formula)
    const estimate = estimatePlanTime(data, p, { spots: 2, stageSeconds })
    expect(estimate.criticalPath).toEqual(['thunderling', 'plantboy_advance'])
    expect(estimate.criticalPathStages).toBe(60)
    expect(estimate.criticalPathSeconds).toBeCloseTo(60 * stageSeconds)
    expect(estimate.schedule.get('plantboy_advance')).toMatchObject({ startStage: 48, finishStage: 60 })
  })

  it('signale les mutations dont la durée est inconnue', () => {
    const targets = ['glasscorn', 'devourer', 'all_in_aloe', 'phantomleaf', 'timestalk'].map((mutationId) => ({
      mutationId,
      quantity: 1,
    }))
    const p = computePlan(data, { targets, inventory: {}, mode: 'minimum' })
    // Toutes les durées sont connues (growth stages des légendaires repris de skyshards).
    expect(estimatePlanTime(data, p, { spots: 1, stageSeconds: 3600 }).unknown).toEqual([])
    // Sans growth stages, la durée est signalée inconnue et comptée 0.
    const devourer = { ...mutationById(data, 'devourer'), growthStages: null }
    const unknownData = { ...data, mutationsById: new Map([...data.mutationsById, ['devourer', devourer]]) }
    const estimate = estimatePlanTime(unknownData, p, { spots: 1, stageSeconds: 3600 })
    expect(estimate.unknown).toEqual(['devourer'])
    expect(estimate.criticalPathStages).toBeGreaterThan(0)
    expect(estimate.totalStages).toBeGreaterThanOrEqual(estimate.criticalPathStages)
  })

  it('compte les Lonelily au rythme de leur spawn aléatoire sur les cases vides', () => {
    const spawn = randomSpawnRate(data, 100)
    expect(spawn?.mutationId).toBe('lonelily')
    expect(spawn?.perStage.min).toBeCloseTo(0.4)
    expect(spawn?.perStage.max).toBeCloseTo(0.5)

    const p = computePlan(data, { targets: [{ mutationId: 'noctilume', quantity: 1 }], inventory: {}, mode: 'minimum' })
    // 6 Lonelily à 0,45 par stage → 14 stages ; les 6 Duskbloom (6 emplacements) sont prêtes en 8.
    const estimate = estimatePlanTime(data, p, {
      spots: 6,
      stageSeconds: 3600,
      randomSpawns: new Map([['lonelily', 0.45]]),
    })
    expect(estimate.criticalPath).toEqual(['lonelily', 'noctilume'])
    expect(estimate.criticalPathStages).toBe(14 + 4)

    // Aucune case vide : impossible d'estimer, la durée est signalée inconnue.
    const noCells = estimatePlanTime(data, p, { spots: 6, stageSeconds: 3600, randomSpawns: new Map([['lonelily', 0]]) })
    expect(noCells.unknown).toEqual(['lonelily'])
  })

  it('prévient quand une production dépasse la durée de vie des ingrédients (~3 jours)', () => {
    const p = computePlan(data, {
      targets: [{ mutationId: 'magic_jellybean', quantity: 9 }],
      inventory: {},
      mode: 'minimum',
    })
    const stageSeconds = stageDurationSeconds(MAXED, formula)
    // Un seul emplacement : 9 × 36 stages ≈ 23 jours, les Duskbloom autour meurent avant.
    const oneSpot = estimatePlanTime(data, p, { spots: 1, stageSeconds })
    expect(decayWarnings(data, oneSpot, stageSeconds).map((w) => [w.mutationId, w.ingredientId])).toEqual([
      ['magic_jellybean', 'duskbloom'],
    ])
    // Neuf emplacements : 36 stages ≈ 2,6 jours, ça passe.
    const nineSpots = estimatePlanTime(data, p, { spots: 9, stageSeconds })
    expect(decayWarnings(data, nineSpots, stageSeconds)).toEqual([])
  })

  it('compte la decay propre à chaque ingrédient (Snoozling et Thunderling : 6 jours)', () => {
    const stageSeconds = stageDurationSeconds(MAXED, formula)
    const plantBoy = (quantity: number) => {
      const p = computePlan(data, { targets: [{ mutationId: 'plantboy_advance', quantity }], inventory: {}, mode: 'minimum' })
      const estimate = estimatePlanTime(data, p, { spots: 1, stageSeconds })
      return decayWarnings(data, estimate, stageSeconds).find((w) => w.mutationId === 'plantboy_advance')
    }
    // 5 × 12 stages ≈ 4,3 jours : plus que 3 jours, mais Snoozling et Thunderling tiennent 6 jours.
    expect(plantBoy(5)).toBeUndefined()
    // 9 × 12 stages ≈ 7,8 jours : le Snoozling meurt avant la fin.
    expect(plantBoy(9)).toMatchObject({ ingredientId: 'snoozling', limitSeconds: 6 * 86_400 })
  })

  it('ne compte pas les mutations sans decay (Magic Jellybean ne meurt jamais)', () => {
    const stageSeconds = stageDurationSeconds(MAXED, formula)
    // 12 All-in Aloe × 6 stages ≈ 5,2 jours : le PlantBoy Advance (5 jours) meurt, pas le Magic Jellybean.
    const p = computePlan(data, { targets: [{ mutationId: 'all_in_aloe', quantity: 12 }], inventory: {}, mode: 'minimum' })
    const estimate = estimatePlanTime(data, p, { spots: 1, stageSeconds })
    const aloe = (d: typeof data) => decayWarnings(d, estimate, stageSeconds).find((w) => w.mutationId === 'all_in_aloe')
    expect(aloe(data)).toMatchObject({ ingredientId: 'plantboy_advance', limitSeconds: 5 * 86_400 })
    // Si le PlantBoy Advance ne mourait pas non plus, rien à replanter.
    const plantBoy = { ...mutationById(data, 'plantboy_advance'), decayDays: null }
    expect(aloe({ ...data, mutationsById: new Map([...data.mutationsById, ['plantboy_advance', plantBoy]]) })).toBeUndefined()
  })
})
