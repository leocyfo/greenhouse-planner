import { describe, expect, it } from 'vitest'
import {
  MAX_TARGET_QUANTITY,
  normalizeSpots,
  normalizeTargetQuantity,
  withAddedTarget,
  withCalculatorGoal,
  withoutTarget,
  withSingleGoal,
  withSingleTarget,
  withTargetQuantity,
} from './calculator'
import type { CalculatorState } from './state'

const EMPTY: CalculatorState = {
  targets: [],
  goalIds: [],
  mode: 'minimum',
  ignoreInventory: false,
  spots: 1,
  lonelilyCells: 100,
}

describe('calculateur : transitions pures', () => {
  it('borne les quantités et les emplacements', () => {
    expect(normalizeTargetQuantity(0)).toBe(1)
    expect(normalizeTargetQuantity(2.7)).toBe(2)
    expect(normalizeTargetQuantity(1e9)).toBe(MAX_TARGET_QUANTITY)
    expect(normalizeSpots(0)).toBe(1)
    expect(normalizeSpots(Number.NaN)).toBe(1)
  })

  it("ajoute des cibles dans l'ordre et cumule une cible déjà présente", () => {
    const state = withAddedTarget(withAddedTarget(withAddedTarget(EMPTY, 'glasscorn', 1), 'devourer', 1), 'glasscorn', 2)
    expect(state.targets).toEqual([
      { mutationId: 'glasscorn', quantity: 3 },
      { mutationId: 'devourer', quantity: 1 },
    ])
  })

  it('change une quantité ou retire la cible', () => {
    const state = withAddedTarget(EMPTY, 'glasscorn', 1)
    expect(withTargetQuantity(state, 'glasscorn', 4).targets).toEqual([{ mutationId: 'glasscorn', quantity: 4 }])
    expect(withTargetQuantity(state, 'glasscorn', 0).targets).toEqual([])
    expect(withoutTarget(state, 'glasscorn').targets).toEqual([])
  })

  it('ajoute ou retire un objectif comme cible', () => {
    const withGoal = withCalculatorGoal(EMPTY, 'rose_dragon', true)
    expect(withGoal.goalIds).toEqual(['rose_dragon'])
    expect(withCalculatorGoal(withGoal, 'rose_dragon', true).goalIds).toEqual(['rose_dragon'])
    expect(withCalculatorGoal(withGoal, 'rose_dragon', false).goalIds).toEqual([])
  })

  it('remplace tout par une seule mutation ou un seul objectif', () => {
    const busy = withCalculatorGoal(withAddedTarget(EMPTY, 'glasscorn', 3), 'rose_dragon', true)
    expect(withSingleTarget(busy, 'snoozling')).toMatchObject({
      targets: [{ mutationId: 'snoozling', quantity: 1 }],
      goalIds: [],
    })
    expect(withSingleTarget(busy, 'ashwreath', 36).targets).toEqual([{ mutationId: 'ashwreath', quantity: 36 }])
    expect(withSingleGoal(busy, 'trunk_polish')).toMatchObject({ targets: [], goalIds: ['trunk_polish'] })
  })
})
