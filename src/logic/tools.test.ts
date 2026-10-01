import { describe, expect, it } from 'vitest'
import { projectData } from '../test/projectData'
import {
  plotLimitTier,
  vineProgress,
  withGreenhousePurchase,
  withPlotLimitTier,
} from './tools'

const data = projectData()

describe('outils : Ethereal Vines', () => {
  it('ouvre le 1er greenhouse case par case : 12 cases au départ + 1 par vine, 88 au plus', () => {
    const empty = vineProgress(data, { first: 0, second: 0, third: 0 })
    expect(empty).toMatchObject({
      first: { spent: 0, needed: 88 },
      spent: 0,
      total: 338,
      firstGreenhouseSpots: 12,
      firstGreenhouseCells: 100,
      unlockedGreenhouses: [0],
    })
    expect(vineProgress(data, { first: 40, second: 0, third: 0 }).firstGreenhouseSpots).toBe(52)
    expect(vineProgress(data, { first: 999, second: 0, third: 0 }).first.spent).toBe(88)
    expect(vineProgress(data, { first: -5, second: 0, third: 0 }).first.spent).toBe(0)
  })

  it('achète les greenhouses 2 et 3 au NPC en une fois (100 et 150), sans vine par case', () => {
    const progress = vineProgress(data, { first: 88, second: 100, third: 70 })
    expect(progress.purchases.map((p) => [p.index, p.price, p.unlocked])).toEqual([
      [1, 100, true],
      [2, 150, false], // 70 vines ne suffisent pas : l'achat se fait en une fois
    ])
    expect(progress.spent).toBe(188)
    expect(progress.unlockedGreenhouses).toEqual([0, 1])
    expect(vineProgress(data, { first: 88, second: 100, third: 150 }).spent).toBe(338)
  })

  it('débloque dans l’ordre : le 2e ouvre tout le 1er, le 3e ouvre aussi le 2e', () => {
    const start = { first: 10, second: 0, third: 0 }
    expect(withGreenhousePurchase(data, start, 'second', true)).toEqual({ first: 88, second: 100, third: 0 })
    expect(withGreenhousePurchase(data, start, 'third', true)).toEqual({ first: 88, second: 100, third: 150 })
  })

  it('traduit le tier Plot Limit en greenhouses achetés, et inversement', () => {
    const none = { first: 20, second: 0, third: 0 }
    expect(withPlotLimitTier(data, none, 1)).toEqual({ first: 88, second: 100, third: 0 })
    expect(withPlotLimitTier(data, none, 2)).toEqual({ first: 88, second: 100, third: 150 })
    expect(withPlotLimitTier(data, { first: 88, second: 100, third: 150 }, 1)).toEqual({ first: 88, second: 100, third: 0 })
    expect(withPlotLimitTier(data, { first: 88, second: 100, third: 150 }, 0)).toEqual({ first: 88, second: 0, third: 0 })
    expect([none, { first: 88, second: 100, third: 0 }, { first: 88, second: 100, third: 150 }].map((c) => plotLimitTier(data, c))).toEqual([0, 1, 2])
  })

  it('décocher le 2e décoche aussi le 3e ; décocher le 3e laisse le reste', () => {
    const all = { first: 88, second: 100, third: 150 }
    expect(withGreenhousePurchase(data, all, 'second', false)).toEqual({ first: 88, second: 0, third: 0 })
    expect(withGreenhousePurchase(data, all, 'third', false)).toEqual({ first: 88, second: 100, third: 0 })
  })
})
