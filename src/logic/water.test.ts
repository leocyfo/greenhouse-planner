import { describe, expect, it } from 'vitest'
import { projectData } from '../test/projectData'
import { effectiveLossPerStage, simulateWater, stagesBeforeDry, type WaterSettings } from './water'

const data = projectData()
const { levelRange, lossPerStageRange } = data.mechanics.water

/** Pourcentage d'un effet d'eau tiré des données (Water Retain +50, Water Drain −30…). */
function waterAmount(effect: string): number {
  const amount = data.effects.get(effect)?.amount
  if (amount === undefined || amount === null) throw new Error(`Effet sans valeur : ${effect}`)
  return amount
}

function settings(retentionPercent: number, lossPerStage = 2.5): WaterSettings {
  return { startLevel: levelRange.max, lossPerStage, retentionPercent, levelRange }
}

describe("niveau d'eau", () => {
  it('perd 2 à 3 par stage sans effet : de 100, il reste positif 40 stages à 2,5', () => {
    expect(lossPerStageRange).toEqual({ min: 2, max: 3 })
    expect(stagesBeforeDry(settings(0))).toBe(40)
    expect(stagesBeforeDry(settings(0, lossPerStageRange.min))).toBe(50)
    expect(stagesBeforeDry(settings(0, lossPerStageRange.max))).toBe(33)
  })

  it('Water Retain divise la perte par deux, Improved Water Retain l\'annule', () => {
    expect(effectiveLossPerStage(2.5, waterAmount('Water Retain'))).toBe(1.25)
    expect(stagesBeforeDry(settings(waterAmount('Water Retain')))).toBe(80)
    expect(stagesBeforeDry(settings(waterAmount('Improved Water Retain')))).toBe(Infinity)
  })

  it('Water Drain augmente la perte de 30 %', () => {
    expect(effectiveLossPerStage(2.5, waterAmount('Water Drain'))).toBeCloseTo(3.25)
    expect(stagesBeforeDry(settings(waterAmount('Water Drain')))).toBe(30)
  })

  it('les effets se cumulent : Water Retain + Water Drain = +20 %', () => {
    const retention = waterAmount('Water Retain') + waterAmount('Water Drain')
    expect(stagesBeforeDry(settings(retention))).toBe(50)
  })

  it('simule le niveau stage par stage et marque les stages en négatif', () => {
    const stages = simulateWater(settings(0), 42)
    expect(stages[39]).toEqual({ stage: 40, level: 0, negative: false })
    expect(stages[40]).toEqual({ stage: 41, level: -2.5, negative: true })
  })

  it('ne descend jamais sous le minimum des données (−100)', () => {
    const stages = simulateWater(settings(0, 50), 10)
    expect(stages.at(-1)?.level).toBe(levelRange.min)
  })
})
