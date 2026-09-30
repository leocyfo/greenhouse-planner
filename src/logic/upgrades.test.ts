import { describe, expect, it } from 'vitest'
import { projectData } from '../test/projectData'
import {
  clickedTier,
  cumulativeBonus,
  romanNumeral,
  spreadColumns,
  tierFromTotal,
  tierState,
  upgradeByEffect,
} from './upgrades'

const data = projectData()

function upgrade(effect: 'growthSpeed' | 'plantYield' | 'plotLimit') {
  const found = upgradeByEffect(data, effect)
  if (!found) throw new Error(`upgrade manquant : ${effect}`)
  return found
}

describe('upgrades : bonus par tier (captures du menu)', () => {
  it('Growth Speed : 9 tiers, +10 % pour le IX, 50 % au total', () => {
    const speed = upgrade('growthSpeed')
    expect(speed.tiers).toHaveLength(9)
    expect(speed.tiers[8]).toBe(10)
    expect(cumulativeBonus(speed, 9)).toEqual({ value: 50, complete: true })
    expect(cumulativeBonus(speed, 3)).toEqual({ value: 15, complete: true })
    expect(cumulativeBonus(speed, 0)).toEqual({ value: 0, complete: true })
  })

  it('Plant Yield : 8 % au tier 4 ; au-delà, le total n’est plus qu’un minimum', () => {
    const plantYield = upgrade('plantYield')
    expect(cumulativeBonus(plantYield, 4)).toEqual({ value: 8, complete: true })
    expect(cumulativeBonus(plantYield, 6)).toEqual({ value: 8, complete: false })
  })

  it('Plot Limit : 2 tiers de +1 plot, un par greenhouse à acheter', () => {
    expect(cumulativeBonus(upgrade('plotLimit'), 2)).toEqual({ value: 2, complete: true })
  })
})

describe('upgrades : tier courant et clics', () => {
  it('retrouve le tier Growth Speed à partir du bonus total', () => {
    const speed = upgrade('growthSpeed')
    expect(tierFromTotal(speed, 50)).toBe(9)
    expect(tierFromTotal(speed, 40)).toBe(8)
    expect(tierFromTotal(speed, 45)).toBe(8) // valeur entre deux tiers : le tier atteint
    expect(tierFromTotal(speed, 0)).toBe(0)
    expect(tierFromTotal(speed, 0.15 * 100)).toBe(3) // tolère les arrondis des décimaux
  })

  it('colore les tiers : débloqués, prochain, verrouillés', () => {
    expect([1, 4, 5, 6].map((tier) => tierState(tier, 4))).toEqual(['unlocked', 'unlocked', 'next', 'locked'])
  })

  it('un clic débloque jusqu’au tier cliqué ; recliquer le dernier le retire', () => {
    expect(clickedTier(4, 7)).toBe(7)
    expect(clickedTier(4, 2)).toBe(2)
    expect(clickedTier(4, 4)).toBe(3)
    expect(clickedTier(1, 1)).toBe(0)
  })
})

describe('upgrades : affichage', () => {
  it('numérote les tiers en chiffres romains', () => {
    expect([1, 2, 4, 5, 8, 9].map(romanNumeral)).toEqual(['I', 'II', 'IV', 'V', 'VIII', 'IX'])
  })

  it('centre les éléments dans une rangée de 9 cases', () => {
    expect(spreadColumns(9)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
    expect(spreadColumns(3)).toEqual([2, 4, 6])
    expect(spreadColumns(2)).toEqual([3, 5])
    expect(spreadColumns(1)).toEqual([4])
  })
})
